import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, BarChart3, Clock3, Mail, TrendingDown, TrendingUp, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { ConsistencyScoreTracker } from "@/components/trading/ConsistencyScoreTracker";
import { DrawdownTracker } from "@/components/trading/DrawdownTracker";
import { ProfitTargetTracker } from "@/components/trading/ProfitTargetTracker";
import { useTradingViewPrices } from "@/hooks/useTradingViewPrices";
import { supabase } from "@/integrations/supabase/client";
import { calculatePositionPL } from "@/lib/tradingCalculations";
import { cn } from "@/lib/utils";

interface User {
  id: string;
  email?: string;
  name: string | null;
  lastSignInAt: string | null;
  createdAt: string;
}

interface Account {
  id: string;
  user_id: string;
  account_size: number;
  challenge_type: string;
  status: string;
  current_balance: number | null;
  profit_loss: number | null;
  current_phase: number | null;
  consistency_score: number | null;
  best_trading_day_profit: number | null;
  closed_profit_total: number | null;
  high_water_mark: number | null;
  daily_start_balance: number | null;
  max_drawdown_percent: number | null;
  daily_drawdown_percent: number | null;
  drawdown_violated: boolean | null;
  violation_type: string | null;
  phase_passed: boolean | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

interface Position {
  id: string;
  account_id: string;
  position_type: string;
  lot_size: number;
  profit_loss: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  entry_price: number;
  exit_price: number | null;
  assets?: {
    symbol?: string;
    pip_value?: number | null;
    asset_type?: string;
    quote_currency?: string | null;
    lot_size?: number | null;
  } | null;
}

interface Trade {
  id: string;
  account_id: string;
  symbol: string;
  action: string;
  lot_size: number;
  profit_loss: number | null;
  created_at: string;
  price: number;
}

interface Snapshot {
  users: User[];
  accounts: Account[];
  positions: Position[];
  history: Trade[];
}

const purchasedStatuses = new Set(["active", "funded", "passed", "failed"]);
const money = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const date = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never";
const challengeName = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function TraderDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let firstLoad = true;

    const loadTrader = async () => {
      if (firstLoad) setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      if (session.user.app_metadata?.role !== "admin") {
        navigate("/dashboard", { replace: true });
        return;
      }
      const { data, error: snapshotError } = await supabase.functions.invoke("admin-snapshot");
      if (cancelled) return;
      if (snapshotError || !data) {
        setError(snapshotError?.message || "The trader details could not be loaded.");
      } else {
        setSnapshot(data as Snapshot);
        setError("");
      }
      if (firstLoad) {
        setLoading(false);
        firstLoad = false;
      }
    };
    void loadTrader();

