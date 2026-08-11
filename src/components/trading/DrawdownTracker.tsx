import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { AlertTriangle, ShieldAlert, TrendingDown, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import { getPhaseRules } from "@/lib/challengeRules";

interface DrawdownTrackerProps {
  accountSize: number;
  currentBalance: number;
  highWaterMark: number | null;
  dailyStartBalance: number | null;
  unrealizedPL: number;
  challengeType: string;
  currentPhase?: number | null;
}

export function DrawdownTracker({
  accountSize,
  currentBalance,
  highWaterMark,
  dailyStartBalance,
  unrealizedPL,
  challengeType,
  currentPhase = 1,
}: DrawdownTrackerProps) {
  const [violations, setViolations] = useState<string[]>([]);

  const rules = getPhaseRules(challengeType, currentPhase);
  const limits = { daily: rules.dailyDrawdown, max: rules.maxDrawdown };
  
  // Calculate equity (balance + unrealized P/L)
  const equity = currentBalance + unrealizedPL;
  
  // High water mark for max drawdown calculation (highest equity ever reached)
  const effectiveHWM = highWaterMark || accountSize;
  
  // Daily start balance for daily drawdown calculation
  const effectiveDailyStart = dailyStartBalance || accountSize;

  // Calculate max drawdown from high water mark
  const maxDrawdownAmount = effectiveHWM - equity;
  const maxDrawdownPercent = effectiveHWM > 0 ? (maxDrawdownAmount / effectiveHWM) * 100 : 0;

  // Calculate daily drawdown from daily start balance
  const dailyDrawdownAmount = effectiveDailyStart - equity;
  const dailyDrawdownPercent = effectiveDailyStart > 0 ? (dailyDrawdownAmount / effectiveDailyStart) * 100 : 0;

  // Progress towards limits (for progress bars)
  const maxDrawdownProgress = Math.min((maxDrawdownPercent / limits.max) * 100, 100);
  const dailyDrawdownProgress = Math.min((dailyDrawdownPercent / limits.daily) * 100, 100);

  // Check for violations
  useEffect(() => {
    const newViolations: string[] = [];
    
    if (maxDrawdownPercent >= limits.max) {
      newViolations.push(`Max Drawdown Limit Breached (${limits.max}%)`);
    }
    
    if (dailyDrawdownPercent >= limits.daily) {
      newViolations.push(`Daily Drawdown Limit Breached (${limits.daily}%)`);
    }
    
    setViolations(newViolations);
  }, [maxDrawdownPercent, dailyDrawdownPercent, limits]);

  // Determine warning levels
  const getWarningLevel = (current: number, limit: number) => {
    const ratio = current / limit;
    if (ratio >= 1) return "critical";
    if (ratio >= 0.8) return "danger";
    if (ratio >= 0.6) return "warning";
    return "safe";
  };

  const maxLevel = getWarningLevel(maxDrawdownPercent, limits.max);
  const dailyLevel = getWarningLevel(dailyDrawdownPercent, limits.daily);

  const levelColors = {
    safe: "text-green-500",
    warning: "text-yellow-500",
    danger: "text-orange-500",
    critical: "text-red-500",
  };

  const progressColors = {
    safe: "bg-green-500",
    warning: "bg-yellow-500",
    danger: "bg-orange-500",
    critical: "bg-red-500",
  };

  return (
    <div className="space-y-3">
      {/* Violation Alerts */}
      {violations.length > 0 && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="p-3">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-red-500">Challenge Rule Violation!</p>
                {violations.map((violation, index) => (
                  <p key={index} className="text-sm text-red-400">{violation}</p>
                ))}
                <p className="text-xs text-muted-foreground mt-2">
                  Your account has been flagged. Trading may be restricted.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Drawdown Metrics Card */}
      <Card>
        <CardHeader className="py-2 px-3 border-b">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Drawdown Tracker
            {(maxLevel === "danger" || maxLevel === "critical" || dailyLevel === "danger" || dailyLevel === "critical") && (
              <AlertTriangle className="w-4 h-4 text-orange-500 animate-pulse" />
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-4">
          {/* Daily Drawdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Daily Drawdown</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", levelColors[dailyLevel])}>
                  {dailyDrawdownPercent > 0 ? dailyDrawdownPercent.toFixed(2) : "0.00"}%
                </span>
                <Badge 
                  variant="outline" 
                  className={cn("text-[10px]", levelColors[dailyLevel])}
                >
                  / {limits.daily}%
                </Badge>
              </div>
            </div>
            <div className="relative">
              <Progress 
                value={Math.max(0, dailyDrawdownProgress)} 
                className="h-2"
              />
              <div 
                className={cn(
                  "absolute top-0 left-0 h-2 rounded-full transition-all",
                  progressColors[dailyLevel]
                )}
                style={{ width: `${Math.max(0, Math.min(dailyDrawdownProgress, 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Start: ${effectiveDailyStart.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span>Loss: ${Math.max(0, dailyDrawdownAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Max Drawdown */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                <span className="text-xs font-medium">Max Drawdown</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn("text-sm font-bold", levelColors[maxLevel])}>
                  {maxDrawdownPercent > 0 ? maxDrawdownPercent.toFixed(2) : "0.00"}%
                </span>
                <Badge 
                  variant="outline" 
                  className={cn("text-[10px]", levelColors[maxLevel])}
                >
                  / {limits.max}%
                </Badge>
              </div>
            </div>
            <div className="relative">
              <Progress 
                value={Math.max(0, maxDrawdownProgress)} 
                className="h-2"
              />
              <div 
                className={cn(
                  "absolute top-0 left-0 h-2 rounded-full transition-all",
                  progressColors[maxLevel]
                )}
                style={{ width: `${Math.max(0, Math.min(maxDrawdownProgress, 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>HWM: ${effectiveHWM.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              <span>Loss: ${Math.max(0, maxDrawdownAmount).toFixed(2)}</span>
            </div>
          </div>

          {/* Challenge Rules Reference */}
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground text-center">
              Challenge: <span className="font-medium capitalize">{challengeType.replace("_", " ")}</span> | 
              <span className="font-medium"> {rules.name}</span> | 
              Daily Limit: <span className="font-medium">{limits.daily}%</span> | 
              Max Limit: <span className="font-medium">{limits.max}%</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
