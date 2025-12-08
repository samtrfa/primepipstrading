import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HowItWorksSection } from "@/components/landing/HowItWorksSection";
import { CTASection } from "@/components/landing/CTASection";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X } from "lucide-react";

const rules = [
  {
    title: "Trading Rules",
    allowed: [
      "Trade any forex pair, indices, commodities, or crypto",
      "Use any trading style (scalping, swing, day trading)",
      "Hold trades overnight and over weekends",
      "Trade during high-impact news events",
      "Use Expert Advisors (EAs) and automated strategies",
    ],
    notAllowed: [
      "Copy trading from other accounts",
      "Martingale strategies",
      "Hedging between accounts",
      "Exploiting data feed latency",
    ],
  },
];

const phases = [
  {
    phase: "Phase 1",
    profitTarget: "8-10%",
    dailyDrawdown: "5%",
    maxDrawdown: "10%",
    timeLimit: "Unlimited",
    minTradingDays: "None",
  },
  {
    phase: "Phase 2",
    profitTarget: "5%",
    dailyDrawdown: "5%",
    maxDrawdown: "10%",
    timeLimit: "Unlimited",
    minTradingDays: "None",
  },
  {
    phase: "Funded",
    profitTarget: "None",
    dailyDrawdown: "5%",
    maxDrawdown: "10%",
    timeLimit: "Unlimited",
    minTradingDays: "None",
  },
];

export default function HowItWorks() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        {/* Page Header */}
        <section className="py-16 relative">
          <div className="absolute inset-0 bg-gradient-hero" />
          <div className="container mx-auto px-4 relative z-10 text-center">
            <h1 className="text-4xl md:text-5xl font-serif font-bold text-foreground mb-4">
              How It <span className="gold-text">Works</span>
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Our straightforward evaluation process is designed to identify skilled traders 
              and provide them with the capital they need to succeed.
            </p>
          </div>
        </section>

        <HowItWorksSection />

        {/* Comparison Table */}
        <section className="py-24">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
                Evaluation <span className="gold-text">Breakdown</span>
              </h2>
              <p className="text-muted-foreground">
                Clear targets and rules for each phase of your journey.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full max-w-4xl mx-auto">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-6 text-foreground font-semibold">Metric</th>
                    {phases.map((phase) => (
                      <th key={phase.phase} className="text-center py-4 px-6 text-foreground font-semibold">
                        {phase.phase}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-muted-foreground">Profit Target</td>
                    {phases.map((phase) => (
                      <td key={phase.phase} className="text-center py-4 px-6 text-foreground">
                        {phase.profitTarget}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-muted-foreground">Daily Drawdown</td>
                    {phases.map((phase) => (
                      <td key={phase.phase} className="text-center py-4 px-6 text-foreground">
                        {phase.dailyDrawdown}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-muted-foreground">Max Drawdown</td>
                    {phases.map((phase) => (
                      <td key={phase.phase} className="text-center py-4 px-6 text-foreground">
                        {phase.maxDrawdown}
                      </td>
                    ))}
                  </tr>
                  <tr className="border-b border-border">
                    <td className="py-4 px-6 text-muted-foreground">Time Limit</td>
                    {phases.map((phase) => (
                      <td key={phase.phase} className="text-center py-4 px-6 text-primary font-medium">
                        {phase.timeLimit}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-4 px-6 text-muted-foreground">Min Trading Days</td>
                    {phases.map((phase) => (
                      <td key={phase.phase} className="text-center py-4 px-6 text-primary font-medium">
                        {phase.minTradingDays}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Trading Rules */}
        <section className="py-24 bg-card">
          <div className="container mx-auto px-4">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-serif font-bold text-foreground mb-4">
                Trading <span className="gold-text">Rules</span>
              </h2>
              <p className="text-muted-foreground">
                Simple and trader-friendly rules designed to let you trade your way.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <Card variant="elevated">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                    <Check className="w-5 h-5 text-success" />
                    Allowed
                  </h3>
                  <ul className="space-y-4">
                    {rules[0].allowed.map((rule, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-success shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-foreground mb-6 flex items-center gap-2">
                    <X className="w-5 h-5 text-destructive" />
                    Not Allowed
                  </h3>
                  <ul className="space-y-4">
                    {rules[0].notAllowed.map((rule, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <X className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{rule}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
