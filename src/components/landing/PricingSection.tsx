import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Star } from "lucide-react";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Starter",
    accountSize: "$10,000",
    price: "$99",
    popular: false,
    features: [
      "10% Profit Target Phase 1",
      "5% Profit Target Phase 2",
      "5% Daily Drawdown",
      "10% Max Drawdown",
      "Unlimited Trading Days",
      "80% Profit Split",
    ],
  },
  {
    name: "Standard",
    accountSize: "$25,000",
    price: "$199",
    popular: false,
    features: [
      "10% Profit Target Phase 1",
      "5% Profit Target Phase 2",
      "5% Daily Drawdown",
      "10% Max Drawdown",
      "Unlimited Trading Days",
      "85% Profit Split",
    ],
  },
  {
    name: "Professional",
    accountSize: "$50,000",
    price: "$299",
    popular: true,
    features: [
      "8% Profit Target Phase 1",
      "5% Profit Target Phase 2",
      "5% Daily Drawdown",
      "10% Max Drawdown",
      "Unlimited Trading Days",
      "85% Profit Split",
      "Scaling Opportunity",
    ],
  },
  {
    name: "Expert",
    accountSize: "$100,000",
    price: "$499",
    popular: false,
    features: [
      "8% Profit Target Phase 1",
      "5% Profit Target Phase 2",
      "5% Daily Drawdown",
      "10% Max Drawdown",
      "Unlimited Trading Days",
      "90% Profit Split",
      "Priority Support",
      "Scaling Opportunity",
    ],
  },
  {
    name: "Master",
    accountSize: "$200,000",
    price: "$999",
    popular: false,
    features: [
      "8% Profit Target Phase 1",
      "5% Profit Target Phase 2",
      "5% Daily Drawdown",
      "10% Max Drawdown",
      "Unlimited Trading Days",
      "90% Profit Split",
      "VIP Support",
      "Scaling to $2M",
    ],
  },
];

export function PricingSection() {
  return (
    <section className="py-24 relative" id="pricing">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">
            Pricing Plans
          </span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mt-4 mb-6">
            Choose Your <span className="gold-text">Account Size</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            One-time fee. No monthly subscriptions. Trade your way to funding.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {plans.map((plan, index) => (
            <Card
              key={index}
              variant={plan.popular ? "gold" : "elevated"}
              className={cn(
                "relative",
                plan.popular && "scale-105 z-10"
              )}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <div className="flex items-center gap-1 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                    <Star className="w-3 h-3" />
                    Most Popular
                  </div>
                </div>
              )}
              <CardHeader className="text-center pb-4">
                <div className="text-sm text-muted-foreground mb-2">{plan.name}</div>
                <CardTitle className="text-2xl gold-text">{plan.accountSize}</CardTitle>
                <div className="mt-4">
                  <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-muted-foreground text-sm ml-2">one-time</span>
                </div>
              </CardHeader>
              <CardContent className="pt-4 border-t border-border">
                <ul className="space-y-3 mb-6">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
                <Link to="/register" className="block">
                  <Button
                    variant={plan.popular ? "gold" : "outline"}
                    className="w-full"
                  >
                    Get Started
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Guarantee */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-secondary border border-border">
            <Check className="w-5 h-5 text-primary" />
            <span className="text-foreground">14-Day Refund Guarantee on All Plans</span>
          </div>
        </div>
      </div>
    </section>
  );
}
