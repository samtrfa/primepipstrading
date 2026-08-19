import { Card, CardContent } from "@/components/ui/card";
import { Star, Quote } from "lucide-react";

const testimonials = [
  {
    name: "Michael Chen",
    role: "Funded Trader",
    country: "Singapore",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=michael",
    content: "PrimePips gave me the opportunity to trade professionally without risking my savings. Already received 3 payouts totaling $12,500!",
    payout: "$12,500",
  },
  {
    name: "Sarah Williams",
    role: "Professional Trader",
    country: "United Kingdom",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
    content: "The evaluation process is fair and the support team is incredibly helpful. Best prop firm I've worked with by far.",
    payout: "$28,000",
  },
  {
    name: "Ahmed Hassan",
    role: "Funded Trader",
    country: "UAE",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=ahmed",
    content: "Scaled from a $50K account to $200K in just 6 months. The growth potential here is unlimited if you're disciplined.",
    payout: "$45,000",
  },
  {
    name: "Elena Rodriguez",
    role: "Day Trader",
    country: "Spain",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=elena",
    content: "Fast payouts and transparent rules. What more could you ask for? Finally found a prop firm I can trust.",
    payout: "$8,200",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-16 sm:py-24 relative">
      <div className="absolute inset-0 bg-gradient-hero opacity-50" />
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
          <span className="text-primary text-xs sm:text-sm font-semibold uppercase tracking-wider">
            Testimonials
          </span>
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-serif font-bold text-foreground mt-4 mb-4 sm:mb-6">
            Trusted by <span className="gold-text">15,000+ Traders</span>
          </h2>
          <p className="text-muted-foreground text-base sm:text-lg">
            Join thousands of successful traders who are already trading with our capital.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial, index) => (
            <Card key={index} variant="glass" className="group h-full">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start gap-3 sm:gap-4">
                  <Quote className="w-6 sm:w-8 h-6 sm:h-8 text-primary/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground mb-4 sm:mb-6 text-sm sm:text-base">
                      "{testimonial.content}"
                    </p>
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <img
                          src={testimonial.image}
                          alt={testimonial.name}
                          className="w-10 sm:w-12 h-10 sm:h-12 rounded-full bg-secondary shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-foreground text-sm sm:text-base truncate">
                            {testimonial.name}
                          </div>
                          <div className="text-xs sm:text-sm text-muted-foreground truncate">
                            {testimonial.role} • {testimonial.country}
                          </div>
                        </div>
                      </div>
                      <div className="text-right sm:text-right">
                        <div className="flex items-center gap-0.5 mb-1 justify-end sm:justify-end">
                          {[...Array(5)].map((_, i) => (
                            <Star key={i} className="w-3 h-3 fill-primary text-primary" />
                          ))}
                        </div>
                        <div className="text-xs sm:text-sm font-semibold text-primary whitespace-nowrap">
                          {testimonial.payout} earned
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