    const refreshInterval = window.setInterval(() => void loadTrader(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
    };
  }, [navigate]);

  const user = snapshot?.users.find((candidate) => candidate.id === userId);
  const accounts = (snapshot?.accounts ?? []).filter((account) => account.user_id === userId && purchasedStatuses.has(account.status));
  const accountIds = new Set(accounts.map((account) => account.id));
  const positions = (snapshot?.positions ?? []).filter((position) => accountIds.has(position.account_id));
  const trades = (snapshot?.history ?? []).filter((trade) => accountIds.has(trade.account_id));
  const symbols = useMemo(
    () => [...new Set(positions.map((position) => position.assets?.symbol).filter((symbol): symbol is string => Boolean(symbol)))],
    [positions],
  );
  const { prices, isConnected } = useTradingViewPrices(symbols);
  const livePositionPL = (position: Position) => {
    if (position.status !== "open" || !position.assets?.symbol) return position.profit_loss ?? 0;
    const quote = prices[position.assets.symbol];
    if (!quote) return position.profit_loss ?? 0;
    const currentPrice = position.position_type.toLowerCase() === "buy" ? quote.bid : quote.ask;
    return calculatePositionPL(
      { ...position.assets, asset_type: position.assets.asset_type ?? "crypto" },
      position.position_type.toLowerCase() as "buy" | "sell",
      position.entry_price,
      currentPrice,
      position.lot_size,
    ).profitLoss;
  };
  const livePLByAccount = useMemo(() => {
    const values = new Map<string, number>();
    positions.filter((position) => position.status === "open").forEach((position) => {
      values.set(position.account_id, (values.get(position.account_id) ?? 0) + livePositionPL(position));
    });
    return values;
  }, [positions, prices]);
  const floatingPL = [...livePLByAccount.values()].reduce((sum, value) => sum + value, 0);
  const closedPositions = positions.filter((position) => position.status !== "open" && position.closed_at);
  const closedTrades = trades.filter((trade) => !["open", "modify"].includes(trade.action));
  const totalPL = accounts.reduce((sum, account) => sum + (account.profit_loss ?? 0), 0);
  const wins = closedTrades.filter((trade) => (trade.profit_loss ?? 0) > 0).length;
  const winRate = closedTrades.length ? Math.round((wins / closedTrades.length) * 100) : 0;
  const bestDay = useMemo(() => {
    const totals = new Map<string, number>();
    closedPositions.forEach((position) => {
      const day = position.closed_at?.slice(0, 10);
      if (day) totals.set(day, (totals.get(day) ?? 0) + Math.max(0, position.profit_loss ?? 0));
    });
    return Math.max(0, ...totals.values());
  }, [closedPositions]);

  if (loading) return <DashboardLayout title="Trader details" subtitle="Loading account review"><div className="py-16 text-center text-muted-foreground">Loading trader details...</div></DashboardLayout>;
  if (error || !user || !accounts.length) return <DashboardLayout title="Trader details" subtitle="Account review"><Card><CardContent className="space-y-4 p-8 text-center"><p className="text-destructive">{error || "This trader has no purchased accounts."}</p><Button variant="outline" onClick={() => navigate("/admin/traders")}><ArrowLeft className="mr-2 h-4 w-4" />Back to Traders</Button></CardContent></Card></DashboardLayout>;

  return (
    <DashboardLayout title="Trader details" subtitle="A complete account and performance review">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="outline" size="icon" aria-label="Back to Traders" onClick={() => navigate("/admin/traders")}><ArrowLeft className="h-4 w-4" /></Button>
            <div><div className="flex items-center gap-2"><UserRound className="h-5 w-5 text-primary" /><h2 className="text-3xl font-bold">{user.name || "Unnamed trader"}</h2></div><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" />{user.email || "No email"} · Joined {date(user.createdAt)}</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-2"><Badge variant="outline" className={cn(isConnected ? "border-success/40 text-success" : "border-warning/40 text-warning")}><span className={cn("mr-2 h-2 w-2 rounded-full", isConnected ? "bg-success" : "bg-warning")} />{isConnected ? "Live prices" : "Connecting to prices"}</Badge><Badge variant="outline"><Clock3 className="mr-2 h-3.5 w-3.5" />Last sign in {date(user.lastSignInAt)}</Badge></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Accounts", value: String(accounts.length), detail: `${accounts.filter((account) => ["active", "funded"].includes(account.status)).length} currently active`, icon: BarChart3 }, { label: "Live equity", value: money(accounts.reduce((sum, account) => sum + (account.current_balance ?? account.account_size), 0) + floatingPL), detail: `${money(floatingPL)} floating P/L`, icon: TrendingUp }, { label: "Account P/L", value: money(totalPL + floatingPL), detail: `${money(floatingPL)} live · ${accounts.length} account${accounts.length === 1 ? "" : "s"}`, icon: totalPL + floatingPL >= 0 ? TrendingUp : TrendingDown }, { label: "Win rate", value: `${winRate}%`, detail: `${closedTrades.length} closed trade${closedTrades.length === 1 ? "" : "s"}`, icon: TrendingUp }].map(({ label, value, detail, icon: Icon }) => <Card key={label} variant="elevated"><CardContent className="p-5"><div className="flex justify-between text-sm text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}
        </div>

        <Card variant="glass"><CardHeader><CardTitle>Performance overview</CardTitle><p className="text-sm text-muted-foreground">Best positive trading day: {money(bestDay)} · {trades.length} recorded trade events · Live floating P/L: <span className={cn("font-semibold", floatingPL >= 0 ? "text-success" : "text-destructive")}>{money(floatingPL)}</span></p></CardHeader><CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => { const accountPositions = positions.filter((position) => position.account_id === account.id); const closed = accountPositions.filter((position) => position.status !== "open"); const unrealized = livePLByAccount.get(account.id) ?? 0; const liveEquity = (account.current_balance ?? account.account_size) + unrealized; return <div key={account.id} className="space-y-4 rounded-lg border border-border/70 bg-background/50 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">${account.account_size.toLocaleString()} {challengeName(account.challenge_type)}</p><p className="mt-1 text-xs text-muted-foreground">Phase {account.current_phase ?? "-"} · Created {new Date(account.created_at).toLocaleDateString()}</p></div><Badge variant={account.status === "failed" ? "destructive" : "outline"}>{account.status.replaceAll("_", " ")}</Badge></div><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Live equity</p><p className="font-semibold">{money(liveEquity)}</p></div><div><p className="text-muted-foreground">Live P/L</p><p className={cn("font-semibold", (account.profit_loss ?? 0) + unrealized >= 0 ? "text-success" : "text-destructive")}>{money((account.profit_loss ?? 0) + unrealized)}</p><p className="text-[10px] text-muted-foreground">{money(unrealized)} floating</p></div><div><p className="text-muted-foreground">Closed positions</p><p className="font-semibold">{closed.length}</p></div><div><p className="text-muted-foreground">Open positions</p><p className="font-semibold">{accountPositions.length - closed.length}</p></div></div><DrawdownTracker accountSize={account.account_size} currentBalance={account.current_balance ?? account.account_size} highWaterMark={account.high_water_mark} dailyStartBalance={account.daily_start_balance} unrealizedPL={unrealized} challengeType={account.challenge_type} currentPhase={account.current_phase} serverMaxDrawdownPercent={account.max_drawdown_percent} serverDailyDrawdownPercent={account.daily_drawdown_percent} serverDrawdownViolated={account.drawdown_violated} /><ProfitTargetTracker accountSize={account.account_size} currentBalance={account.current_balance ?? account.account_size} unrealizedPL={unrealized} challengeType={account.challenge_type} currentPhase={account.current_phase} phasePassed={account.phase_passed ?? false} /><ConsistencyScoreTracker positions={closed.map((position) => ({ profit_loss: position.profit_loss ?? 0, closed_at: position.closed_at }))} serverScore={account.consistency_score} serverBestDayProfit={account.best_trading_day_profit} serverTotalProfit={account.closed_profit_total} /></div>; })}</CardContent></Card>

        <Card><CardHeader><CardTitle>Trade history</CardTitle><p className="text-sm text-muted-foreground">All recorded events for this trader's accounts.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-[45rem] w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Symbol</th><th className="px-4 py-3">Action</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Time</th><th className="px-4 py-3 text-right">P/L</th></tr></thead><tbody>{trades.map((trade) => <tr key={trade.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3 font-medium">{trade.symbol}</td><td className="px-4 py-3"><Badge variant="secondary">{trade.action}</Badge></td><td className="px-4 py-3 font-mono text-xs text-muted-foreground">{trade.account_id.slice(0, 8)}</td><td className="px-4 py-3 text-muted-foreground">{date(trade.created_at)}</td><td className={cn("px-4 py-3 text-right font-medium", (trade.profit_loss ?? 0) >= 0 ? "text-success" : "text-destructive")}>{money(trade.profit_loss ?? 0)}</td></tr>)}</tbody></table></div>{!trades.length && <p className="p-6 text-sm text-muted-foreground">No trade events recorded.</p>}</CardContent></Card>
        <Card><CardHeader><CardTitle>Positions</CardTitle><p className="text-sm text-muted-foreground">Open and closed positions across the trader's accounts. Open positions use live bid/ask pricing.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-[50rem] w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Position</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Size</th><th className="px-4 py-3">Entry / exit</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">P/L</th></tr></thead><tbody>{positions.map((position) => { const positionPL = position.status === "open" ? livePositionPL(position) : (position.profit_loss ?? 0); return <tr key={position.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="font-medium">{position.assets?.symbol || "Unknown asset"}</p><p className="text-xs text-muted-foreground">{position.position_type}</p></td><td className="px-4 py-3 font-mono text-xs text-muted-foreground">{position.account_id.slice(0, 8)}</td><td className="px-4 py-3">{position.lot_size} lots</td><td className="px-4 py-3 text-xs text-muted-foreground">{position.entry_price} / {position.exit_price ?? "-"}</td><td className="px-4 py-3"><Badge variant={position.status === "open" ? "outline" : "secondary"}>{position.status}</Badge></td><td className={cn("px-4 py-3 text-right font-medium", positionPL >= 0 ? "text-success" : "text-destructive")}>{money(positionPL)}</td></tr>; })}</tbody></table></div>{!positions.length && <p className="p-6 text-sm text-muted-foreground">No positions recorded.</p>}</CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
