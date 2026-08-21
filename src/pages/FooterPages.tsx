import { Link } from "react-router-dom";
import { Mail, ArrowRight, BriefcaseBusiness, Newspaper, ShieldAlert, ReceiptText } from "lucide-react";
import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type PageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  children: React.ReactNode;
};

function Page({ eyebrow, title, intro, children }: PageProps) {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-20">
        <section className="border-b border-border bg-gradient-hero py-16">
          <div className="container mx-auto max-w-5xl px-4">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
            <h1 className="mb-4 text-4xl font-serif font-bold text-foreground md:text-5xl">{title}</h1>
            <p className="max-w-3xl text-lg leading-8 text-muted-foreground">{intro}</p>
          </div>
        </section>
        <article className="container mx-auto max-w-5xl px-4 py-12">{children}</article>
      </main>
      <Footer />
    </div>
  );
}

function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 text-2xl font-serif font-semibold text-foreground">{title}</h2>
      <div className="space-y-4 leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export function About() {
  return (
    <Page eyebrow="Company" title="Built for deliberate traders" intro="PrimePips gives traders a structured environment to practise execution, risk management, and consistency through simulated trading assessments.">
      <InfoSection title="Our purpose">
        <p>Trading skill grows through repetition, honest review, and disciplined risk controls. PrimePips brings those habits into one focused workspace with challenge rules, market data, performance tracking, and a clear record of each decision.</p>
        <p>Our platform is designed for practice and assessment. Account balances, orders, and performance results are simulated, and users should not expect real rewards or financial returns from using the Services. Read our <Link className="text-primary hover:underline" to="/terms">Terms and Conditions</Link> before purchasing.</p>
      </InfoSection>
      <div className="grid gap-6 md:grid-cols-3">
        {[
          ["Clarity", "Rules and account metrics are presented so you can understand what is being measured."],
          ["Discipline", "The platform emphasizes repeatable decisions over one-off wins or dramatic risk."],
          ["Progress", "Review your process, identify patterns, and build a trading routine that can improve."],
        ].map(([title, text]) => <Card key={title} variant="elevated"><CardContent className="p-6"><h3 className="mb-2 font-serif text-xl font-semibold text-foreground">{title}</h3><p className="text-sm leading-6 text-muted-foreground">{text}</p></CardContent></Card>)}
      </div>
      <div className="mt-12"><Button asChild><Link to="/how-it-works">Explore how it works <ArrowRight className="ml-2 h-4 w-4" /></Link></Button></div>
    </Page>
  );
}

export function Careers() {
  return (
    <Page eyebrow="Careers" title="Help make trading practice more honest" intro="We are building a focused product for people who want a clearer, more disciplined way to practise trading skills.">
      <InfoSection title="How we work">
        <p>We value direct communication, careful systems thinking, and respect for the decisions users make with their time and money. Our work spans product design, market-data systems, trust and safety, customer support, and education.</p>
        <p>We look for people who can explain complex ideas plainly, test their assumptions, and improve a system without losing sight of the person using it.</p>
      </InfoSection>
      <Card variant="elevated"><CardContent className="p-6"><div className="mb-4 flex items-start gap-4"><BriefcaseBusiness className="mt-1 h-6 w-6 text-primary" /><div><h2 className="font-serif text-2xl font-semibold text-foreground">Open roles</h2><p className="mt-2 leading-7 text-muted-foreground">There are no public openings listed right now. We still welcome thoughtful introductions from people with relevant experience.</p></div></div><Button asChild variant="outline"><a href="mailto:careers@primepips.com">Contact the team <Mail className="ml-2 h-4 w-4" /></a></Button></CardContent></Card>
    </Page>
  );
}

export function Contact() {
  return (
    <Page eyebrow="Contact" title="We are here to help" intro="Send us a clear question and the right team can help you understand an account, payment, rule, or technical issue.">
      <div className="grid gap-6 md:grid-cols-2">
        {[
          ["General support", "Questions about your account, product rules, or platform access.", "support@primepips.com"],
          ["Payments", "Questions about checkout, payment references, or transaction status.", "payments@primepips.com"],
          ["Privacy", "Requests concerning personal information or this Privacy Policy.", "privacy@primepips.com"],
          ["Partnerships", "Media, affiliate, or business partnership enquiries.", "partners@primepips.com"],
        ].map(([title, text, email]) => <Card key={title} variant="elevated"><CardContent className="p-6"><Mail className="mb-4 h-6 w-6 text-primary" /><h2 className="font-serif text-xl font-semibold text-foreground">{title}</h2><p className="my-3 text-sm leading-6 text-muted-foreground">{text}</p><a className="break-all text-sm text-primary hover:underline" href={`mailto:${email}`}>{email}</a></CardContent></Card>)}
      </div>
      <InfoSection title="Before contacting support"><p>Include the email address associated with your account, a payment reference or account identifier when relevant, and the approximate time of the issue. Never send passwords, one-time codes, full card numbers, private keys, or recovery phrases.</p></InfoSection>
    </Page>
  );
}

