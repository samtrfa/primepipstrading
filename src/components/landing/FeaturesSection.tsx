import { Card, CardContent } from "@/components/ui/card";
import { 
  Wallet, 
  Clock, 
  Shield, 
  TrendingUp, 
  Globe, 
  HeadphonesIcon,
  ArrowUpRight,
  Percent
} from "lucide-react";

const features = [
  {
    icon: Wallet,
    title: "Up to $200K Funding",
    description: "Trade with accounts up to $200,000. Scale your trading without risking your own capital.",
  },
  {
    icon: Percent,
    title: "90% Profit Split",
    description: "Keep up to 90% of all profits you generate. One of the highest splits in the industry.",
  },
  {
    icon: Clock,
    title: "Fast Payouts",
    description: "Request payouts anytime after your first profitable trade. Funds within 24-48 hours.",
  },
  {
    icon: Shield,
    title: "No Hidden Fees",
    description: "Transparent pricing with no recurring fees. Pay once for your evaluation challenge.",
  },
  {
    icon: TrendingUp,
    title: "Scaling Plan",
    description: "Grow your account up to $2M with consistent performance. Unlimited earning potential.",
  },
  {
    icon: Globe,
    title: "Trade Anywhere",
    description: "Access MT4/MT5 platforms from any device. Trade forex, indices, commodities, and more.",
  },
  {
    icon: HeadphonesIcon,
    title: "24/7 Support",
    description: "Dedicated support team ready to help you succeed. Live chat, email, and Discord.",
  },
  {
    icon: ArrowUpRight,
    title: "Instant Credentials",
    description: "Receive your trading credentials immediately after purchase. Start trading in minutes.",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-dark" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">
            Why Choose Us
          </span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mt-4 mb-6">
            Built for <span className="gold-text">Serious Traders</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            We provide the capital, technology, and support you need to trade professionally.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card
              key={index}
              variant="elevated"
              className="group cursor-pointer"
            >
              <CardContent className="p-6">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
