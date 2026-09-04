export interface FaqEntry {
  question: string;
  answer: string;
}

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  { question: "How does the evaluation process work?", answer: "Our evaluation consists of two phases. In Phase 1, you need to reach the profit target while respecting daily and overall drawdown limits. Phase 2 has a lower profit target. Once you pass both phases, you receive a funded account with real capital." },
  { question: "What is the profit split?", answer: "Depending on your account size, you can keep up to 90% of all profits generated on your funded account. The profit split starts at 80% for Starter accounts and goes up to 90% for Expert and Master accounts." },
  { question: "How long do I have to pass the evaluation?", answer: "There are no time limits on our evaluations. You can take as long as you need to reach the profit targets. We believe in quality trading, not rushed decisions." },
  { question: "What trading instruments can I trade?", answer: "You can trade across various asset classes through our trading panel. We offer competitive spreads and flexible leverage." },
  { question: "How do payouts work?", answer: "Once funded, you can request a payout anytime you have profits available. Payouts are processed within 24-48 hours via bank transfer, cryptocurrency, or other supported methods." },
  { question: "What are the drawdown rules?", answer: "Daily drawdown is 5% of your starting balance for the day. Overall drawdown is 10% from your initial balance. These limits reset as your account grows through trading profits." },
  { question: "Can I hold trades over the weekend?", answer: "Yes, you can hold trades over the weekend and during news events. We don't have restrictions on trading styles - scalping, swing trading, and holding positions overnight are all allowed." },
  { question: "What happens if I fail the evaluation?", answer: "If you violate a rule, your evaluation ends. However, we offer a 14-day refund guarantee on all new purchases if you're not satisfied. You can also purchase a new challenge at a discounted reset price." },
];

const FILLER_WORDS = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "how", "i", "is", "it", "of", "the", "to", "what", "when", "with", "you"]);
const PRIVATE_QUESTION_WORDS = ["my account", "my payment", "payment failed", "payment problem", "payout status", "my payout", "kyc", "identity", "verification", "breach", "failed account", "complaint"];
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9%\s-]/g, " ").replace(/\s+/g, " ").trim();
const keywords = (value: string) => normalize(value).split(" ").filter((word) => word.length > 2 && !FILLER_WORDS.has(word));

export const FAQ_FALLBACK = "I can help with questions covered in the PrimePips FAQ. I’m not confident I have the right answer for that question. Please review the FAQ or contact support at support@primepips.com.";
export const FAQ_PRIVATE_REDIRECT = "I can’t access or change account information here. Please contact support at support@primepips.com, or open your dashboard to review your account details.";

export function isPrivateFaqQuestion(question: string) {
  const normalizedQuestion = normalize(question);
  return PRIVATE_QUESTION_WORDS.some((phrase) => normalizedQuestion.includes(phrase));
}

export function findFaqMatch(question: string): FaqEntry | null {
  const normalizedQuestion = normalize(question);
  if (!normalizedQuestion || isPrivateFaqQuestion(normalizedQuestion)) return null;
  const questionWords = new Set(keywords(normalizedQuestion));
  const ranked = FAQ_ENTRIES.map((entry) => {
    const entryWords = new Set(keywords(`${entry.question} ${entry.answer}`));
    const sharedWords = [...questionWords].filter((word) => entryWords.has(word)).length;
    const phraseBonus = normalizedQuestion.includes(normalize(entry.question)) ? 4 : 0;
    return { entry, score: sharedWords + phraseBonus };
  }).sort((left, right) => right.score - left.score);
  const best = ranked[0];
  const runnerUp = ranked[1];
  if (!best || best.score < 2 || (runnerUp && best.score === runnerUp.score && best.score < 4)) return null;
  return best.entry;
}