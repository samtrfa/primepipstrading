import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Star, HelpCircle, Target, Clock, Zap, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ChallengeType = "three_step" | "two_step" | "one_step" | "instant";

interface ChallengeRules {
  dailyDrawdown: string;
  maxDrawdown: string;
  profitTarget: string;
  consistencyRule: string;
  minTradingDays: string;
  weekendTrading: string;
  maxTradingDays: string;
  payouts?: string;
}

const ruleExplanations: Record<string, string> = {
  dailyDrawdown: "Maximum loss allowed in a single trading day.",
  maxDrawdown: "Maximum total loss from your highest balance. Trailing follows your peak.",
  profitTarget: "Profit percentage needed to pass the evaluation phase.",
  consistencyRule: "No consistency rule means you can trade freely.",
  minTradingDays: "Minimum days you must actively trade.",
  weekendTrading: "Whether you can hold trades over the weekend.",
  maxTradingDays: "Maximum time to complete the challenge.",
  payouts: "How often you can withdraw profits.",
};

const challengeRules: Record<ChallengeType, ChallengeRules> = {
  three_step: {
    dailyDrawdown: "4%",
    maxDrawdown: "6% (trailing)",
    profitTarget: "10%",
    consistencyRule: "Best trading day must not exceed 30% of total profit.",
    minTradingDays: "4 days",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
  },
  two_step: {
    dailyDrawdown: "4%",
    maxDrawdown: "8% (trailing)",
    profitTarget: "10%",
    consistencyRule: "Best trading day must not exceed 30% of total profit.",
    minTradingDays: "4 days",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
  },
  one_step: {
    dailyDrawdown: "6%",
    maxDrawdown: "8% (trailing)",
    profitTarget: "10%",
    consistencyRule: "Best trading day must not exceed 30% of total profit.",
    minTradingDays: "4 days",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
  },
  instant: {
    dailyDrawdown: "6%",
    maxDrawdown: "10%",
    profitTarget: "N/A",
    consistencyRule: "Best trading day must not exceed 30% of total profit.",
    minTradingDays: "None",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
    payouts: "Biweekly",
  },
};

const challengeTypes: { id: ChallengeType; label: string; icon: React.ElementType; description: string; badge?: string }[] = [
  { id: "three_step", label: "3-Step", icon: Target, description: "3 phases to prove your skills" },
  { id: "two_step", label: "2-Step", icon: Clock, description: "2 phases, faster evaluation" },
  { id: "one_step", label: "1-Step", icon: Zap, description: "Single phase evaluation", badge: "Popular" },
  { id: "instant", label: "Instant", icon: Rocket, description: "Skip evaluation, trade funded", badge: "Best Value" },
];

const accountSizes = [
  { size: 5000, label: "$5K", prices: { three_step: 16, two_step: 20, one_step: 18, instant: 18 } },
  { size: 10000, label: "$10K", prices: { three_step: 28, two_step: 40, one_step: 34, instant: 34 } },
  { size: 25000, label: "$25K", prices: { three_step: 56, two_step: 80, one_step: 62, instant: 62 } },
  { size: 50000, label: "$50K", prices: { three_step: 144, two_step: 198, one_step: 153, instant: 153 }, popular: true },
  { size: 100000, label: "$100K", prices: { three_step: 320, two_step: 396, one_step: 342, instant: 342 } },
  { size: 200000, label: "$200K", prices: { three_step: 490, two_step: 560, one_step: 520, instant: 520 } },
];

function RuleItem({ label, value, ruleKey }: { label: string; value: string; ruleKey: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground text-xs">{label}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-primary transition-colors">
              <HelpCircle className="w-3 h-3" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="max-w-xs text-xs">
            {ruleExplanations[ruleKey]}
          </PopoverContent>
        </Popover>
      </div>
      <span className="font-medium text-foreground text-xs">{value}</span>
    </div>
  );
}

