import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
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
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  position_id: string | null;
  profit_loss: number | null;
  symbol: string;
}

interface PositionTime {
  opened_at: string;
  closed_at: string | null;
}

const equityRanges = [
  { label: "1D", days: 1 },
  { label: "7D", days: 7 },
  { label: "14D", days: 14 },
  { label: "1M", days: 30 },
] as const;

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
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDuration = (openedAt: string | undefined, closedAt: string | undefined) => {
  if (!openedAt || !closedAt) return "Not available";
  const totalMinutes = Math.max(0, Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}h:${String(minutes).padStart(2, "0")}m`;
};

export default function Analytics() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positionTimes, setPositionTimes] = useState<Record<string, PositionTime>>({});
  const [loading, setLoading] = useState(true);
  const [equityRange, setEquityRange] = useState<(typeof equityRanges)[number]["days"]>(7);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{ label: string; value: number; trades: Trade[] } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchAnalytics = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const [{ data: accountData }, { data: tradeData }, { data: positionData }] = await Promise.all([
        supabase.from("accounts").select("id, account_size, current_balance, profit_loss, status"),
        supabase
          .from("trade_history")
          .select("account_id, action, created_at, position_id, profit_loss, symbol")
          .order("created_at", { ascending: true }),
        supabase.from("positions").select("id, opened_at, closed_at"),
      ]);

      setAccounts(accountData || []);
      setTrades(tradeData || []);
      setPositionTimes(Object.fromEntries((positionData || []).map((position) => [position.id, { opened_at: position.opened_at, closed_at: position.closed_at }])));
      setLoading(false);
    };

    fetchAnalytics();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/login");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const activeAccounts = accounts.filter((account) => account.status === "active" || account.status === "funded");
  const selectedAccount = activeAccounts.find((account) => account.id === selectedAccountId) || activeAccounts[0];
  const accountTrades = selectedAccount ? trades.filter((trade) => trade.account_id === selectedAccount.id) : [];
  const closedTrades = accountTrades.filter((trade) => trade.action !== "open" && trade.action !== "modify");
  const totalBalance = selectedAccount?.current_balance || selectedAccount?.account_size || 0;
  const totalPnl = closedTrades.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0);
  const winners = closedTrades.filter((trade) => (trade.profit_loss || 0) > 0);
  const losers = closedTrades.filter((trade) => (trade.profit_loss || 0) < 0);
  const winRate = closedTrades.length ? Math.round((winners.length / closedTrades.length) * 100) : 0;
  const averageWin = winners.length ? winners.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0) / winners.length : 0;
  const averageLoss = losers.length ? Math.abs(losers.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0) / losers.length) : 0;

  const equityData = useMemo(() => {
    const cutoff = Date.now() - equityRange * 24 * 60 * 60 * 1000;
    const priorTrades = closedTrades.filter((trade) => new Date(trade.created_at).getTime() < cutoff);
    const rangeTrades = closedTrades.filter((trade) => new Date(trade.created_at).getTime() >= cutoff);
    let equity = (selectedAccount?.account_size || 0) + priorTrades.reduce((sum, trade) => sum + (trade.profit_loss || 0), 0);
    let peakEquity = equity;
    const points = [{ label: "Start", equity, drawdown: 0 }];
    rangeTrades.forEach((trade) => {
      equity += trade.profit_loss || 0;
      peakEquity = Math.max(peakEquity, equity);
      points.push({ label: new Date(trade.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }), equity, drawdown: Math.max(0, peakEquity - equity) });
    });
    return points.length > 1 ? points : [{ label: "Start", equity, drawdown: 0 }, { label: "Now", equity: totalBalance, drawdown: Math.max(0, equity - totalBalance) }];
  }, [closedTrades, equityRange, selectedAccount, totalBalance]);

  const balanceData = selectedAccount ? [{
    name: `Account ${activeAccounts.indexOf(selectedAccount) + 1}`,
    value: selectedAccount.current_balance || selectedAccount.account_size,
  }] : [];

  const instrumentData = useMemo(() => {
    const grouped = closedTrades.reduce<Record<string, number>>((result, trade) => {
      result[trade.symbol] = (result[trade.symbol] || 0) + (trade.profit_loss || 0);
      return result;
    }, {});
    return Object.entries(grouped).sort(([, first], [, second]) => second - first).slice(0, 6).map(([symbol, pnl]) => ({ symbol, pnl }));
  }, [closedTrades]);

  const calendarData = useMemo(() => {
    const byDay = closedTrades.reduce<Record<string, { value: number; trades: number }>>((result, trade) => {
      const day = new Date(trade.created_at).toISOString().slice(0, 10);
      result[day] = result[day] || { value: 0, trades: 0 };
      result[day].value += trade.profit_loss || 0;
      result[day].trades += 1;
      return result;
    }, {});
    const [year, month] = calendarMonth.split("-").map(Number);
    const firstDay = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const leadingDays = firstDay.getDay();
    return Array.from({ length: Math.ceil((leadingDays + daysInMonth) / 7) * 7 }, (_, index) => {
      const date = new Date(year, month - 1, index - leadingDays + 1);
      const key = date.toISOString().slice(0, 10);
      return { key, value: byDay[key]?.value || 0, trades: byDay[key]?.trades || 0, tradeDetails: closedTrades.filter((trade) => new Date(trade.created_at).toISOString().slice(0, 10) === key), traded: Object.hasOwn(byDay, key), label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }), day: date.getDate(), inMonth: date.getMonth() === month - 1 };
    });
  }, [calendarMonth, closedTrades]);

  const monthlyPnl = calendarData.filter((day) => day.inMonth).reduce((sum, day) => sum + day.value, 0);
  const calendarWeeks = Array.from({ length: calendarData.length / 7 }, (_, index) => calendarData.slice(index * 7, index * 7 + 7));

  const currentMonth = new Date();
  const isCurrentMonth = calendarMonth === `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}`;
  const displayedMonth = new Date(`${calendarMonth}-01T00:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" });

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
          <div className="flex items-center gap-3"><label htmlFor="analytics-account" className="text-sm text-muted-foreground">Account</label><select id="analytics-account" value={selectedAccount?.id || ""} onChange={(event) => setSelectedAccountId(event.target.value)} className="h-10 min-w-44 rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring">{activeAccounts.map((account, index) => <option key={account.id} value={account.id}>Account {index + 1} · {formatMoney(account.account_size, true)}</option>)}</select><Badge className="border border-success/20 bg-success/10 px-3 py-1.5 text-success"><Activity className="mr-2 h-3.5 w-3.5" />Live account data</Badge></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total equity", value: formatMoney(totalBalance, true), detail: "Selected account", icon: CircleDollarSign, tone: "text-primary" },
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
          <Card variant="elevated"><CardHeader className="flex-row items-start justify-between gap-4"><div><CardTitle>Equity curve</CardTitle><p className="mt-1 text-sm text-muted-foreground">Cumulative closed-trade performance</p></div><div className="flex shrink-0 items-center gap-3"><div className="flex rounded-lg border border-border/60 bg-secondary/40 p-1" role="group" aria-label="Equity curve range">{equityRanges.map((range) => <button key={range.days} type="button" onClick={() => setEquityRange(range.days)} aria-pressed={equityRange === range.days} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold transition-colors", equityRange === range.days ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{range.label}</button>)}</div><span className="text-sm font-semibold text-success">{formatMoney(totalPnl, true)}</span></div></CardHeader><CardContent>
            <div className="h-[280px] w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={equityData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#d6a940" stopOpacity={0.3} /><stop offset="100%" stopColor="#d6a940" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="hsl(220 15% 18%)" strokeDasharray="4 4" vertical={false} /><XAxis dataKey="label" tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis yAxisId="equity" tick={{ fill: "hsl(220 10% 55%)", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatMoney(value, true)} width={58} /><YAxis yAxisId="drawdown" orientation="right" tick={{ fill: "#d77a88", fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => formatMoney(value, true)} width={58} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number, name: string) => [formatMoney(value), name === "drawdown" ? "Drawdown" : "Equity"]} /><Area yAxisId="equity" type="monotone" dataKey="equity" stroke="#d6a940" strokeWidth={3} fill="url(#equityFill)" /><Line yAxisId="drawdown" type="monotone" dataKey="drawdown" stroke="#d77a88" strokeWidth={2} dot={false} /></AreaChart></ResponsiveContainer></div>
          </CardContent></Card>

          <Card variant="elevated"><CardHeader><CardTitle>Account balance</CardTitle><p className="text-sm text-muted-foreground">Equity for the selected account</p></CardHeader><CardContent><div className="h-[190px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={balanceData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={80} paddingAngle={3} stroke="none">{balanceData.map((entry, index) => <Cell key={entry.name} fill={balanceColors[index % balanceColors.length]} />)}</Pie><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatMoney(value), "Balance"]} /></PieChart></ResponsiveContainer></div><div className="space-y-2">{balanceData.map((item, index) => <div key={item.name} className="flex items-center justify-between text-sm"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: balanceColors[index % balanceColors.length] }} />{item.name}</span><span className="font-medium">{formatMoney(item.value)}</span></div>)}</div></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Card variant="elevated" className="xl:col-span-2"><CardHeader className="flex flex-wrap items-center justify-between gap-4"><div><CardTitle>Trading Calendar</CardTitle><p className={cn("mt-2 text-sm", monthlyPnl >= 0 ? "text-success" : "text-destructive")}>Monthly PnL: {monthlyPnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(monthlyPnl))}</p></div><div className="flex items-center gap-2"><button type="button" aria-label="Previous month" title="Previous month" onClick={() => { const date = new Date(`${calendarMonth}-01T00:00:00`); date.setMonth(date.getMonth() - 1); setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><ChevronLeft className="h-4 w-4" /></button><span className="min-w-32 text-center text-base font-semibold">{displayedMonth}</span><button type="button" aria-label="Next month" title="Next month" disabled={isCurrentMonth} onClick={() => { const date = new Date(`${calendarMonth}-01T00:00:00`); date.setMonth(date.getMonth() + 1); setCalendarMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button></div><button type="button" onClick={() => { const now = new Date(); setCalendarMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`); }} className="rounded-md border border-primary px-4 py-2 text-sm font-medium text-foreground hover:bg-primary/10">Today</button></CardHeader><CardContent><div className="w-full overflow-hidden"><div className="grid grid-cols-7 border-b border-border/70 text-xs font-medium uppercase tracking-wide text-muted-foreground md:grid-cols-[repeat(7,minmax(0,1fr))_7rem]">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Weeks total"].map((day, index) => <span key={day} className={cn("px-1 pb-3 sm:px-2", index === 7 && "hidden md:block")}>{day}</span>)}</div><div>{calendarWeeks.map((week, weekIndex) => { const weekPnl = week.filter((day) => day.inMonth).reduce((sum, day) => sum + day.value, 0); const weekTrades = week.filter((day) => day.inMonth).reduce((sum, day) => sum + day.trades, 0); return <div key={weekIndex} className="grid grid-cols-7 border-b border-border/70 last:border-b-0 md:grid-cols-[repeat(7,minmax(0,1fr))_7rem]">{week.map((day) => { const intensity = Math.min(Math.abs(day.value) / Math.max(averageWin, averageLoss, 1), 1); return <div key={day.key} role={day.inMonth ? "button" : undefined} tabIndex={day.inMonth ? 0 : undefined} onClick={() => day.inMonth && setSelectedCalendarDay({ label: day.label, value: day.value, trades: day.tradeDetails })} onKeyDown={(event) => { if (day.inMonth && (event.key === "Enter" || event.key === " ")) setSelectedCalendarDay({ label: day.label, value: day.value, trades: day.tradeDetails }); }} title={day.inMonth ? (day.traded ? `${day.label}: ${day.value >= 0 ? "+" : "-"}${formatMoney(Math.abs(day.value))}` : `${day.label}: No trades`) : undefined} className={cn("relative min-h-24 border-r border-border/70 p-1 sm:p-2", day.inMonth && "cursor-pointer hover:bg-secondary/60", !day.inMonth && "opacity-25", day.traded && day.inMonth && (day.value >= 0 ? "bg-success/10" : "bg-destructive/10"))} style={{ backgroundColor: day.traded && day.inMonth ? `${day.value >= 0 ? "hsl(142 76% 36%)" : "hsl(0 72% 51%)"} ${0.06 + intensity * 0.12}` : undefined }}><span className={cn("text-xs sm:text-sm", day.inMonth && day.key === new Date().toISOString().slice(0, 10) && "flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background")}>{day.day}</span>{day.inMonth && day.traded && <div className={cn("absolute bottom-2 left-1 text-xs font-medium sm:left-2 sm:text-sm", day.value >= 0 ? "text-success" : "text-destructive")}>{day.value >= 0 ? "+" : "-"}{formatMoney(Math.abs(day.value), true)}<div className="text-[10px] font-normal text-muted-foreground">{day.trades} {day.trades === 1 ? "trade" : "trades"}</div></div>}</div>; })}<div className="hidden min-h-24 flex-col justify-center bg-secondary/20 px-2 md:flex"><span className={cn("text-sm font-medium", weekPnl >= 0 ? "text-success" : "text-destructive")}>{weekPnl >= 0 ? "+" : "-"}{formatMoney(Math.abs(weekPnl), true)}</span><span className="text-xs text-muted-foreground">Week {weekIndex + 1}</span><span className="text-xs text-muted-foreground">{weekTrades} {weekTrades === 1 ? "trade" : "trades"}</span></div></div>; })}</div></div></CardContent></Card>

          <Dialog open={!!selectedCalendarDay} onOpenChange={(open) => !open && setSelectedCalendarDay(null)}><DialogContent className="max-w-md"><DialogHeader><DialogTitle>{selectedCalendarDay?.label}</DialogTitle><p className="text-sm text-muted-foreground">{selectedCalendarDay?.trades.length || 0} {selectedCalendarDay?.trades.length === 1 ? "trade" : "trades"} <span className={cn("ml-2 font-semibold", (selectedCalendarDay?.value || 0) >= 0 ? "text-success" : "text-destructive")}>{(selectedCalendarDay?.value || 0) >= 0 ? "+" : "-"}{formatMoney(Math.abs(selectedCalendarDay?.value || 0))}</span></p></DialogHeader><div className="space-y-3">{selectedCalendarDay?.trades.length ? selectedCalendarDay.trades.map((trade, index) => <div key={`${trade.created_at}-${index}`} className={cn("rounded-md border p-4", (trade.profit_loss || 0) >= 0 ? "border-success/60" : "border-destructive/60")}><div className="flex items-center justify-between text-sm font-medium"><span>{trade.symbol}</span><span className={(trade.profit_loss || 0) >= 0 ? "text-success" : "text-destructive"}>P/L {trade.profit_loss && trade.profit_loss >= 0 ? "+" : "-"}{formatMoney(Math.abs(trade.profit_loss || 0))}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="text-muted-foreground">Time</span><span className="text-right">{new Date(trade.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</span><span className="text-muted-foreground">Trade duration</span><span className="text-right text-muted-foreground">{formatDuration(positionTimes[trade.position_id || ""]?.opened_at, positionTimes[trade.position_id || ""]?.closed_at || trade.created_at)}</span></div></div>) : <p className="py-6 text-center text-sm text-muted-foreground">No trades on this day.</p>}</div></DialogContent></Dialog>
          <Card variant="elevated"><CardHeader><CardTitle>By instrument</CardTitle><p className="text-sm text-muted-foreground">Where your P/L is coming from</p></CardHeader><CardContent><div className="h-[220px] w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={instrumentData} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}><CartesianGrid stroke="hsl(220 15% 18%)" strokeDasharray="4 4" horizontal={false} /><XAxis type="number" hide /><YAxis dataKey="symbol" type="category" tick={{ fill: "hsl(220 10% 70%)", fontSize: 12 }} axisLine={false} tickLine={false} width={56} /><Tooltip contentStyle={chartTooltipStyle} formatter={(value: number) => [formatMoney(value), "P/L"]} /><Bar dataKey="pnl" radius={[0, 4, 4, 0]} fill="#d6a940" /></BarChart></ResponsiveContainer></div>{!instrumentData.length && <p className="pt-4 text-sm text-muted-foreground">Instrument breakdown appears after your first closed trade.</p>}</CardContent></Card>
        </div>

        <Card variant="glass" className="border-primary/20"><CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><div className="rounded-lg bg-primary/10 p-2.5"><CalendarDays className="h-5 w-5 text-primary" /></div><div><p className="font-semibold">Protect the process</p><p className="text-sm text-muted-foreground">Keep your daily losses small and let your best sessions compound.</p></div></div><div className="flex gap-5 text-sm"><span className="text-muted-foreground"><ArrowUpRight className="mr-1 inline h-4 w-4 text-success" />Best day <strong className="text-foreground">{formatMoney(Math.max(...calendarData.map((day) => day.value), 0))}</strong></span><span className="text-muted-foreground"><ArrowDownRight className="mr-1 inline h-4 w-4 text-destructive" />Worst day <strong className="text-foreground">{formatMoney(Math.min(...calendarData.map((day) => day.value), 0))}</strong></span></div></CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
