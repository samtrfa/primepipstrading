import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, CheckCircle2, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProfitTargetTrackerProps {
  accountSize: number;
  currentBalance: number;
  unrealizedPL: number;
  challengeType: string;
  currentPhase: number | null;
}

// Prop trading challenge profit targets (percentage of account size)
const PROFIT_TARGETS: Record<string, { phases: number[]; phaseNames: string[] }> = {
  three_step: { 
    phases: [8, 5, 5], 
    phaseNames: ["Phase 1", "Phase 2", "Phase 3"] 
  },
  two_step: { 
    phases: [8, 5], 
    phaseNames: ["Phase 1", "Phase 2"] 
  },
  one_step: { 
    phases: [10], 
    phaseNames: ["Evaluation"] 
  },
  instant: { 
    phases: [], 
    phaseNames: [] 
  },
};

export function ProfitTargetTracker({
  accountSize,
  currentBalance,
  unrealizedPL,
  challengeType,
  currentPhase,
}: ProfitTargetTrackerProps) {
  const config = PROFIT_TARGETS[challengeType] || PROFIT_TARGETS.three_step;
  const phase = currentPhase || 1;
  
  // Instant funding has no profit target
  if (challengeType === "instant" || config.phases.length === 0) {
    return (
      <Card>
        <CardHeader className="py-2 px-3 border-b">
          <CardTitle className="text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-yellow-500" />
            Funded Account
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span>No profit target - Trade freely!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Calculate equity
  const equity = currentBalance + unrealizedPL;
  
  // Calculate profit made
  const profitMade = equity - accountSize;
  const profitPercent = (profitMade / accountSize) * 100;
  
  // Get current phase target
  const phaseIndex = Math.min(phase - 1, config.phases.length - 1);
  const targetPercent = config.phases[phaseIndex];
  const targetAmount = (targetPercent / 100) * accountSize;
  
  // Calculate progress towards target
  const progressPercent = targetPercent > 0 ? Math.min((profitPercent / targetPercent) * 100, 100) : 0;
  const isTargetMet = profitPercent >= targetPercent;
  
  // Determine status
  const getStatus = () => {
    if (isTargetMet) return "complete";
    if (progressPercent >= 75) return "close";
    if (progressPercent >= 50) return "halfway";
    if (progressPercent >= 25) return "started";
    return "beginning";
  };
  
  const status = getStatus();
  
  const statusColors = {
    beginning: "text-muted-foreground",
    started: "text-blue-500",
    halfway: "text-yellow-500",
    close: "text-orange-500",
    complete: "text-green-500",
  };

  const progressColors = {
    beginning: "bg-muted-foreground",
    started: "bg-blue-500",
    halfway: "bg-yellow-500",
    close: "bg-orange-500",
    complete: "bg-green-500",
  };

  return (
    <Card className={cn(isTargetMet && "border-green-500/50 bg-green-500/5")}>
      <CardHeader className="py-2 px-3 border-b">
        <CardTitle className="text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Profit Target
          </div>
          <Badge 
            variant="outline" 
            className={cn("text-[10px]", isTargetMet ? "text-green-500 border-green-500/50" : "text-muted-foreground")}
          >
            {config.phaseNames[phaseIndex]}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 space-y-3">
        {/* Target Completion Banner */}
        {isTargetMet && (
          <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 border border-green-500/30">
            <Trophy className="w-5 h-5 text-green-500" />
            <div>
              <p className="text-sm font-semibold text-green-500">Target Achieved!</p>
              <p className="text-xs text-muted-foreground">Ready for phase advancement</p>
            </div>
          </div>
        )}

        {/* Progress Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Progress</span>
            <div className="flex items-center gap-2">
              <span className={cn("text-sm font-bold", statusColors[status])}>
                {profitPercent.toFixed(2)}%
              </span>
              <span className="text-xs text-muted-foreground">/ {targetPercent}%</span>
            </div>
          </div>
          
          <div className="relative">
            <Progress value={0} className="h-3" />
            <div 
              className={cn(
                "absolute top-0 left-0 h-3 rounded-full transition-all duration-500",
                progressColors[status]
              )}
              style={{ width: `${Math.max(0, Math.min(progressPercent, 100))}%` }}
            />
            {/* Target marker */}
            <div className="absolute top-0 right-0 h-3 w-0.5 bg-primary" />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Current Profit</p>
            <p className={cn(
              "text-sm font-bold",
              profitMade >= 0 ? "text-green-500" : "text-red-500"
            )}>
              {profitMade >= 0 ? "+" : ""}${profitMade.toFixed(2)}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Target Amount</p>
            <p className="text-sm font-bold">${targetAmount.toFixed(2)}</p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Remaining</p>
            <p className={cn(
              "text-sm font-bold",
              isTargetMet ? "text-green-500" : "text-muted-foreground"
            )}>
              {isTargetMet ? "Complete!" : `$${Math.max(0, targetAmount - profitMade).toFixed(2)}`}
            </p>
          </div>
          <div className="space-y-0.5">
            <p className="text-[10px] text-muted-foreground">Equity</p>
            <p className="text-sm font-bold">${equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
          </div>
        </div>

        {/* Phase Overview */}
        {config.phases.length > 1 && (
          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground mb-2">Challenge Phases</p>
            <div className="flex gap-1">
              {config.phases.map((target, index) => {
                const isCurrentPhase = index === phaseIndex;
                const isPassed = index < phaseIndex;
                return (
                  <div 
                    key={index}
                    className={cn(
                      "flex-1 h-1.5 rounded-full",
                      isPassed ? "bg-green-500" :
                      isCurrentPhase ? (isTargetMet ? "bg-green-500" : progressColors[status]) :
                      "bg-muted"
                    )}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              {config.phaseNames.map((name, index) => (
                <span key={index} className="text-[9px] text-muted-foreground">
                  {config.phases[index]}%
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
