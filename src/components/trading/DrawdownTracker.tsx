import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, Activity, ShieldAlert, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPhaseRules } from "@/lib/challengeRules";

interface DrawdownTrackerProps {
  accountSize: number;
  currentBalance: number;
  highWaterMark: number | null;
  dailyStartBalance: number | null;
  dailyStartDate?: string | null;
  unrealizedPL: number;
  challengeType: string;
  currentPhase?: number | null;
  serverMaxDrawdownPercent?: number | null;
  serverDailyDrawdownPercent?: number | null;
  serverDrawdownViolated?: boolean | null;
  serverViolationType?: string | null;
  liveRiskDataAvailable?: boolean;
}

const formatMoney = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const getLevel = (value: number, limit: number) => {
  const ratio = limit > 0 ? value / limit : 0;
  if (ratio >= 1) return "critical";
  if (ratio >= 0.8) return "danger";
  if (ratio >= 0.6) return "warning";
  return "safe";
};

const levelText = {
  safe: "text-green-500",
  warning: "text-yellow-500",
  danger: "text-orange-500",
  critical: "text-red-500",
};

const levelBar = {
  safe: "bg-green-500",
  warning: "bg-yellow-500",
  danger: "bg-orange-500",
  critical: "bg-red-500",
};

export function DrawdownTracker({
  accountSize,
  currentBalance,
  highWaterMark,
  dailyStartBalance,
  dailyStartDate,
  unrealizedPL,
  challengeType,
  currentPhase = 1,
  serverDrawdownViolated = false,
  serverViolationType,
}: DrawdownTrackerProps) {
  const rules = getPhaseRules(challengeType, currentPhase);
  const equity = currentBalance + unrealizedPL;
  const highWaterMarkValue = highWaterMark && highWaterMark > 0 ? highWaterMark : accountSize;
  const isCurrentTradingDay = dailyStartDate === new Date().toISOString().slice(0, 10);
  const dailyStartValue = isCurrentTradingDay && dailyStartBalance && dailyStartBalance > 0
    ? dailyStartBalance
    : currentBalance;

  const maxLoss = Math.max(0, highWaterMarkValue - equity);
  const dailyLoss = Math.max(0, dailyStartValue - equity);
  const maxPercent = highWaterMarkValue > 0 ? (maxLoss / highWaterMarkValue) * 100 : 0;
  const dailyPercent = dailyStartValue > 0 ? (dailyLoss / dailyStartValue) * 100 : 0;
  const maxLevel = getLevel(maxPercent, rules.maxDrawdown);
  const dailyLevel = getLevel(dailyPercent, rules.dailyDrawdown);
  const maxProgress = Math.min(100, Math.max(0, (maxPercent / rules.maxDrawdown) * 100));
  const dailyProgress = Math.min(100, Math.max(0, (dailyPercent / rules.dailyDrawdown) * 100));
  const maxBreached = maxPercent >= rules.maxDrawdown || (serverDrawdownViolated && serverViolationType === "max_drawdown");
  const dailyBreached = dailyPercent >= rules.dailyDrawdown || (serverDrawdownViolated && serverViolationType === "daily_drawdown");

  return (
    <div className="space-y-3">
      {(maxBreached || dailyBreached) && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
              <div className="space-y-1">
                <p className="font-semibold text-red-500">Challenge Rule Violation!</p>
                {maxBreached && <p className="text-sm text-red-400">Max drawdown limit breached ({rules.maxDrawdown}%).</p>}
                {dailyBreached && <p className="text-sm text-red-400">Daily drawdown limit breached ({rules.dailyDrawdown}%).</p>}
                <p className="mt-2 text-xs text-muted-foreground">Trading may be restricted.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="border-b px-3 py-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4" />
            Drawdown Tracker
            {(maxLevel === "danger" || maxLevel === "critical" || dailyLevel === "danger" || dailyLevel === "critical") && (
              <AlertTriangle className="h-4 w-4 animate-pulse text-orange-500" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-3">
          <MetricRow label="Daily Drawdown" icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} percent={dailyPercent} limit={rules.dailyDrawdown} progress={dailyProgress} level={dailyLevel} startLabel={`Start: ${formatMoney(dailyStartValue)}`} lossLabel={`Loss: ${formatMoney(dailyLoss)}`} />
          <MetricRow label="Max Drawdown" icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} percent={maxPercent} limit={rules.maxDrawdown} progress={maxProgress} level={maxLevel} startLabel={`HWM: ${formatMoney(highWaterMarkValue)}`} lossLabel={`Loss: ${formatMoney(maxLoss)}`} />
          <p className="border-t border-border pt-2 text-center text-[10px] text-muted-foreground">
            {rules.name} · Daily limit: {rules.dailyDrawdown}% · Max limit: {rules.maxDrawdown}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

interface MetricRowProps {
  label: string;
  icon: React.ReactNode;
  percent: number;
  limit: number;
  progress: number;
  level: keyof typeof levelText;
  startLabel: string;
  lossLabel: string;
}

function MetricRow({ label, icon, percent, limit, progress, level, startLabel, lossLabel }: MetricRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">{icon}<span className="text-xs font-medium">{label}</span></div>
        <div className="flex items-center gap-2">
          <span className={cn("text-sm font-bold", levelText[level])}>{percent.toFixed(2)}%</span>
          <Badge variant="outline" className={cn("text-[10px]", levelText[level])}>/ {limit}%</Badge>
        </div>
      </div>
      <div className="relative">
        <Progress value={progress} className="h-2" />
        <div className={cn("absolute left-0 top-0 h-2 rounded-full transition-all", levelBar[level])} style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground"><span>{startLabel}</span><span>{lossLabel}</span></div>
    </div>
  );
}
