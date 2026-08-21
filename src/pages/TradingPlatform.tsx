import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { calculatePositionPL, formatPips, getRequiredMargin } from "@/lib/tradingCalculations";
import {
  FUNDED_MAX_RISK_PERCENT,
  getPhaseRules,
  getTotalPhases,
} from "@/lib/challengeRules";
import { TradingViewChart } from "@/components/trading/TradingViewChart";
import { AssetSelector } from "@/components/trading/AssetSelector";
import { DrawdownTracker } from "@/components/trading/DrawdownTracker";
import { ProfitTargetTracker } from "@/components/trading/ProfitTargetTracker";
import { ConsistencyScoreTracker } from "@/components/trading/ConsistencyScoreTracker";
import { useTradingViewPrices } from "@/hooks/useTradingViewPrices";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  RefreshCw,
  DollarSign,
  Target,
  X,
  Activity,
  Wifi,
  WifiOff,
  Lock,
  ShieldAlert,
} from "lucide-react";

interface Account {
  id: string;
  account_size: number;
  current_balance: number;
  profit_loss: number;
  challenge_type: string;
  status: string;
  current_phase: number | null;
  high_water_mark: number | null;
  daily_start_balance: number | null;
  daily_start_date: string | null;
  max_drawdown_percent: number | null;
  daily_drawdown_percent: number | null;
  drawdown_violated: boolean | null;
  violation_type: string | null;
  phase_passed: boolean | null;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  pip_value: number;
  quote_currency?: string | null;
  lot_size?: number;
}

// Approximate market-cap ordering for the supported crypto pairs
const MARKET_CAP_ORDER = [
  "BTC", "ETH", "XRP", "BNB", "SOL", "DOGE", "ADA", "LINK", "AVAX", "BCH",
  "XLM", "LTC", "DOT", "UNI", "NEAR", "AAVE", "ETC", "ATOM", "ALGO", "XTZ",
  "SAND",
];

const marketCapRank = (symbol: string) => {
  const base = symbol.replace(/(USDT|USDC|USD|\/|-)/g, "").toUpperCase();
  const idx = MARKET_CAP_ORDER.indexOf(base);
  return idx === -1 ? 999 : idx;
};

interface Position {
  id: string;
  asset_id: string;
  position_type: string;
  lot_size: number;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  profit_loss: number;
  status: string;
  opened_at: string;
  closed_at: string | null;
  assets?: Asset;
}

