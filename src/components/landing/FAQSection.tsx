import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How does the evaluation process work?",
    answer: "Our evaluation consists of two phases. In Phase 1, you need to reach the profit target while respecting daily and overall drawdown limits. Phase 2 has a lower profit target. Once you pass both phases, you receive a funded account with real capital.",
  },
  {
    question: "What is the profit split?",
    answer: "Depending on your account size, you can keep up to 90% of all profits generated on your funded account. The profit split starts at 80% for Starter accounts and goes up to 90% for Expert and Master accounts.",
  },
  {
    question: "How long do I have to pass the evaluation?",
    answer: "There are no time limits on our evaluations. You can take as long as you need to reach the profit targets. We believe in quality trading, not rushed decisions.",
  },
  {
    question: "What trading instruments can I trade?",
    answer: "You can trade Forex pairs, indices, commodities, and cryptocurrencies on MT4/MT5 platforms. We offer competitive spreads and leverage up to 1:100 on forex pairs.",
  },
  {
    question: "How do payouts work?",
    answer: "Once funded, you can request a payout anytime you have profits available. Payouts are processed within 24-48 hours via bank transfer, cryptocurrency, or other supported methods.",
  },
  {
    question: "What are the drawdown rules?",
    answer: "Daily drawdown is 5% of your starting balance for the day. Overall drawdown is 10% from your initial balance. These limits reset as your account grows through trading profits.",
  },
  {
    question: "Can I hold trades over the weekend?",
    answer: "Yes, you can hold trades over the weekend and during news events. We don't have restrictions on trading styles - scalping, swing trading, and holding positions overnight are all allowed.",
  },
  {
    question: "What happens if I fail the evaluation?",
    answer: "If you violate a rule, your evaluation ends. However, we offer a 14-day refund guarantee on all new purchases if you're not satisfied. You can also purchase a new challenge at a discounted reset price.",
  },
];

export function FAQSection() {
  return (
    <section className="py-24 relative bg-card" id="faq">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-primary text-sm font-semibold uppercase tracking-wider">
            FAQ
          </span>
          <h2 className="text-3xl md:text-5xl font-serif font-bold text-foreground mt-4 mb-6">
            Frequently Asked <span className="gold-text">Questions</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about our funding program.
          </p>
        </div>

        {/* FAQ Accordion */}
        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-secondary/50 border border-border rounded-xl px-6 data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="text-left text-foreground hover:text-primary hover:no-underline py-6">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-6">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
