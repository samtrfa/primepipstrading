import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  ArrowLeft,
  RefreshCw,
  DollarSign,
  BarChart3,
  Clock,
  Target,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  X,
  Activity,
} from "lucide-react";

interface Account {
  id: string;
  account_size: number;
  current_balance: number;
  profit_loss: number;
  challenge_type: string;
  status: string;
  current_phase: number | null;
}

interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  pip_value: number;
}

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

// Simulated price data
const generatePrice = (basePrice: number) => {
  const change = (Math.random() - 0.5) * 0.002;
  return basePrice * (1 + change);
};

const basePrices: Record<string, number> = {
  EURUSD: 1.0875,
  GBPUSD: 1.2650,
  USDJPY: 149.50,
  AUDUSD: 0.6580,
  USDCAD: 1.3520,
  XAUUSD: 2345.50,
  BTCUSD: 67500,
  ETHUSD: 3450,
  US30: 39250,
  US100: 17850,
  US500: 5150,
};

export default function TradingPlatform() {
  const { accountId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [account, setAccount] = useState<Account | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [prices, setPrices] = useState<Record<string, { bid: number; ask: number }>>({}); 
  const [lotSize, setLotSize] = useState("0.01");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Initialize prices
  useEffect(() => {
    const initialPrices: Record<string, { bid: number; ask: number }> = {};
    Object.entries(basePrices).forEach(([symbol, price]) => {
      const spread = symbol.includes("JPY") ? 0.02 : symbol === "XAUUSD" ? 0.5 : symbol.includes("BTC") ? 50 : 0.0003;
      initialPrices[symbol] = { bid: price, ask: price + spread };
    });
    setPrices(initialPrices);
  }, []);

  // Simulate price updates
  useEffect(() => {
    const interval = setInterval(() => {
      setPrices(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(symbol => {
          const basePrice = basePrices[symbol] || updated[symbol].bid;
          const newBid = generatePrice(updated[symbol].bid);
          const spread = symbol.includes("JPY") ? 0.02 : symbol === "XAUUSD" ? 0.5 : symbol.includes("BTC") ? 50 : 0.0003;
          updated[symbol] = { bid: newBid, ask: newBid + spread };
        });
        return updated;
      });
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Fetch account and positions
  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
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

      if (accountData.status !== "active" && accountData.status !== "funded") {
        toast({ title: "Account not active", description: "This account is not available for trading", variant: "destructive" });
        navigate("/dashboard");
        return;
      }

      setAccount(accountData);

      // Fetch assets
      const { data: assetsData } = await supabase
        .from("assets")
        .select("*")
        .eq("is_active", true)
        .order("symbol");

      if (assetsData) {
        setAssets(assetsData);
        setSelectedAsset(assetsData[0] || null);
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

  // Calculate unrealized P/L for open positions
  const calculateUnrealizedPL = useCallback(() => {
    return positions
      .filter(p => p.status === "open")
      .reduce((total, position) => {
        const asset = position.assets;
        if (!asset) return total;
        
        const currentPrice = prices[asset.symbol];
        if (!currentPrice) return total;

        const priceNow = position.position_type === "buy" ? currentPrice.bid : currentPrice.ask;
        const priceDiff = position.position_type === "buy" 
          ? priceNow - position.entry_price 
          : position.entry_price - priceNow;
        
        const pipValue = asset.pip_value || 0.0001;
        const pips = priceDiff / pipValue;
        const pl = pips * position.lot_size * 10; // Simplified P/L calculation
        
        return total + pl;
      }, 0);
  }, [positions, prices]);

  const handlePlaceOrder = async (type: "buy" | "sell") => {
    if (!selectedAsset || !account) return;

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
      toast({ title: "Failed to place order", description: positionError.message, variant: "destructive" });
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

    setPositions(prev => [positionData, ...prev]);
    toast({
      title: `${type.toUpperCase()} Order Placed`,
      description: `${selectedAsset.symbol} @ ${entryPrice.toFixed(selectedAsset.symbol.includes("JPY") ? 3 : 5)}`,
    });

    setStopLoss("");
    setTakeProfit("");
    setIsPlacingOrder(false);
  };

  const handleClosePosition = async (position: Position) => {
    if (!account || !position.assets) return;

    const currentPrice = prices[position.assets.symbol];
    if (!currentPrice) return;

    const exitPrice = position.position_type === "buy" ? currentPrice.bid : currentPrice.ask;
    const priceDiff = position.position_type === "buy" 
      ? exitPrice - position.entry_price 
      : position.entry_price - exitPrice;
    
    const pipValue = position.assets.pip_value || 0.0001;
    const pips = priceDiff / pipValue;
    const profitLoss = pips * position.lot_size * 10;

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

    // Update account balance
    const newBalance = (account.current_balance || account.account_size) + profitLoss;
    const newPL = (account.profit_loss || 0) + profitLoss;

    await supabase
      .from("accounts")
      .update({ current_balance: newBalance, profit_loss: newPL })
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
    });

    setAccount(prev => prev ? { ...prev, current_balance: newBalance, profit_loss: newPL } : null);
    setPositions(prev => prev.map(p => 
      p.id === position.id 
        ? { ...p, status: "closed", exit_price: exitPrice, profit_loss: profitLoss, closed_at: new Date().toISOString() }
        : p
    ));

    toast({
      title: "Position Closed",
      description: `${position.assets.symbol} P/L: ${profitLoss >= 0 ? "+" : ""}$${profitLoss.toFixed(2)}`,
      variant: profitLoss >= 0 ? "default" : "destructive",
    });
  };

  const unrealizedPL = calculateUnrealizedPL();
  const equity = account ? (account.current_balance || account.account_size) + unrealizedPL : 0;
  const openPositions = positions.filter(p => p.status === "open");
  const closedPositions = positions.filter(p => p.status === "closed");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary" />
                <span className="font-semibold">Trading Platform</span>
              </div>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Balance:</span>
                <span className="font-bold">${(account?.current_balance || account?.account_size || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Equity:</span>
                <span className="font-bold">${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">P/L:</span>
                <span className={cn("font-bold", (account?.profit_loss || 0) >= 0 ? "text-green-500" : "text-red-500")}>
                  {(account?.profit_loss || 0) >= 0 ? "+" : ""}${(account?.profit_loss || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">
        <div className="grid grid-cols-12 gap-4">
          {/* Market Watch */}
          <div className="col-span-12 lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Market Watch
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[600px] overflow-y-auto">
                  {assets.map(asset => {
                    const price = prices[asset.symbol];
                    const isSelected = selectedAsset?.id === asset.id;
                    return (
                      <button
                        key={asset.id}
                        onClick={() => setSelectedAsset(asset)}
                        className={cn(
                          "w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border/50",
                          isSelected && "bg-primary/10 border-l-2 border-l-primary"
                        )}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium text-sm">{asset.symbol}</span>
                          <Badge variant="outline" className="text-[10px] px-1">
                            {asset.asset_type}
                          </Badge>
                        </div>
                        {price && (
                          <div className="flex justify-between text-xs mt-1">
                            <span className="text-red-500">{price.bid.toFixed(asset.symbol.includes("JPY") ? 3 : asset.symbol.includes("BTC") ? 1 : 5)}</span>
                            <span className="text-green-500">{price.ask.toFixed(asset.symbol.includes("JPY") ? 3 : asset.symbol.includes("BTC") ? 1 : 5)}</span>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Area */}
          <div className="col-span-12 lg:col-span-7">
            <Card className="h-full">
              <CardHeader className="py-3 border-b">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{selectedAsset?.symbol || "Select Asset"}</CardTitle>
                    {selectedAsset && prices[selectedAsset.symbol] && (
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold">
                          {prices[selectedAsset.symbol].bid.toFixed(selectedAsset.symbol.includes("JPY") ? 3 : selectedAsset.symbol.includes("BTC") ? 1 : 5)}
                        </span>
                        <Badge variant="outline" className="text-green-500">
                          <ChevronUp className="w-3 h-3" />
                          0.12%
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {["1M", "5M", "15M", "1H", "4H", "1D"].map(tf => (
                      <Button key={tf} variant="ghost" size="sm" className="text-xs px-2">
                        {tf}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                {/* Simulated Chart */}
                <div className="h-[400px] bg-gradient-to-b from-card to-muted/20 rounded-lg flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 opacity-20">
                    {Array.from({ length: 50 }).map((_, i) => (
                      <div
                        key={i}
                        className="absolute bg-primary/30"
                        style={{
                          left: `${i * 2}%`,
                          bottom: 0,
                          width: "1.5%",
                          height: `${20 + Math.random() * 60}%`,
                          borderRadius: "2px 2px 0 0",
                        }}
                      />
                    ))}
                  </div>
                  <div className="text-center z-10">
                    <Activity className="w-12 h-12 text-primary mx-auto mb-2" />
                    <p className="text-muted-foreground text-sm">Live chart visualization</p>
                    <p className="text-xs text-muted-foreground mt-1">Prices update in real-time</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Panel */}
          <div className="col-span-12 lg:col-span-3">
            <Card>
              <CardHeader className="py-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  New Order
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Symbol</Label>
                  <div className="font-bold text-lg">{selectedAsset?.symbol || "-"}</div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="text-center p-2 rounded bg-red-500/10 border border-red-500/20">
                    <div className="text-xs text-muted-foreground">Sell</div>
                    <div className="font-bold text-red-500">
                      {selectedAsset && prices[selectedAsset.symbol]
                        ? prices[selectedAsset.symbol].bid.toFixed(selectedAsset.symbol.includes("JPY") ? 3 : 5)
                        : "-"}
                    </div>
                  </div>
                  <div className="text-center p-2 rounded bg-green-500/10 border border-green-500/20">
                    <div className="text-xs text-muted-foreground">Buy</div>
                    <div className="font-bold text-green-500">
                      {selectedAsset && prices[selectedAsset.symbol]
                        ? prices[selectedAsset.symbol].ask.toFixed(selectedAsset.symbol.includes("JPY") ? 3 : 5)
                        : "-"}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="lot-size" className="text-xs">Lot Size</Label>
                    <Input
                      id="lot-size"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={lotSize}
                      onChange={e => setLotSize(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="stop-loss" className="text-xs">Stop Loss</Label>
                      <Input
                        id="stop-loss"
                        type="number"
                        step="0.0001"
                        placeholder="Optional"
                        value={stopLoss}
                        onChange={e => setStopLoss(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="take-profit" className="text-xs">Take Profit</Label>
                      <Input
                        id="take-profit"
                        type="number"
                        step="0.0001"
                        placeholder="Optional"
                        value={takeProfit}
                        onChange={e => setTakeProfit(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => handlePlaceOrder("sell")}
                    disabled={!selectedAsset || isPlacingOrder}
                  >
                    <TrendingDown className="w-4 h-4 mr-1" />
                    SELL
                  </Button>
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700"
                    onClick={() => handlePlaceOrder("buy")}
                    disabled={!selectedAsset || isPlacingOrder}
                  >
                    <TrendingUp className="w-4 h-4 mr-1" />
                    BUY
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Account Info */}
            <Card className="mt-4">
              <CardHeader className="py-3 border-b">
                <CardTitle className="text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Account Info
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Account Size</span>
                  <span className="font-medium">${account?.account_size?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Balance</span>
                  <span className="font-medium">${(account?.current_balance || account?.account_size || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Unrealized P/L</span>
                  <span className={cn("font-medium", unrealizedPL >= 0 ? "text-green-500" : "text-red-500")}>
                    {unrealizedPL >= 0 ? "+" : ""}${unrealizedPL.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Equity</span>
                  <span className="font-bold">${equity.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Open Positions</span>
                  <span className="font-medium">{openPositions.length}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Positions & History */}
          <div className="col-span-12">
            <Card>
              <Tabs defaultValue="positions">
                <CardHeader className="py-2 border-b">
                  <TabsList className="grid w-[300px] grid-cols-2">
                    <TabsTrigger value="positions" className="text-xs">
                      Open Positions ({openPositions.length})
                    </TabsTrigger>
                    <TabsTrigger value="history" className="text-xs">
                      Trade History
                    </TabsTrigger>
                  </TabsList>
                </CardHeader>
                <CardContent className="p-0">
                  <TabsContent value="positions" className="m-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Symbol</th>
                            <th className="px-4 py-2 text-left font-medium">Type</th>
                            <th className="px-4 py-2 text-right font-medium">Lots</th>
                            <th className="px-4 py-2 text-right font-medium">Entry</th>
                            <th className="px-4 py-2 text-right font-medium">Current</th>
                            <th className="px-4 py-2 text-right font-medium">SL</th>
                            <th className="px-4 py-2 text-right font-medium">TP</th>
                            <th className="px-4 py-2 text-right font-medium">P/L</th>
                            <th className="px-4 py-2 text-right font-medium">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {openPositions.length === 0 ? (
                            <tr>
                              <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                                No open positions
                              </td>
                            </tr>
                          ) : (
                            openPositions.map(position => {
                              const asset = position.assets;
                              const currentPrice = asset ? prices[asset.symbol] : null;
                              const priceNow = currentPrice 
                                ? (position.position_type === "buy" ? currentPrice.bid : currentPrice.ask)
                                : 0;
                              const priceDiff = position.position_type === "buy" 
                                ? priceNow - position.entry_price 
                                : position.entry_price - priceNow;
                              const pipValue = asset?.pip_value || 0.0001;
                              const pips = priceDiff / pipValue;
                              const pl = pips * position.lot_size * 10;
                              const decimals = asset?.symbol.includes("JPY") ? 3 : asset?.symbol.includes("BTC") ? 1 : 5;

                              return (
                                <tr key={position.id} className="border-b border-border/50 hover:bg-muted/30">
                                  <td className="px-4 py-2 font-medium">{asset?.symbol}</td>
                                  <td className="px-4 py-2">
                                    <Badge variant={position.position_type === "buy" ? "default" : "destructive"} className="text-xs">
                                      {position.position_type.toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2 text-right">{position.lot_size}</td>
                                  <td className="px-4 py-2 text-right">{position.entry_price.toFixed(decimals)}</td>
                                  <td className="px-4 py-2 text-right">{priceNow.toFixed(decimals)}</td>
                                  <td className="px-4 py-2 text-right text-muted-foreground">
                                    {position.stop_loss?.toFixed(decimals) || "-"}
                                  </td>
                                  <td className="px-4 py-2 text-right text-muted-foreground">
                                    {position.take_profit?.toFixed(decimals) || "-"}
                                  </td>
                                  <td className={cn("px-4 py-2 text-right font-medium", pl >= 0 ? "text-green-500" : "text-red-500")}>
                                    {pl >= 0 ? "+" : ""}${pl.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2 text-right">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleClosePosition(position)}
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
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium">Symbol</th>
                            <th className="px-4 py-2 text-left font-medium">Type</th>
                            <th className="px-4 py-2 text-right font-medium">Lots</th>
                            <th className="px-4 py-2 text-right font-medium">Entry</th>
                            <th className="px-4 py-2 text-right font-medium">Exit</th>
                            <th className="px-4 py-2 text-right font-medium">P/L</th>
                            <th className="px-4 py-2 text-left font-medium">Closed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {closedPositions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                                No trade history
                              </td>
                            </tr>
                          ) : (
                            closedPositions.map(position => {
                              const asset = position.assets;
                              const decimals = asset?.symbol.includes("JPY") ? 3 : asset?.symbol.includes("BTC") ? 1 : 5;
                              return (
                                <tr key={position.id} className="border-b border-border/50 hover:bg-muted/30">
                                  <td className="px-4 py-2 font-medium">{asset?.symbol}</td>
                                  <td className="px-4 py-2">
                                    <Badge variant={position.position_type === "buy" ? "default" : "destructive"} className="text-xs">
                                      {position.position_type.toUpperCase()}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-2 text-right">{position.lot_size}</td>
                                  <td className="px-4 py-2 text-right">{position.entry_price.toFixed(decimals)}</td>
                                  <td className="px-4 py-2 text-right">{position.exit_price?.toFixed(decimals) || "-"}</td>
                                  <td className={cn("px-4 py-2 text-right font-medium", position.profit_loss >= 0 ? "text-green-500" : "text-red-500")}>
                                    {position.profit_loss >= 0 ? "+" : ""}${position.profit_loss.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-2 text-muted-foreground">
                                    {position.closed_at ? new Date(position.closed_at).toLocaleString() : "-"}
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
      </div>
    </div>
  );
}
