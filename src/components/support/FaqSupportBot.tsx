import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Headphones, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAQ_FALLBACK, FAQ_PRIVATE_REDIRECT, findFaqMatch, isPrivateFaqQuestion } from "@/lib/faq";

interface ChatMessage {
  id: number;
  role: "bot" | "user";
  text: string;
}

const suggestions = ["How does the evaluation work?", "What are the drawdown rules?", "How do payouts work?"];
const SESSION_DURATION_MS = 5 * 60 * 1000;
const welcomeMessage: ChatMessage = { id: 1, role: "bot", text: "Hi, I’m the PrimePips FAQ assistant. Ask me about our published evaluation and trading rules." };

export function FaqSupportBot() {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [lastUserMessageAt, setLastUserMessageAt] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const messageId = useRef(2);

  useEffect(() => {
    const openBot = () => setOpen(true);
    window.addEventListener("primepips:open-support", openBot);
    return () => window.removeEventListener("primepips:open-support", openBot);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (lastUserMessageAt === null) return;
    const timeout = window.setTimeout(() => {
      setMessages([welcomeMessage]);
      setQuestion("");
      setLoading(false);
      setLastUserMessageAt(null);
    }, Math.max(0, SESSION_DURATION_MS - (Date.now() - lastUserMessageAt)));
    return () => window.clearTimeout(timeout);
  }, [lastUserMessageAt]);

  if (location.pathname.startsWith("/admin")) return null;

  const submitQuestion = (event?: FormEvent) => {
    event?.preventDefault();
    const submittedQuestion = question.trim().slice(0, 300);
    if (!submittedQuestion || loading) return;
    setQuestion("");
    setMessages((current) => [...current, { id: messageId.current++, role: "user", text: submittedQuestion }]);
    setLastUserMessageAt(Date.now());
    setLoading(true);
    window.setTimeout(() => {
      const answer = isPrivateFaqQuestion(submittedQuestion)
        ? FAQ_PRIVATE_REDIRECT
        : findFaqMatch(submittedQuestion)?.answer || FAQ_FALLBACK;
      setMessages((current) => [...current, { id: messageId.current++, role: "bot", text: answer }]);
      setLoading(false);
    }, 350);
  };

  return (
    <div className="fixed bottom-5 right-4 z-[60] sm:bottom-6 sm:right-6">
      {open && (
        <section aria-label="PrimePips FAQ support" className="mb-3 flex h-[min(560px,calc(100vh-7rem))] w-[calc(100vw-2rem)] max-w-[380px] flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl">
          <header className="flex items-center justify-between bg-[#111820] px-4 py-3 text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/50 bg-primary/15"><span className="font-serif text-sm font-bold text-white">PP</span></div>
              <div><p className="font-serif text-lg font-bold">Prime<span className="text-primary">Pips</span></p><p className="text-xs text-white/65">FAQ support</p></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close support chat" className="rounded-md p-2 text-white/75 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary"><X className="h-5 w-5" /></button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto bg-background/95 p-3" aria-live="polite">
            {messages.map((message) => <div key={message.id} className={cn("max-w-[88%] rounded-lg px-3 py-2 text-sm leading-relaxed", message.role === "bot" ? "bg-secondary text-foreground" : "ml-auto bg-primary text-primary-foreground")}>{message.text}</div>)}
            {loading && <div className="flex items-center gap-2 text-sm text-muted-foreground"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Checking the FAQ...</div>}
            {messages.length === 1 && <div className="space-y-2 pt-1"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Suggested questions</p>{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => { setQuestion(suggestion); inputRef.current?.focus(); }} className="block w-full rounded-md border border-border bg-card px-3 py-2 text-left text-xs text-foreground transition hover:border-primary hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary">{suggestion}</button>)}</div>}
          </div>
          <div className="border-t border-border bg-card p-3"><form onSubmit={submitQuestion} className="flex gap-2"><label htmlFor="faq-support-question" className="sr-only">Ask a PrimePips FAQ question</label><input ref={inputRef} id="faq-support-question" value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={300} placeholder="Ask about the FAQ..." className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary" /><button type="submit" disabled={!question.trim() || loading} aria-label="Send question" className="rounded-md bg-primary px-3 text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-primary"><Send className="h-4 w-4" /></button></form><div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><Link to="/faq" onClick={() => setOpen(false)} className="hover:text-primary">Browse all FAQ</Link><a href="mailto:support@primepips.com" className="hover:text-primary">Contact support</a></div></div>
        </section>
      )}
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-label={open ? "Close PrimePips support" : "Open PrimePips support"} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary bg-[#111820] text-primary shadow-lg transition hover:scale-105 hover:bg-[#1c2730] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"><span className="sr-only">PrimePips support</span>{open ? <X className="h-6 w-6" /> : <Headphones className="h-6 w-6" />}</button>
    </div>
  );
}