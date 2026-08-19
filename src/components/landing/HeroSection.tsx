import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, TrendingUp } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      {/* Floating orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 sm:mb-8 animate-fade-in-up text-xs sm:text-sm">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-primary font-medium">Now Funding Traders Globally</span>
          </div>

          {/* Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-foreground mb-4 sm:mb-6 animate-fade-in-up delay-100">
            Trade With Our Capital,{" "}
            <span className="gold-text">Keep Your Profits</span>
          </h1>

          {/* Subheadline */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-6 sm:mb-8 max-w-2xl mx-auto animate-fade-in-up delay-200 px-2 sm:px-0">
            Get funded up to $200,000 and keep up to 90% of your trading profits. 
            No risk to your own capital. Start your evaluation today.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 animate-fade-in-up delay-300 px-2 sm:px-0">
            <Link to="/register">
              <Button variant="gold" size="lg" className="group w-full sm:w-auto">
                Start Your Evaluation
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/how-it-works">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                Learn How It Works
              </Button>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-8 animate-fade-in-up delay-400">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Shield className="w-5 h-5 text-primary" />
              <span className="text-sm">Secure Payouts</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Zap className="w-5 h-5 text-primary" />
              <span className="text-sm">Instant Funding</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="w-5 h-5 text-primary" />
              <span className="text-sm">$10M+ Paid Out</span>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto animate-fade-in-up delay-500">
          {[
            { value: "15,000+", label: "Funded Traders" },
            { value: "$10M+", label: "Total Payouts" },
            { value: "90%", label: "Profit Split" },
            { value: "150+", label: "Countries" },
          ].map((stat, index) => (
            <div
              key={index}
              className="glass-card p-6 text-center hover:border-primary/30 transition-colors"
            >
              <div className="text-2xl md:text-3xl font-bold gold-text mb-1">
                {stat.value}
              </div>
              <div className="text-sm text-muted-foreground">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
