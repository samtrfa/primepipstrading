import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-16 sm:py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-hero" />
      <div className="absolute inset-0 bg-grid-pattern opacity-5" />
      
      {/* Floating Elements */}
      <div className="absolute top-1/2 left-1/4 w-48 sm:w-64 h-48 sm:h-64 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 right-1/4 w-48 sm:w-64 h-48 sm:h-64 bg-primary/10 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6 sm:mb-8 text-xs sm:text-sm">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-primary font-medium">Limited Time: 20% Off All Challenges</span>
          </div>

          {/* Headline */}
          <h2 className="text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground mb-4 sm:mb-6">
            Ready to Trade Like a{" "}
            <span className="gold-text">Professional?</span>
          </h2>

          {/* Subheadline */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-8 sm:mb-10 max-w-2xl mx-auto">
            Join 15,000+ traders who are already funded. Start your evaluation today 
            and trade with up to $200,000 of our capital.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-6 sm:mb-8">
            <Link to="/register">
              <Button variant="gold" size="lg" className="group w-full sm:w-auto">
                Start Your Challenge Now
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link to="/pricing">
              <Button variant="outline" size="lg" className="w-full sm:w-auto">
                View All Plans
              </Button>
            </Link>
          </div>

          {/* Trust Line */}
          <p className="text-xs sm:text-sm text-muted-foreground">
            ✓ No recurring fees &nbsp;&nbsp; ✓ Instant access &nbsp;&nbsp; ✓ 14-day refund guarantee
          </p>
        </div>
      </div>
    </section>
  );
}
