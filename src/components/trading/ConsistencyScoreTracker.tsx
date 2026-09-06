import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateConsistencyScore, FUNDED_CONSISTENCY_PERCENT } from "@/lib/challengeRules";

interface ClosedPosition {
  profit_loss: number;
  closed_at: string | null;
}

interface ConsistencyScoreTrackerProps {
  positions: ClosedPosition[];
}

export function ConsistencyScoreTracker({ positions }: ConsistencyScoreTrackerProps) {
  const totalProfit = positions.reduce((total, position) => total + Math.max(0, position.profit_loss), 0);
  const dailyProfits = positions.reduce<Record<string, number>>((totals, position) => {
    if (!position.closed_at || position.profit_loss <= 0) return totals;
    const day = new Date(position.closed_at).toISOString().slice(0, 10);
    totals[day] = (totals[day] || 0) + position.profit_loss;
    return totals;
  }, {});
  const bestDayProfit = Math.max(0, ...Object.values(dailyProfits));
  const score = calculateConsistencyScore(positions);
  const progress = Math.min((score / FUNDED_CONSISTENCY_PERCENT) * 100, 100);
  const isWithinLimit = totalProfit > 0 && score < FUNDED_CONSISTENCY_PERCENT;

  return (
    <Card className={cn(isWithinLimit && "border-green-500/30 bg-green-500/5")}>
      <CardHeader className="py-2 px-3 border-b">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Consistency Score
          </div>
          <Badge
            variant="outline"
            className={cn(
              "text-[10px]",
              isWithinLimit ? "text-green-500 border-green-500/50" : "text-muted-foreground"
            )}
          >
            Limit {FUNDED_CONSISTENCY_PERCENT}%
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Best trading day share</span>
          <span className={cn("text-sm font-bold", isWithinLimit ? "text-green-500" : "text-foreground")}>
            {score.toFixed(2)}%
          </span>
        </div>
        <div className="relative">
          <Progress value={progress} className="h-2" />
          <div
            className="absolute top-0 h-2 w-0.5 bg-primary"
            style={{ left: `${FUNDED_CONSISTENCY_PERCENT}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>Best day: ${bestDayProfit.toFixed(2)}</span>
          <span>Total profit: ${Math.max(0, totalProfit).toFixed(2)}</span>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Your best trading day must stay below {FUNDED_CONSISTENCY_PERCENT}% of total account profit.
        </p>
      </CardContent>
    </Card>
  );
}