export function Press() {
  return (
    <Page eyebrow="Press" title="PrimePips newsroom" intro="Find the information and context needed to describe PrimePips accurately.">
      <InfoSection title="About the company"><p>PrimePips is a simulated trading skills platform focused on structured practice, evaluation, and trading education. Account balances and performance results shown through the Services are simulated. They are not real trading capital, and no real rewards or financial returns should be expected.</p></InfoSection>
      <Card variant="elevated"><CardContent className="p-6"><Newspaper className="mb-4 h-7 w-7 text-primary" /><h2 className="font-serif text-2xl font-semibold text-foreground">Media enquiries</h2><p className="my-3 leading-7 text-muted-foreground">For interview requests, fact checks, brand assets, or company information, contact our partnerships team. Please allow reasonable time for a response.</p><a className="text-primary hover:underline" href="mailto:partners@primepips.com">partners@primepips.com</a></CardContent></Card>
    </Page>
  );
}

const articles = [
  ["The trader's pre-session checklist", "A practical framework for defining risk, reviewing context, and entering a session with a plan."],
  ["Why consistency beats intensity", "How repeatable process decisions create better feedback than occasional oversized bets."],
  ["Reading your drawdown", "Use drawdown as a diagnostic signal for sizing, execution, and emotional discipline."],
];

export function Blog() {
  return (
    <Page eyebrow="Resources" title="The PrimePips journal" intro="Practical notes on trading process, risk awareness, and building better habits.">
      <div className="grid gap-6 md:grid-cols-3">{articles.map(([title, text]) => <Card key={title} variant="elevated"><CardContent className="flex h-full flex-col p-6"><p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em] text-primary">Trading process</p><h2 className="font-serif text-xl font-semibold text-foreground">{title}</h2><p className="mt-3 flex-1 text-sm leading-6 text-muted-foreground">{text}</p><p className="mt-6 text-xs text-muted-foreground">Coming soon</p></CardContent></Card>)}</div>
      <p className="mt-10 text-sm leading-6 text-muted-foreground">Educational material is general information, not financial, investment, tax, or trading advice. See the <Link className="text-primary hover:underline" to="/risk-disclosure">Risk Disclosure</Link> before acting on any market-related information.</p>
    </Page>
  );
}

export function RiskDisclosure() {
  return (
    <Page eyebrow="Legal" title="Risk Disclosure" intro="Trading and market-related activity involves uncertainty. Understand the risks before using the Services or making a separate live-trading decision.">
      <InfoSection title="Market risk"><p>Foreign exchange, crypto, indices, commodities, and other financial markets can move rapidly and unpredictably. Leverage and margin can magnify gains and losses. Prices may gap, spreads may widen, liquidity may disappear, and an order may not execute at the price you expect.</p><p>Past performance, simulated performance, examples, rankings, and educational content do not predict future results. You may lose more than expected in a separate live account, including through fees, financing costs, slippage, or forced liquidation.</p></InfoSection>
      <InfoSection title="Simulation risk"><p>PrimePips accounts are simulated accounts created to test trading skills. Orders are not executed with real market capital through the PrimePips platform. Simulated fills, spreads, data, latency, and platform behavior may differ from live trading, so a simulated result cannot establish that a strategy will work with real money.</p></InfoSection>
      <InfoSection title="Your responsibility"><p>Decide independently whether trading is appropriate for you. Do not use money needed for essential expenses, borrow to trade, or rely on trading as guaranteed income. Consider seeking advice from a qualified financial, legal, or tax professional before opening a separate live account.</p></InfoSection>
    </Page>
  );
}

export function RefundPolicy() {
  return (
    <Page eyebrow="Legal" title="Refund Policy" intro="This policy explains how refund requests for PrimePips products are reviewed and processed.">
      <InfoSection title="General rule"><p>PrimePips charges fees for access to simulated assessments, software, market data, and related Services. Unless a product page, checkout notice, or mandatory law provides otherwise, fees are not refundable after access has been delivered, a challenge has been started, or the Services have been used.</p></InfoSection>
      <InfoSection title="How to request a refund"><p>Contact support using the official channel and include your account email, order or payment reference, purchase date, and reason for the request. Do not include passwords, one-time codes, full card numbers, or private keys. We may request additional information to verify the transaction and protect your account.</p></InfoSection>
      <InfoSection title="Review factors"><p>We may consider the applicable policy at purchase, whether access was delivered or used, activity on the account, payment status, duplicate or unauthorized payment evidence, technical records, prior adjustments, and consumer rights that apply to you. A refund, credit, reset, or goodwill adjustment provided in one case does not guarantee the same outcome in another.</p></InfoSection>
      <Card variant="elevated"><CardContent className="p-6"><ReceiptText className="mb-4 h-7 w-7 text-primary" /><h2 className="font-serif text-2xl font-semibold text-foreground">Payment disputes</h2><p className="mt-3 leading-7 text-muted-foreground">Please contact support before initiating a chargeback when possible. We will investigate payment issues, but nothing here limits rights that cannot legally be excluded.</p></CardContent></Card>
    </Page>
  );
}