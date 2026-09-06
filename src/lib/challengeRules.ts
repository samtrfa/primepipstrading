// Central definition of prop-challenge rules, per challenge type and per phase.
// Each phase can have its own profit target and drawdown limits.

export interface PhaseRules {
  name: string;
  profitTarget: number; // % of account size
  dailyDrawdown: number; // % of daily start balance
  maxDrawdown: number; // % of high water mark
}

export const FUNDED_MAX_RISK_PERCENT = 1;
export const FUNDED_CONSISTENCY_PERCENT = 30;
export const FUNDED_CONSISTENCY_BREACH_PERCENT = 31;

export interface ConsistencyPosition {
  profit_loss: number;
  closed_at: string | null;
}

export function calculateConsistencyScore(positions: ConsistencyPosition[]): number {
  const dailyProfits = positions.reduce<Record<string, number>>((totals, position) => {
    if (!position.closed_at || position.profit_loss <= 0) return totals;

    const day = new Date(position.closed_at).toISOString().slice(0, 10);
    totals[day] = (totals[day] || 0) + position.profit_loss;
    return totals;
  }, {});

  const totalProfit = positions.reduce((total, position) => total + Math.max(0, position.profit_loss), 0);
  const bestDayProfit = Math.max(0, ...Object.values(dailyProfits));
  return totalProfit > 0 ? (bestDayProfit / totalProfit) * 100 : 0;
}

export const CHALLENGE_RULES: Record<string, PhaseRules[]> = {
  three_step: [
    { name: "Phase 1", profitTarget: 8, dailyDrawdown: 5, maxDrawdown: 10 },
    { name: "Phase 2", profitTarget: 5, dailyDrawdown: 5, maxDrawdown: 10 },
    { name: "Phase 3", profitTarget: 5, dailyDrawdown: 5, maxDrawdown: 10 },
  ],
  two_step: [
    { name: "Phase 1", profitTarget: 8, dailyDrawdown: 5, maxDrawdown: 10 },
    { name: "Phase 2", profitTarget: 5, dailyDrawdown: 5, maxDrawdown: 10 },
  ],
  one_step: [
    { name: "Evaluation", profitTarget: 10, dailyDrawdown: 4, maxDrawdown: 6 },
  ],
  instant: [
    { name: "Funded", profitTarget: 0, dailyDrawdown: 5, maxDrawdown: 10 },
  ],
};

export function getPhases(challengeType: string): PhaseRules[] {
  return CHALLENGE_RULES[challengeType] || CHALLENGE_RULES.three_step;
}

export function getTotalPhases(challengeType: string): number {
  return challengeType === "instant" ? 0 : getPhases(challengeType).length;
}

export function getInitialPhase(challengeType: string): number | null {
  return challengeType === "instant" ? null : 1;
}

export function isInstantAccount(challengeType: string): boolean {
  return challengeType === "instant";
}

export function hasConsistencyRule(challengeType: string): boolean {
  return challengeType === "one_step" || challengeType === "instant";
}

/** Rules for the given (1-based) phase, clamped to valid range. */
export function getPhaseRules(challengeType: string, phase: number | null): PhaseRules {
  const phases = getPhases(challengeType);
  const index = Math.min(Math.max((phase || 1) - 1, 0), phases.length - 1);
  return phases[index];
}
