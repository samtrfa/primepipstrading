import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Gauge,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Account {
  id: string;
  account_size: number;
  current_balance: number | null;
  profit_loss: number | null;
  status: string;
}

interface Trade {
  account_id: string;
  action: string;
  created_at: string;
  profit_loss: number | null;
  symbol: string;
}

const chartTooltipStyle = {
  backgroundColor: "hsl(220 15% 8%)",
  border: "1px solid hsl(220 15% 18%)",
  borderRadius: "8px",
  color: "hsl(45 30% 95%)",
};

const balanceColors = ["#d6a940", "#7ac7a4", "#7d9cff", "#d77a88", "#a990d8"];

const formatMoney = (value: number, compact = false) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);

export default function Analytics() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAnalytics = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const [{ data: accountData }, { data: tradeData }] = await Promise.all([
        supabase.from("accounts").select("id, account_size, current_balance, profit_loss, status"),
        supabase
          .from("trade_history")
          .select("account_id, action, created_at, profit_loss, symbol")
          .order("created_at", { ascending: true }),
      ]);

      setAccounts(accountData || []);
      setTrades(tradeData || []);
      setLoading(false);
    };

    fetchAnalytics();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/login");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const activeAccounts = accounts.filter((account) => account.status === "active" || account.status === "funded");
  const closedTrades = trades.filter((trade) => trade.action !== "open" && trade.action !== "modify");
  const totalBalance = activeAccounts.reduce((sum, account) => sum + (account.current_balance || account.account_size), 0);
  const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0);
  const winners = closedTrades.filter((trade) => (trade.profit_loss || 0) > 0);
  const losers = closedTrades.filter((trade) => (trade.profit_loss || 0) < 0);
  const winRate = closedTrades.length ? Math.round((winners.length / closedTrades.length) * 100) : 0;
  const averageWin = winners.length ? winners.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0) / winners.length : 0;
  const averageLoss = losers.length ? Math.abs(losers.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0) / losers.length) : 0;

  const equityData = useMemo(() => {
    let equity = activeAccounts.reduce((sum, account) => sum + account.account_size, 0);
    const points = [{ label: "Start", equity }];
    closedTrades.forEach((trade, index) => {
      equity += trade.profit_loss || 0;
      points.push({ label: `T${index + 1}`, equity });
    });
    return points.length > 1 ? points : [{ label: "Start", equity }, { label: "Now", equity: totalBalance }];
  }, [activeAccounts, closedTrades, totalBalance]);

  const balanceData = activeAccounts.map((account, index) => ({
    name: `Account ${index + 1}`,
    value: account.current_balance || account.account_size,
  }));

  const instrumentData = useMemo(() => {
    const grouped = closedTrades.reduce<Record<string, number>>((result, trade) => {
      result[trade.symbol] = (result[trade.symbol] || 0) + (trade.profit_loss || 0);
      return result;
    }, {});
    return Object.entries(grouped).sort(([, first], [, second]) => second - first).slice(0, 6).map(([symbol, pnl]) => ({ symbol, pnl }));
  }, [closedTrades]);

  const calendarData = useMemo(() => {
    const byDay = closedTrades.reduce<Record<string, number>>((result, trade) => {
      const day = new Date(trade.created_at).toISOString().slice(0, 10);
      result[day] = (result[day] || 0) + (trade.profit_loss || 0);
      return result;
    }, {});
    return Array.from({ length: 35 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (34 - index));
      const key = date.toISOString().slice(0, 10);
      return { key, value: byDay[key] || 0, label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }) };
    });
  }, [closedTrades]);

  if (loading) {
    return <DashboardLayout title="Analytics" subtitle="Your performance, at a glance"><div className="flex items-center justify-center py-24 text-muted-foreground">Loading analytics...</div></DashboardLayout>;
  }

  if (!activeAccounts.length) {
    return (
      <DashboardLayout title="Analytics" subtitle="Your performance, at a glance">
        <Card variant="glass" className="mx-auto max-w-xl text-center">
          <CardContent className="space-y-4 p-10">
            <BarChart3 className="mx-auto h-12 w-12 text-primary" />
            <h2 className="text-2xl font-bold">Your analytics will appear here</h2>
            <p className="text-muted-foreground">Activate an account and start trading to unlock your performance breakdown.</p>
            <button className="rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground" onClick={() => navigate("/purchase")}>Get an account</button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Analytics" subtitle="Turn your trading history into a clearer edge.">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Performance cockpit</p>
            <h2 className="text-3xl font-bold tracking-tight">The numbers behind your next move</h2>
          </div>
          <Badge className="border border-success/20 bg-success/10 px-3 py-1.5 text-success"><Activity className="mr-2 h-3.5 w-3.5" />Live account data</Badge>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total equity", value: formatMoney(totalBalance, true), detail: `${activeAccounts.length} active account${activeAccounts.length === 1 ? "" : "s"}`, icon: CircleDollarSign, tone: "text-primary" },
            { label: "Net P/L", value: `${totalPnl >= 0 ? "+" : "-"}${formatMoney(Math.abs(totalPnl), true)}`, detail: `${closedTrades.length} closed trade${closedTrades.length === 1 ? "" : "s"}`, icon: totalPnl >= 0 ? TrendingUp : TrendingDown, tone: totalPnl >= 0 ? "text-success" : "text-destructive" },
            { label: "Win rate", value: `${winRate}%`, detail: `${winners.length} wins / ${losers.length} losses`, icon: Target, tone: "text-blue-300" },
            { label: "Profit factor", value: averageLoss ? (averageWin / averageLoss).toFixed(2) : "—", detail: "Avg win vs avg loss", icon: Gauge, tone: "text-violet-300" },
          ].map(({ label, value, detail, icon: Icon, tone }) => (
            <Card key={label} variant="elevated"><CardContent className="p-5">
              <div className="mb-5 flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><Icon className={cn("h-5 w-5", tone)} /></div>
              <div className="text-3xl font-bold tracking-tight">{value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div>
            </CardContent></Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Card variant="elevated"><CardHeader className="flex-row items-start justify-between"><div><CardTitle>Equity curve</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cumulative closed-trade performance</p></div><span className="text-sm font-semibold text-success">{formatMoney(totalPnl, true)}</span></CardHeader><CardContent>
            <div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={equityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d6a940" stopOpacity={0.3} /><stop offset="100%" stopColor="#d6a940" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="hsl(220 15% 18%)" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatMoney(value, true)} width={58} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatMoney(value), "Equity"]} /><Area type="monotone" dataKey="equity" stroke="#d6a940" strokeWidth={3} fill="url(#equityFill)" /></AreaChart></ResponsiveContainer></div>
          </CardContent></Card>

          <Card variant="elevated"><CardHeader><CardTitle>Balance allocation</CardTitle><p className="text-sm text-muted-foreground">Equity across active accounts</p></CardHeader><CardContent><div className="h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={balanceData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={3} stroke="none">{balanceData.map((entry, index) => <Cell key={entry.name} fill={balanceColors[index % balanceColors.length]} />)}</Pie><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatMoney(value), "Balance"]} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{balanceData.map((item, index) => <div key={item.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: balanceColors[index % balanceColors.length] }} />{item.name}</span><span className="font-medium">{formatMoney(item.value)}</span></div>)}</div></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Card variant="elevated"><CardHeader><CardTitle>Daily P/L rhythm</CardTitle><p className="text-sm text-muted-foreground">The last 35 trading days</p></CardHeader><CardContent><div className="mb-4 grid grid-cols-7 gap-1.5 sm:gap-2">{calendarData.map((day) => { const intensity = Math.min(Math.abs(day.value) / Math.max(averageWin, averageLoss, 1), 1); return <div key={day.key} title={`${day.label}: ${day.value >= 0 ? "+" : "-"}${formatMoney(Math.abs(day.value))}`} className={cn("aspect-square rounded-sm border border-border/30 transition-colors", day.value === 0 ? "bg-secondary" : day.value > 0 ? "bg-success" : "bg-destructive")} style={{ opacity: day.value === 0 ? 1 : 0.3 + intensity * 0.7 }} />; })}</div><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Less active</span><div className="flex gap-1"><span className="h-3 w-3 rounded-sm bg-secondary" /><span className="h-3 w-3 rounded-sm bg-success/50" /><span className="h-3 w-3 rounded-sm bg-success" /></div><span>More active</span></div></CardContent></Card>
          <Card variant="elevated"><CardHeader><CardTitle>By instrument</CardTitle><p className="text-sm text-muted-foreground">Where your P/L is coming from</p></CardHeader><CardContent><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={instrumentData} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}><CartesianGrid stroke="hsl(220 15% 18%)" strokeDasharray="4 4" horizontal={false} /><XAxis type="number" hide /><YAxis dataKey="symbol" type="category" tick={{ fill: "hsl(220 10% 70%)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatMoney(value), "P/L"]} /><Bar dataKey="pnl" radius={[0, 4, 4, 0]} fill="#d6a940" /></BarChart></ResponsiveContainer></div>{!instrumentData.length && <p className="pt-4 text-sm text-muted-foreground">Instrument breakdown appears after your first closed trade.</p>}</CardContent></Card>
        </div>

        <Card variant="glass" className="border-primary/20"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2.5"><CalendarDays className="h-5 w-5 text-primary" /></div><div><p className="font-semibold">Protect the process</p><p className="text-sm text-muted-foreground">Keep your daily losses small and let your best sessions compound.</p></div></div><div className="flex gap-5 text-sm"><span className="text-muted-foreground"><ArrowUpRight className="mr-1 inline h-4 w-4 text-success" />Best day <strong className="text-foreground">{formatMoney(Math.max(...calendarData.map((day) => day.value), 0))}</strong></span><span className="text-muted-foreground"><ArrowDownRight className="mr-1 inline h-4 w-4 text-destructive" />Worst day <strong className="text-foreground">{formatMoney(Math.min(...calendarData.map((day) => day.value), 0))}</strong></span></div></CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