export default function TradingPlatform() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [lotSize, setLotSize] = useState("0.01");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [isProceeding, setIsProceeding] = useState(false);
  const [view, setView] = useState<"trade" | "chart">("trade");

  // Get symbols for live prices synced with TradingView
  const symbols = assets.map((a) => a.symbol);
  const { prices, isConnected, getMarketStatus } = useTradingViewPrices(symbols);

  // Fetch account and positions
  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // Fetch account
      const { data: accountData, error: accountError } = await supabase
        .from("accounts")
        .select("*")
        .eq("id", accountId)
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (accountError || !accountData) {
        toast({ title: "Account not found", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      if (
        accountData.status !== "active" &&
        accountData.status !== "funded" &&
        accountData.status !== "failed"
      ) {
        toast({
          title: "Account not active",
          description: "This account is not available for trading",
          variant: "destructive",
        });
        navigate("/dashboard");
        return;
      }

      setAccount(accountData);

      // Fetch assets
      const { data: assetsData } = await supabase
        .from("assets")
        .select("*")
        .eq("is_active", true);

      if (assetsData) {
        const sorted = [...assetsData].sort(
          (a, b) => marketCapRank(a.symbol) - marketCapRank(b.symbol)
        );
        setAssets(sorted);
        setSelectedAsset(sorted[0] || null);
      }

      // Fetch positions
      const { data: positionsData } = await supabase
        .from("positions")
        .select("*, assets(*)")
        .eq("account_id", accountId)
        .order("opened_at", { ascending: false });

      if (positionsData) {
        setPositions(positionsData);
      }

      setIsLoading(false);
    };

    fetchData();
  }, [accountId, navigate, toast]);

  // Calculate unrealized P/L for open positions using proper pip calculations
  const calculateUnrealizedPL = useCallback(() => {
    return positions
      .filter((p) => p.status === "open")
      .reduce((total, position) => {
        const asset = position.assets;
        if (!asset) return total;

        const currentPrice = prices[asset.symbol];
        if (!currentPrice) return total;

        const priceNow =
          position.position_type === "buy"
            ? currentPrice.bid
            : currentPrice.ask;

        const { profitLoss } = calculatePositionPL(
          asset,
          position.position_type as 'buy' | 'sell',
          position.entry_price,
          priceNow,
          position.lot_size
        );

        return total + profitLoss;
      }, 0);
  }, [positions, prices]);

  const formatPrice = (_symbol: string, price: number) => {
    if (price >= 100) return price.toFixed(2);
    if (price >= 1) return price.toFixed(3);
    if (price >= 0.01) return price.toFixed(4);
    return price.toFixed(6);
  };

  const isBlocked =
    !!account && (account.status === "failed" || account.drawdown_violated === true);
  const isFundedAccount =
    account?.status === "funded" || account?.challenge_type === "instant";

  // ---- Margin (account balance is the total available margin) ----
  const usedMargin = positions
    .filter((p) => p.status === "open")
    .reduce((total, p) => {
      if (!p.assets) return total;
      return total + getRequiredMargin(p.assets, p.lot_size, p.entry_price);
    }, 0);

  const balanceForMargin = account?.current_balance ?? account?.account_size ?? 0;
  const freeMargin = Math.max(0, balanceForMargin - usedMargin);

  const pendingLots = parseFloat(lotSize);
  const pendingPrice = selectedAsset ? prices[selectedAsset.symbol]?.ask : undefined;
  const pendingMargin =
    selectedAsset && pendingPrice && Number.isFinite(pendingLots) && pendingLots > 0
      ? getRequiredMargin(selectedAsset, pendingLots, pendingPrice)
      : 0;
  const insufficientMargin = pendingMargin > freeMargin;

  // ---- Rule breach enforcement: close everything and lock the account ----
  const breachHandledRef = useRef(false);

  const enforceRuleBreach = useCallback(
    async (violation: "max_drawdown" | "daily_drawdown" | "max_risk") => {
      if (!account || breachHandledRef.current) return;
      breachHandledRef.current = true;

      const openNow = positions.filter((p) => p.status === "open");
      const nowIso = new Date().toISOString();
      let realized = 0;
      const closedIds: Record<string, { exit: number; pl: number }> = {};

      for (const position of openNow) {
        const asset = position.assets;
        const priceFeed = asset ? prices[asset.symbol] : null;
        if (!asset || !priceFeed) continue;

        const exitPrice =
          position.position_type === "buy" ? priceFeed.bid : priceFeed.ask;
        const { profitLoss } = calculatePositionPL(
          asset,
          position.position_type as "buy" | "sell",
          position.entry_price,
          exitPrice,
          position.lot_size
        );
        realized += profitLoss;
        closedIds[position.id] = { exit: exitPrice, pl: profitLoss };

        await supabase
          .from("positions")
          .update({
            status: "closed",
            exit_price: exitPrice,
            profit_loss: profitLoss,
            closed_at: nowIso,
          })
          .eq("id", position.id);

        await supabase.from("trade_history").insert({
          account_id: account.id,
          position_id: position.id,
          action: "close",
          symbol: asset.symbol,
          lot_size: position.lot_size,
          price: exitPrice,
          profit_loss: profitLoss,
          notes: `Force-closed: ${violation.replace("_", " ")} breach`,
        });
      }

      const newBalance = (account.current_balance || account.account_size) + realized;
      const newPL = (account.profit_loss || 0) + realized;
      const effectiveHWM = account.high_water_mark || account.account_size;
      const effectiveDailyStart = account.daily_start_balance || account.account_size;
      const maxDrawdownPercent =
        effectiveHWM > 0 ? ((effectiveHWM - newBalance) / effectiveHWM) * 100 : 0;
      const dailyDrawdownPercent =
        effectiveDailyStart > 0
          ? ((effectiveDailyStart - newBalance) / effectiveDailyStart) * 100
          : 0;

      const accountUpdate = {
        current_balance: newBalance,
        profit_loss: newPL,
        max_drawdown_percent: maxDrawdownPercent,
        daily_drawdown_percent: dailyDrawdownPercent,
        drawdown_violated: true,
        violation_type: violation,
        phase_passed: false,
        status: "failed" as const,
      };

      await supabase.from("accounts").update(accountUpdate).eq("id", account.id);

      await supabase.from("trade_history").insert({
        account_id: account.id,
        action: "account_failed",
        symbol: "-",
        lot_size: 0,
        price: 0,
        notes: `Account failed - ${violation === "max_risk" ? `max risk ${FUNDED_MAX_RISK_PERCENT}%` : violation.replace("_", " ")} limit breached. All positions force-closed.`,
      });

      setAccount((prev) => (prev ? { ...prev, ...accountUpdate } : null));
      setPositions((prev) =>
        prev.map((p) =>
          closedIds[p.id]
            ? {
                ...p,
                status: "closed",
                exit_price: closedIds[p.id].exit,
                profit_loss: closedIds[p.id].pl,
                closed_at: nowIso,
              }
            : p
        )
      );

      toast({
        title: "Account Failed - Trading Disabled",
        description:
          violation === "max_drawdown"
            ? "Max drawdown limit breached. All open trades were closed and this account is now blocked from trading."
            : violation === "daily_drawdown"
              ? "Daily drawdown limit breached. All open trades were closed and this account is now blocked from trading."
              : `Trade limit reached. Max risk ${FUNDED_MAX_RISK_PERCENT}% breached, all open trades were closed, and this account is now blocked from trading.`,
        variant: "destructive",
        duration: 12000,
      });
    },
    [account, positions, prices, toast]
  );

  // Live (equity-based) breach monitoring — reacts instantly to price moves
  useEffect(() => {
    if (!account || isBlocked || breachHandledRef.current) return;

    const unrealized = calculateUnrealizedPL();
    const liveEquity = (account.current_balance || account.account_size) + unrealized;
    const hwm = account.high_water_mark || account.account_size;
    const dailyStart = account.daily_start_balance || account.account_size;
    const rules = getPhaseRules(account.challenge_type, account.current_phase || 1);

    const maxDD = hwm > 0 ? ((hwm - liveEquity) / hwm) * 100 : 0;
    const dailyDD = dailyStart > 0 ? ((dailyStart - liveEquity) / dailyStart) * 100 : 0;
    if (maxDD >= rules.maxDrawdown) {
      enforceRuleBreach("max_drawdown");
    } else if (dailyDD >= rules.dailyDrawdown) {
      enforceRuleBreach("daily_drawdown");
    }
  }, [account, isBlocked, calculateUnrealizedPL, enforceRuleBreach]);

  const handlePlaceOrder = async (type: "buy" | "sell") => {
    if (!selectedAsset || !account) return;

    if (isBlocked) {
      toast({
        title: "Trading disabled",
        description: "This account has failed a challenge rule and is blocked from trading.",
        variant: "destructive",
      });
      return;
    }

    const currentPrice = prices[selectedAsset.symbol];
    if (!currentPrice) return;

    setIsPlacingOrder(true);

    const entryPrice = type === "buy" ? currentPrice.ask : currentPrice.bid;
    const lots = parseFloat(lotSize);

    if (isNaN(lots) || lots <= 0) {
      toast({ title: "Invalid lot size", variant: "destructive" });
      setIsPlacingOrder(false);
      return;
    }

    // Balance is the total margin available — reject orders it can't cover
    const requiredMargin = getRequiredMargin(selectedAsset, lots, entryPrice);
    if (requiredMargin > freeMargin) {
      toast({
        title: "Insufficient margin",
        description: `${lots} lot(s) of ${selectedAsset.symbol} needs $${requiredMargin.toFixed(2)} margin but only $${freeMargin.toFixed(2)} is free.`,
        variant: "destructive",
      });
      setIsPlacingOrder(false);
      return;
    }

    // Insert position
    const { data: positionData, error: positionError } = await supabase
      .from("positions")
      .insert({
        account_id: account.id,
        asset_id: selectedAsset.id,
        position_type: type,
        lot_size: lots,
        entry_price: entryPrice,
        stop_loss: stopLoss ? parseFloat(stopLoss) : null,
        take_profit: takeProfit ? parseFloat(takeProfit) : null,
        status: "open",
      })
      .select("*, assets(*)")
      .single();

    if (positionError) {
      toast({
        title: "Failed to place order",
        description: positionError.message,
        variant: "destructive",
      });
      setIsPlacingOrder(false);
      return;
    }

    // Log trade
    await supabase.from("trade_history").insert({
      account_id: account.id,
      position_id: positionData.id,
      action: "open",
      symbol: selectedAsset.symbol,
      lot_size: lots,
      price: entryPrice,
    });

    setPositions((prev) => [positionData, ...prev]);
    toast({
      title: `${type.toUpperCase()} Order Placed`,
      description: `${selectedAsset.symbol} @ ${formatPrice(selectedAsset.symbol, entryPrice)}`,
    });

    setStopLoss("");
    setTakeProfit("");
    setIsPlacingOrder(false);
  };

  const handleClosePosition = async (position: Position) => {
    if (!account || !position.assets) return;
    if (isBlocked) return;

    const currentPrice = prices[position.assets.symbol];
    if (!currentPrice) return;

    const exitPrice =
      position.position_type === "buy" ? currentPrice.bid : currentPrice.ask;

    // Use proper pip calculation
    const { profitLoss, pips } = calculatePositionPL(
      position.assets,
      position.position_type as 'buy' | 'sell',
      position.entry_price,
      exitPrice,
      position.lot_size
    );

    console.log(`Closing position: ${position.assets.symbol}, Entry: ${position.entry_price}, Exit: ${exitPrice}, Lots: ${position.lot_size}, Pips: ${pips}, P/L: $${profitLoss}`);

    // Update position
    const { error: updateError } = await supabase
      .from("positions")
      .update({
        status: "closed",
        exit_price: exitPrice,
        profit_loss: profitLoss,
        closed_at: new Date().toISOString(),
      })
      .eq("id", position.id);

    if (updateError) {
      toast({ title: "Failed to close position", variant: "destructive" });
      return;
    }

    // Update account balance and calculate drawdowns
    const newBalance =
      (account.current_balance || account.account_size) + profitLoss;
    const newPL = (account.profit_loss || 0) + profitLoss;
    
    // Calculate drawdowns
    const effectiveHWM = account.high_water_mark || account.account_size;
    const effectiveDailyStart = account.daily_start_balance || account.account_size;
    
    // Update high water mark if new balance is higher
    const newHWM = Math.max(effectiveHWM, newBalance);
    
    // Calculate drawdown percentages
    const maxDrawdownPercent = newHWM > 0 ? ((newHWM - newBalance) / newHWM) * 100 : 0;
    const dailyDrawdownPercent = effectiveDailyStart > 0 
      ? ((effectiveDailyStart - newBalance) / effectiveDailyStart) * 100 
      : 0;

    // Check for drawdown violations using the rules of the CURRENT phase
    const activePhase = account.current_phase || 1;
    const phaseRules = getPhaseRules(account.challenge_type, activePhase);

    let violationType: string | null = null;
    if (maxDrawdownPercent >= phaseRules.maxDrawdown) {
      violationType = 'max_drawdown';
    } else if (dailyDrawdownPercent >= phaseRules.dailyDrawdown) {
      violationType = 'daily_drawdown';
    }

    // Check for phase completion (profit target of the current phase met)
    const currentPhase = activePhase;
    const profitTarget = phaseRules.profitTarget;
    const profitPercent = ((newBalance - account.account_size) / account.account_size) * 100;
    
    // Check if profit target is met and no drawdown violation - mark phase as passed
    let phasePassed = account.phase_passed || false;
    if (profitTarget > 0 && profitPercent >= profitTarget && !violationType && !phasePassed) {
      phasePassed = true;
      
      toast({
        title: `🎯 Phase ${currentPhase} Target Achieved!`,
        description: `Close all positions and click "Proceed" to advance to the next phase.`,
        duration: 8000,
      });
    }

    // Prepare update object
    const accountUpdate = {
      current_balance: newBalance,
      profit_loss: newPL,
      high_water_mark: newHWM,
      max_drawdown_percent: maxDrawdownPercent,
      daily_drawdown_percent: dailyDrawdownPercent,
      drawdown_violated: violationType !== null,
      violation_type: violationType,
      phase_passed: phasePassed,
    };

    await supabase
      .from("accounts")
      .update(accountUpdate)
      .eq("id", account.id);

    // Log trade
    await supabase.from("trade_history").insert({
      account_id: account.id,
      position_id: position.id,
      action: "close",
      symbol: position.assets.symbol,
      lot_size: position.lot_size,
      price: exitPrice,
      profit_loss: profitLoss,
      notes: phasePassed && !account.phase_passed ? `Phase ${currentPhase} target achieved` : null,
    });

    setAccount((prev) =>
      prev ? { 
        ...prev, 
        current_balance: newBalance,
        profit_loss: newPL,
        high_water_mark: newHWM,
        max_drawdown_percent: maxDrawdownPercent,
        daily_drawdown_percent: dailyDrawdownPercent,
        drawdown_violated: violationType !== null,
        violation_type: violationType,
        phase_passed: phasePassed,
      } : null
    );
    setPositions((prev) =>
      prev.map((p) =>
        p.id === position.id
          ? {
              ...p,
              status: "closed",
              exit_price: exitPrice,
              profit_loss: profitLoss,
              closed_at: new Date().toISOString(),
            }
          : p
      )
    );

    if (!phasePassed || account.phase_passed) {
      toast({
        title: "Position Closed",
        description: `${position.assets.symbol} P/L: ${profitLoss >= 0 ? "+" : ""}$${profitLoss.toFixed(2)}`,
        variant: profitLoss >= 0 ? "default" : "destructive",
      });
    }
  };

  // Handle proceeding to next phase
  const handleProceedToNextPhase = async () => {
    if (!account) return;

    setIsProceeding(true);

    const totalPhases = getTotalPhases(account.challenge_type);
    const currentPhase = account.current_phase || 1;

    // A phase must be finished flat — no open positions may carry into the next phase
    const stillOpen = positions.filter((p) => p.status === "open");
    if (stillOpen.length > 0) {
      toast({
        title: "Close your open positions first",
        description: `You still have ${stillOpen.length} open position(s). Close them all before advancing.`,
        variant: "destructive",
      });
      setIsProceeding(false);
      return;
    }

    let newPhase = currentPhase;
    let newStatus: "active" | "failed" | "funded" | "passed" | "pending_payment" =
      account.status as "active" | "failed" | "funded" | "passed" | "pending_payment";
    const resetBalance = account.account_size;

    if (currentPhase >= totalPhases) {
      // Final phase completed - account is now funded
      newStatus = 'funded';
      
      toast({
        title: "🎉 Congratulations! Challenge Passed!",
        description: `You've successfully completed all phases! Your account is now funded.`,
        duration: 10000,
      });
    } else {
      // Advance to next phase
      newPhase = currentPhase + 1;
      const nextRules = getPhaseRules(account.challenge_type, newPhase);

      toast({
        title: `🚀 Advancing to Phase ${newPhase}!`,
        description: `Balance reset to $${resetBalance.toLocaleString()}. New rules: ${nextRules.profitTarget}% target, ${nextRules.dailyDrawdown}% daily / ${nextRules.maxDrawdown}% max drawdown.`,
        duration: 8000,
      });
    }

    // Update account with reset values
    const accountUpdate = {
      current_phase: newPhase,
      status: newStatus,
      current_balance: resetBalance,
      profit_loss: 0,
      high_water_mark: resetBalance,
      daily_start_balance: resetBalance,
      daily_start_date: new Date().toISOString().split('T')[0],
      max_drawdown_percent: 0,
      daily_drawdown_percent: 0,
      phase_passed: false, // Reset for next phase
      drawdown_violated: false,
      violation_type: null,
    };

    const { error } = await supabase
      .from("accounts")
      .update(accountUpdate)
      .eq("id", account.id);

    if (error) {
      toast({
        title: "Failed to proceed",
        description: error.message,
        variant: "destructive",
      });
      setIsProceeding(false);
      return;
    }

    // Log phase advancement
    await supabase.from("trade_history").insert({
      account_id: account.id,
      action: "phase_advance",
      symbol: "-",
      lot_size: 0,
      price: 0,
      notes: newStatus === 'funded' 
        ? 'Challenge completed - Account funded!' 
        : `Advanced from Phase ${currentPhase} to Phase ${newPhase}`,
    });

    setAccount((prev) =>
      prev ? { 
        ...prev, 
        ...accountUpdate,
      } : null
    );

    // Start the new phase with a clean slate in the positions panel
    setPositions([]);

    setIsProceeding(false);
  };

  const unrealizedPL = calculateUnrealizedPL();
  const equity = account
    ? (account.current_balance || account.account_size) + unrealizedPL
    : 0;
  const openPositions = positions.filter((p) => p.status === "open");
  const closedPositions = positions.filter((p) => p.status === "closed");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50 shrink-0">
        <div className="px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button
                variant="ghost"
                size="sm"
                className="px-2 sm:px-3"
                onClick={() => navigate("/dashboard")}
                aria-label="Return to dashboard"
              >
                <ArrowLeft className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Dashboard</span>
              </Button>
              <div className="hidden sm:block h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <span className="font-semibold text-sm sm:text-base">Trading</span>
                {isConnected ? (
                  <Wifi className="w-3 h-3 text-green-500" />
                ) : (
                  <WifiOff className="w-3 h-3 text-red-500" />
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm overflow-x-auto">
              <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                <span className="text-muted-foreground">Bal:</span>
                <span className="font-bold">
                  $
                  {(
                    account?.current_balance ||
                    account?.account_size ||
                    0
                  ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                <span className="text-muted-foreground">Eq:</span>
                <span className="font-bold">
                  ${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                <span className="text-muted-foreground">P/L:</span>
                <span
                  className={cn(
                    "font-bold",
                    (account?.profit_loss || 0) >= 0
                      ? "text-green-500"
                      : "text-red-500"
                  )}
                >
                  {(account?.profit_loss || 0) >= 0 ? "+" : ""}$
                  {(account?.profit_loss || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 p-2 sm:p-4 space-y-3">
        {/* Account failed / trading blocked */}
        {isBlocked && (
          <Card className="border-red-500/50 bg-red-500/10">
            <CardContent className="p-3 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-500">
                  Account Failed — Trading Disabled
                </p>
                <p className="text-sm text-red-400">
                  {account?.violation_type === "daily_drawdown"
                    ? "Daily drawdown limit breached."
                    : "Max drawdown limit breached."}{" "}
                  All open trades were closed automatically.
                </p>
                <p className="text-xs text-muted-foreground">
                  You can still review this account's details and trade history, but no
                  further trading actions are allowed.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Asset bar */}
        <Card className="p-2 sm:p-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <div className="flex-1 max-w-xs">
              <AssetSelector
                assets={assets}
                selectedAsset={selectedAsset}
                onAssetChange={(asset) => setSelectedAsset(asset as Asset)}
                prices={prices}
              />
            </div>
            {selectedAsset && prices[selectedAsset.symbol] && (
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-lg sm:text-2xl font-bold">
                    {formatPrice(selectedAsset.symbol, prices[selectedAsset.symbol].bid)}
                  </span>
                  {prices[selectedAsset.symbol].isMarketOpen === false && (
                    <Badge variant="outline" className="text-yellow-500 border-yellow-500/50 text-xs">
                      Market Closed
                    </Badge>
                  )}
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="text-red-500">
                    B: {formatPrice(selectedAsset.symbol, prices[selectedAsset.symbol].bid)}
                  </span>
                  <span className="text-green-500">
                    A: {formatPrice(selectedAsset.symbol, prices[selectedAsset.symbol].ask)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Card>

        <Tabs value={view} onValueChange={(v) => setView(v as "trade" | "chart")}>
          <TabsList className="grid w-full max-w-[280px] grid-cols-2">
            <TabsTrigger value="trade">Trade</TabsTrigger>
            <TabsTrigger value="chart">Chart</TabsTrigger>
          </TabsList>

          {/* Chart View - enlarged */}
          <TabsContent value="chart" className="mt-3">
            <Card className="h-[70vh] min-h-[420px] lg:h-[calc(100vh-230px)] overflow-hidden">
              {selectedAsset ? (
                <TradingViewChart
                  symbol={selectedAsset.symbol}
                  positions={openPositions
                    .filter((p) => p.assets?.symbol === selectedAsset.symbol)
                    .map((p) => ({
                      id: p.id,
                      position_type: p.position_type,
                      entry_price: p.entry_price,
                      stop_loss: p.stop_loss,
                      take_profit: p.take_profit,
                      lot_size: p.lot_size,
                    }))}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Select an asset to view chart
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Trade View */}
          <TabsContent value="trade" className="mt-3">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-2 sm:gap-4">
          {/* Order Panel */}
          <div className="lg:col-span-4 order-1">
            <Card className="h-auto overflow-y-auto">
              <CardHeader className="py-2 px-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  New Order
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-3">
                {/* Market Status Warning */}
                {isBlocked && (
                  <div className="p-2 rounded bg-red-500/10 border border-red-500/30 text-red-500 text-xs text-center flex items-center justify-center gap-1">
                    <Lock className="w-3 h-3" />
                    Trading disabled — account failed
                  </div>
                )}
                {selectedAsset && prices[selectedAsset.symbol]?.isMarketOpen === false && (
                  <div className="p-2 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 text-xs text-center">
                    Market Closed - Price Paused
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded bg-red-500/10 border border-red-500/20">
                    <div className="text-xs text-muted-foreground">Sell</div>
                    <div className="font-bold text-red-500 text-sm sm:text-base">
                      {selectedAsset && prices[selectedAsset.symbol]
                        ? formatPrice(selectedAsset.symbol, prices[selectedAsset.symbol].bid)
                        : "-"}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-green-500/10 border border-green-500/20">
                    <div className="text-xs text-muted-foreground">Buy</div>
                    <div className="font-bold text-green-500 text-sm sm:text-base">
                      {selectedAsset && prices[selectedAsset.symbol]
                        ? formatPrice(selectedAsset.symbol, prices[selectedAsset.symbol].ask)
                        : "-"}
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor="lot-size" className="text-xs">
                      Lot Size
                    </Label>
                    <Input
                      id="lot-size"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={lotSize}
                      onChange={(e) => setLotSize(e.target.value)}
                      disabled={isBlocked}
                      className="mt-1 h-9"
                    />
                    <div className="mt-1 flex justify-between text-[10px]">
                      <span className="text-muted-foreground">
                        Margin required: ${pendingMargin.toFixed(2)}
                      </span>
                      <span
                        className={cn(
                          insufficientMargin ? "text-red-500" : "text-muted-foreground"
                        )}
                      >
                        Free margin: ${freeMargin.toFixed(2)}
                      </span>
                    </div>
                    {insufficientMargin && !isBlocked && (
                      <p className="mt-1 text-[10px] text-red-500">
                        Not enough margin for this lot size.
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="stop-loss" className="text-xs">
                        Stop Loss
                      </Label>
                      <Input
                        id="stop-loss"
                        type="number"
                        step="0.0001"
                        placeholder="Optional"
                        value={stopLoss}
                        onChange={(e) => setStopLoss(e.target.value)}
                        disabled={isBlocked}
                        className="mt-1 h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="take-profit" className="text-xs">
                        Take Profit
                      </Label>
                      <Input
                        id="take-profit"
                        type="number"
                        step="0.0001"
                        placeholder="Optional"
                        value={takeProfit}
                        onChange={(e) => setTakeProfit(e.target.value)}
                        disabled={isBlocked}
                        className="mt-1 h-9"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <Button
                    variant="destructive"
                    className="w-full h-10"
                    onClick={() => handlePlaceOrder("sell")}
                    disabled={!selectedAsset || isPlacingOrder || isBlocked || insufficientMargin}
                  >
                    <TrendingDown className="w-4 h-4 mr-1" />
                    SELL
                  </Button>
                  <Button
                    className="w-full h-10 bg-green-600 hover:bg-green-700"
                    onClick={() => handlePlaceOrder("buy")}
                    disabled={!selectedAsset || isPlacingOrder || isBlocked || insufficientMargin}
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    BUY
                  </Button>
                </div>

                {/* Account Summary */}
                <div className="pt-2 border-t border-border space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Account Size</span>
                    <span className="font-medium">
                      ${account?.account_size?.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Balance</span>
                    <span className="font-medium">
                      $
                      {(
                        account?.current_balance ||
                        account?.account_size ||
                        0
                      ).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Unrealized P/L</span>
                    <span
                      className={cn(
                        "font-medium",
                        unrealizedPL >= 0 ? "text-green-500" : "text-red-500"
                      )}
                    >
                      {unrealizedPL >= 0 ? "+" : ""}${unrealizedPL.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Open Positions</span>
                    <span className="font-medium">{openPositions.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Used Margin</span>
                    <span className="font-medium">${usedMargin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Free Margin</span>
                    <span className="font-medium">${freeMargin.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Profit Target & Drawdown Trackers */}
            {account && (
              <div className="mt-3 space-y-3">
                <ProfitTargetTracker
                  accountSize={account.account_size}
                  currentBalance={account.current_balance || account.account_size}
                  unrealizedPL={unrealizedPL}
                  challengeType={account.challenge_type}
                  currentPhase={account.current_phase}
                  phasePassed={!isBlocked && (account.phase_passed || false)}
                  onProceedToNextPhase={handleProceedToNextPhase}
                  isProceeding={isProceeding}
                />
                <DrawdownTracker
                  accountSize={account.account_size}
                  currentBalance={account.current_balance || account.account_size}
                  highWaterMark={account.high_water_mark}
                  dailyStartBalance={account.daily_start_balance}
                  unrealizedPL={unrealizedPL}
                  challengeType={account.challenge_type}
                  currentPhase={account.current_phase}
                />
                {isFundedAccount && (
                  <ConsistencyScoreTracker positions={closedPositions} />
                )}
              </div>
            )}
          </div>

          {/* Positions & History */}
          <div className="lg:col-span-8 order-2">
            <Card>
              <Tabs defaultValue="positions">
                <CardHeader className="py-2 px-3 border-b">
                  <TabsList className="grid w-full max-w-[300px] grid-cols-2">
                    <TabsTrigger value="positions" className="text-xs">
                      Positions ({openPositions.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs">
                      History
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="p-0">
                  <TabsContent value="positions" className="m-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm min-w-[600px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 text-left font-medium">
                              Symbol
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-left font-medium">
                              Type
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              Lots
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              Entry
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              Current
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              P/L
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {openPositions.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-6 text-center text-muted-foreground"
                              >
                                No open positions
                              </td>
                            </tr>
                          ) : (
                            openPositions.map((position) => {
                              const asset = position.assets;
                              const currentPrice = asset
                                ? prices[asset.symbol]
                                : null;
                              const priceNow = currentPrice
                                ? position.position_type === "buy"
                                  ? currentPrice.bid
                                  : currentPrice.ask
                                : 0;
                              
                              // Use proper pip calculation
                              const plCalc = asset && priceNow
                                ? calculatePositionPL(
                                    asset,
                                    position.position_type as 'buy' | 'sell',
                                    position.entry_price,
                                    priceNow,
                                    position.lot_size
                                  )
                                : { pips: 0, profitLoss: 0 };
                              const { pips, profitLoss: pl } = plCalc;

                              return (
                                <tr
                                  key={position.id}
                                  className="border-b border-border/50 hover:bg-muted/30"
                                >
                                  <td className="px-2 sm:px-4 py-2 font-medium">
                                    {asset?.symbol}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2">
                                    <Badge
                                      variant={
                                        position.position_type === "buy"
                                          ? "default"
                                          : "destructive"
                                      }
                                      className="text-[10px] px-1.5"
                                    >
                                      {position.position_type.toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-right">
                                    {position.lot_size}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-right">
                                    {asset
                                      ? formatPrice(asset.symbol, position.entry_price)
                                      : position.entry_price}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-right">
                                    {asset
                                      ? formatPrice(asset.symbol, priceNow)
                                      : priceNow}
                                  </td>
                                  <td
                                    className={cn(
                                      "px-2 sm:px-4 py-2 text-right font-medium",
                                      pl >= 0 ? "text-green-500" : "text-red-500"
                                    )}
                                  >
                                    <div className="flex flex-col items-end">
                                      <span>{pl >= 0 ? "+" : ""}${pl.toFixed(2)}</span>
                                      <span className="text-[10px] text-muted-foreground">
                                        {asset ? formatPips(pips, asset) : `${pips.toFixed(1)} pips`}
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleClosePosition(position)}
                                      disabled={isBlocked}
                                      className="h-7 px-2 text-xs"
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      Close
                                    </Button>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                  <TabsContent value="history" className="m-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm min-w-[500px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-2 sm:px-4 py-2 text-left font-medium">
                              Symbol
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-left font-medium">
                              Type
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              Lots
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              Entry
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              Exit
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-right font-medium">
                              P/L
                            </th>
                            <th className="px-2 sm:px-4 py-2 text-left font-medium">
                              Closed
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {closedPositions.length === 0 ? (
                            <tr>
                              <td
                                colSpan={7}
                                className="px-4 py-6 text-center text-muted-foreground"
                              >
                                No trade history
                              </td>
                            </tr>
                          ) : (
                            closedPositions.map((position) => {
                              const asset = position.assets;
                              return (
                                <tr
                                  key={position.id}
                                  className="border-b border-border/50 hover:bg-muted/30"
                                >
                                  <td className="px-2 sm:px-4 py-2 font-medium">
                                    {asset?.symbol}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2">
                                    <Badge
                                      variant={
                                        position.position_type === "buy"
                                          ? "default"
                                          : "destructive"
                                      }
                                      className="text-[10px] px-1.5"
                                    >
                                      {position.position_type.toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-right">
                                    {position.lot_size}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-right">
                                    {asset
                                      ? formatPrice(asset.symbol, position.entry_price)
                                      : position.entry_price}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-right">
                                    {position.exit_price && asset
                                      ? formatPrice(asset.symbol, position.exit_price)
                                      : "-"}
                                  </td>
                                  <td
                                    className={cn(
                                      "px-2 sm:px-4 py-2 text-right font-medium",
                                      position.profit_loss >= 0
                                        ? "text-green-500"
                                        : "text-red-500"
                                    )}
                                  >
                                    {position.profit_loss >= 0 ? "+" : ""}$
                                    {position.profit_loss.toFixed(2)}
                                  </td>
                                  <td className="px-2 sm:px-4 py-2 text-muted-foreground">
                                    {position.closed_at
                                      ? new Date(position.closed_at).toLocaleDateString()
                                      : "-"}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                </CardContent>
              </Tabs>
            </Card>
          </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
