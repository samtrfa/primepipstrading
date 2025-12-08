import { Card, CardContent } from "@/components/ui/card";
import { ClipboardCheck, TrendingUp, Award, Wallet } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: ClipboardCheck,
    title: "Choose Your Challenge",
    description: "Select your preferred account size and complete the purchase. Get instant access to your evaluation account.",
  },
  {
    step: "02",
    icon: TrendingUp,
    title: "Pass the Evaluation",
    description: "Trade and hit the profit targets while respecting the drawdown rules. Take your time - no time limits.",
  },
  {
    step: "03",
    icon: Award,
    title: "Get Funded",
    description: "Once you pass both phases, receive your funded account. Trade with real capital and real profits.",
  },
  {
    step: "04",
    icon: Wallet,
    title: "Withdraw Profits",
    description: "Request payouts anytime. Keep up to 90% of your profits. Scale your account with consistent performance.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 relative bg-card">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">
            How It Works
          </span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mt-4 mb-6">
            Your Path to <span className="gold-text">Funded Trading</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            A simple 4-step process to trade with our capital and keep your profits.
          </p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((item, index) => (
            <div key={index} className="relative">
              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-primary/50 to-transparent z-0" />
              )}
              
              <Card variant="outline" className="relative z-10 h-full hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                      <item.icon className="w-5 h-5 text-primary" />
                    </div>
                    <span className="text-4xl font-bold text-primary/20">{item.step}</span>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-3">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