export function PricingSection() {
  const navigate = useNavigate();
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeType>("one_step");
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsLoggedIn(!!session);
    };
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setIsLoggedIn(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handlePurchase = (size: number) => {
    // Store selection in sessionStorage for after login/signup
    sessionStorage.setItem("pendingPurchase", JSON.stringify({
      challengeType: selectedChallenge,
      accountSize: size,
    }));

    if (isLoggedIn) {
      navigate(`/purchase?challenge=${selectedChallenge}&size=${size}`);
    } else {
      navigate(`/register?redirect=purchase&challenge=${selectedChallenge}&size=${size}`);
    }
  };

  const rules = challengeRules[selectedChallenge];

  return (
    <section className="py-16 sm:py-24 relative" id="pricing">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-12">
          <span className="text-primary text-xs sm:text-sm font-semibold uppercase tracking-wider">
            Pricing Plans
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-serif font-bold text-foreground mt-4 mb-4 sm:mb-6">
            Choose Your <span className="gold-text">Challenge</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            One-time fee. No monthly subscriptions. Trade your way to funding.
          </p>
        </div>

        {/* Challenge Type Selector */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-6 sm:mb-8">
          {challengeTypes.map((challenge) => (
            <button
              key={challenge.id}
              onClick={() => setSelectedChallenge(challenge.id)}
              className={cn(
                "relative flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-xl border-2 transition-all text-sm sm:text-base",
                selectedChallenge === challenge.id
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50 bg-card"
              )}
            >
              {challenge.badge && (
                <Badge className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0.5 bg-primary text-primary-foreground">
                  {challenge.badge}
                </Badge>
              )}
              <challenge.icon className={cn(
                "w-4 sm:w-5 h-4 sm:h-5",
                selectedChallenge === challenge.id ? "text-primary" : "text-muted-foreground"
              )} />
              <span className={cn(
                "font-medium",
                selectedChallenge === challenge.id ? "text-foreground" : "text-muted-foreground"
              )}>
                {challenge.label}
              </span>
            </button>
          ))}
        </div>

        {/* Challenge Rules Summary */}
        <Card className="max-w-3xl mx-auto mb-12 bg-card/50">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <RuleItem label="Daily Drawdown" value={rules.dailyDrawdown} ruleKey="dailyDrawdown" />
              <RuleItem label="Max Drawdown" value={rules.maxDrawdown} ruleKey="maxDrawdown" />
              <RuleItem label="Profit Target" value={rules.profitTarget} ruleKey="profitTarget" />
              <RuleItem label="Min Trading Days" value={rules.minTradingDays} ruleKey="minTradingDays" />
              <RuleItem label="Weekend Trading" value={rules.weekendTrading} ruleKey="weekendTrading" />
              <RuleItem label="Max Trading Days" value={rules.maxTradingDays} ruleKey="maxTradingDays" />
              <RuleItem label="Consistency Rule" value={rules.consistencyRule} ruleKey="consistencyRule" />
              {rules.payouts && (
                <RuleItem label="Payouts" value={rules.payouts} ruleKey="payouts" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
          {accountSizes.map((account, index) => (
            <Card
              key={index}
              variant={account.popular ? "gold" : "elevated"}
              className={cn(
                "relative",
                account.popular && "md:scale-105 md:z-10"
              )}
            >
              {account.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    <Star className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}
              <CardHeader className="text-center pb-3 sm:pb-4">
                <CardTitle className="text-lg sm:text-2xl gold-text">{account.label}</CardTitle>
                <div className="text-xs sm:text-sm text-muted-foreground">Account Size</div>
                <div className="mt-3 sm:mt-4">
                  <span className="text-2xl sm:text-4xl font-bold text-foreground">
                    ${account.prices[selectedChallenge]}
                  </span>
                  <span className="text-muted-foreground text-xs sm:text-sm ml-1 sm:ml-2">one-time</span>
                </div>
              </CardHeader>
              <CardContent className="pt-3 sm:pt-4 border-t border-border">
                <ul className="space-y-1 sm:space-y-2 mb-4 sm:mb-6 text-xs sm:text-sm">
                  <li className="flex items-start gap-2">
                    <Check className="w-3 sm:w-4 h-3 sm:h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Up to 90% Profit Split</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3 sm:w-4 h-3 sm:h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">No Time Limits</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3 sm:w-4 h-3 sm:h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Weekend Trading</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-3 sm:w-4 h-3 sm:h-4 text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">Crypto Payments</span>
                  </li>
                </ul>
                <Button
                  variant={account.popular ? "gold" : "outline"}
                  className="w-full text-sm sm:text-base py-2 sm:py-2.5"
                  onClick={() => handlePurchase(account.size)}
                >
                  {isLoggedIn ? "Purchase Now" : "Get Started"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Guarantee */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-secondary border border-border">
            <Check className="w-5 h-5 text-primary" />
            <span className="text-foreground">Instant Account Activation After Payment</span>
          </div>
        </div>
      </div>
    </section>
  );
}
