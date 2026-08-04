import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Check, Zap, Target, Clock, Rocket, Copy, ArrowLeft, HelpCircle, Landmark, Bitcoin, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ChallengeType = "three_step" | "two_step" | "one_step" | "instant";

interface PricingTier {
  size: number;
  label: string;
  prices: Record<ChallengeType, number>;
}

interface ChallengeRules {
  dailyDrawdown: string;
  maxDrawdown: string;
  profitTarget: string;
  consistencyRule: string;
  minTradingDays: string;
  weekendTrading: string;
  maxTradingDays: string;
  payouts?: string;
}

const ruleExplanations: Record<string, string> = {
  dailyDrawdown: "Maximum loss allowed in a single trading day. If your daily losses exceed this percentage, you breach the account.",
  maxDrawdown: "Maximum total loss allowed from your highest account balance. Trailing means it follows your highest balance reached.",
  profitTarget: "The profit percentage you need to achieve to pass the evaluation phase or qualify for payouts.",
  consistencyRule: "Some challenges require consistent trading patterns. No consistency rule means you can trade freely.",
  minTradingDays: "Minimum number of days you must actively trade before completing a phase.",
  weekendTrading: "Whether you can hold trades over the weekend or must close positions before market close on Friday.",
  maxTradingDays: "Maximum time allowed to complete the challenge. Unlimited means no time pressure.",
  payouts: "How often you can withdraw your profits from the funded account.",
};

const challengeRules: Record<ChallengeType, ChallengeRules> = {
  three_step: {
    dailyDrawdown: "4%",
    maxDrawdown: "6% (trailing)",
    profitTarget: "10%",
    consistencyRule: "None",
    minTradingDays: "4 days",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
  },
  two_step: {
    dailyDrawdown: "4%",
    maxDrawdown: "8% (trailing)",
    profitTarget: "10%",
    consistencyRule: "None",
    minTradingDays: "4 days",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
  },
  one_step: {
    dailyDrawdown: "6%",
    maxDrawdown: "8% (trailing)",
    profitTarget: "10%",
    consistencyRule: "None",
    minTradingDays: "4 days",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
  },
  instant: {
    dailyDrawdown: "6%",
    maxDrawdown: "10%",
    profitTarget: "N/A",
    consistencyRule: "None",
    minTradingDays: "None",
    weekendTrading: "Allowed",
    maxTradingDays: "Unlimited",
    payouts: "Biweekly",
  },
};

const challengeTypes: { id: ChallengeType; label: string; icon: React.ElementType; description: string; badge?: string }[] = [
  { id: "three_step", label: "3-Step Challenge", icon: Target, description: "3 phases to prove your skills" },
  { id: "two_step", label: "2-Step Challenge", icon: Clock, description: "2 phases, faster evaluation" },
  { id: "one_step", label: "1-Step Challenge", icon: Zap, description: "Single phase evaluation", badge: "Popular" },
  { id: "instant", label: "Instant Funding", icon: Rocket, description: "Skip evaluation, trade funded", badge: "Best Value" },
];

const pricingTiers: PricingTier[] = [
  { size: 5000, label: "$5K", prices: { three_step: 16, two_step: 20, one_step: 18, instant: 18 } },
  { size: 10000, label: "$10K", prices: { three_step: 28, two_step: 40, one_step: 34, instant: 34 } },
  { size: 25000, label: "$25K", prices: { three_step: 56, two_step: 80, one_step: 62, instant: 62 } },
  { size: 50000, label: "$50K", prices: { three_step: 144, two_step: 198, one_step: 153, instant: 153 } },
  { size: 100000, label: "$100K", prices: { three_step: 320, two_step: 396, one_step: 342, instant: 342 } },
  { size: 200000, label: "$200K", prices: { three_step: 490, two_step: 560, one_step: 520, instant: 520 } },
];

const CRYPTO_WALLET = "0x66aeC4645A4d204653d2e62FCA26968Ce1B5db1a";

type PaymentMethod = "korapay" | "crypto";

function RuleItem({ label, value, ruleKey }: { label: string; value: string; ruleKey: string }) {
  return (
    <div className="flex justify-between items-center py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-muted-foreground text-sm">{label}</span>
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-primary transition-colors">
              <HelpCircle className="w-3.5 h-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" className="max-w-xs text-sm">
            {ruleExplanations[ruleKey]}
          </PopoverContent>
        </Popover>
      </div>
      <span className="font-medium text-foreground text-sm">{value}</span>
    </div>
  );
}

export default function PurchaseAccount() {
  const [searchParams] = useSearchParams();
  const challengeParam = searchParams.get("challenge") as ChallengeType | null;
  const sizeParam = searchParams.get("size");

  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeType>(
    challengeParam && ["three_step", "two_step", "one_step", "instant"].includes(challengeParam) 
      ? challengeParam 
      : "one_step"
  );
  const [selectedSize, setSelectedSize] = useState<number>(
    sizeParam ? parseInt(sizeParam) : 10000
  );
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("korapay");
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/login");
      } else {
        setUserId(session.user.id);
      }
    });
  }, [navigate]);

  const selectedTier = pricingTiers.find(t => t.size === selectedSize);
  const price = selectedTier?.prices[selectedChallenge] || 0;
  const rules = challengeRules[selectedChallenge];

  const handleKorapayCheckout = async () => {
    setIsProcessing(true);

    const { data, error } = await supabase.functions.invoke("korapay-checkout", {
      body: {
        challengeType: selectedChallenge,
        accountSize: selectedSize,
        redirectUrl: `${window.location.origin}/dashboard`,
      },
    });

    if (error) {
      const details =
        error instanceof FunctionsHttpError ? await error.context.text() : error.message;
      console.error("korapay-checkout failed:", details);
      setIsProcessing(false);
      toast({
        title: "Checkout failed",
        description: "We couldn't start your payment. Please try again.",
        variant: "destructive",
      });
      return;
    }

    if (!data?.checkoutUrl) {
      setIsProcessing(false);
      toast({
        title: "Checkout failed",
        description: "No checkout link was returned. Please try again.",
        variant: "destructive",
      });
      return;
    }

    window.location.href = data.checkoutUrl;
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(CRYPTO_WALLET);
    toast({
      title: "Address copied!",
      description: "Wallet address copied to clipboard.",
    });
  };

  const handlePurchase = async () => {
    if (!userId) return;
    
    setIsProcessing(true);

    const { error } = await supabase.from("accounts").insert({
      user_id: userId,
      challenge_type: selectedChallenge,
      account_size: selectedSize,
      price: price,
      status: "pending_payment",
      current_balance: selectedSize,
      payment_address: CRYPTO_WALLET,
    });

    setIsProcessing(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create account. Please try again.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Account Created!",
      description: "Send payment to complete your purchase. We'll activate your account once confirmed.",
    });

    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2">
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-gold rounded-lg opacity-20" />
                  <TrendingUp className="w-6 h-6 text-primary relative z-10" />
                </div>
                <span className="text-xl font-serif font-bold text-foreground">
                  Prime<span className="text-primary">Pips</span>
                </span>
              </Link>
              <Button variant="ghost" onClick={() => navigate("/dashboard")}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          {!showPayment ? (
            <>
              <div className="text-center mb-12">
                <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
                  Choose Your <span className="text-primary">Challenge</span>
                </h1>
                <p className="text-muted-foreground max-w-2xl mx-auto">
                  Select your preferred evaluation path and account size. All accounts come with up to 90% profit split.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
                {challengeTypes.map((challenge) => (
                  <Card
                    key={challenge.id}
                    variant="elevated"
                    className={cn(
                      "cursor-pointer transition-all relative",
                      selectedChallenge === challenge.id
                        ? "ring-2 ring-primary border-primary"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => setSelectedChallenge(challenge.id)}
                  >
                    {challenge.badge && (
                      <Badge className="absolute -top-2 right-4 bg-primary text-primary-foreground">
                        {challenge.badge}
                      </Badge>
                    )}
                    <CardContent className="p-6 text-center">
                      <challenge.icon className={cn(
                        "w-12 h-12 mx-auto mb-4",
                        selectedChallenge === challenge.id ? "text-primary" : "text-muted-foreground"
                      )} />
                      <h3 className="font-semibold text-foreground mb-2">{challenge.label}</h3>
                      <p className="text-sm text-muted-foreground">{challenge.description}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card variant="elevated" className="max-w-3xl mx-auto mb-12">
                <CardHeader>
                  <CardTitle className="text-lg">
                    {challengeTypes.find(c => c.id === selectedChallenge)?.label} Rules
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 divide-y md:divide-y-0 md:divide-x divide-border">
                    <div className="space-y-1 pr-0 md:pr-6">
                      <RuleItem label="Daily Drawdown" value={rules.dailyDrawdown} ruleKey="dailyDrawdown" />
                      <RuleItem label="Max Drawdown" value={rules.maxDrawdown} ruleKey="maxDrawdown" />
                      <RuleItem label="Profit Target" value={rules.profitTarget} ruleKey="profitTarget" />
                      {rules.payouts && (
                        <RuleItem label="Payouts" value={rules.payouts} ruleKey="payouts" />
                      )}
                    </div>
                    <div className="space-y-1 pl-0 md:pl-6 pt-2 md:pt-0">
                      <RuleItem label="Consistency Rule" value={rules.consistencyRule} ruleKey="consistencyRule" />
                      <RuleItem label="Min Trading Days" value={rules.minTradingDays} ruleKey="minTradingDays" />
                      <RuleItem label="Weekend Trading" value={rules.weekendTrading} ruleKey="weekendTrading" />
                      <RuleItem label="Max Trading Days" value={rules.maxTradingDays} ruleKey="maxTradingDays" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <h2 className="text-2xl font-serif font-bold text-foreground mb-6 text-center">
                Select Account Size
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
                {pricingTiers.map((tier) => (
                  <Card
                    key={tier.size}
                    variant="elevated"
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedSize === tier.size
                        ? "ring-2 ring-primary border-primary"
                        : "hover:border-primary/50"
                    )}
                    onClick={() => setSelectedSize(tier.size)}
                  >
                    <CardContent className="p-6 text-center">
                      <div className="text-3xl font-bold text-foreground mb-2">{tier.label}</div>
                      <div className="text-2xl font-semibold text-primary">
                        ${tier.prices[selectedChallenge]}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {challengeTypes.find(c => c.id === selectedChallenge)?.label}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card variant="gold" className="max-w-2xl mx-auto">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Challenge Type</span>
                    <span className="font-medium text-foreground">
                      {challengeTypes.find(c => c.id === selectedChallenge)?.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Account Size</span>
                    <span className="font-medium text-foreground">
                      ${selectedSize.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border">
                    <span className="text-muted-foreground">Profit Split</span>
                    <span className="font-medium text-foreground">Up to 90%</span>
                  </div>
                  <div className="flex justify-between items-center py-4">
                    <span className="text-lg font-semibold text-foreground">Total</span>
                    <span className="text-3xl font-bold text-primary">${price}</span>
                  </div>

                  <div className="space-y-3 pt-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      No time limits on evaluation
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      Trade forex, crypto, indices & commodities
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary" />
                      Instant account activation
                    </div>
                  </div>

                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full mt-6"
                    onClick={() => setShowPayment(true)}
                  >
                    Proceed to Payment
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="max-w-2xl mx-auto">
              <Button
                variant="ghost"
                className="mb-6"
                onClick={() => setShowPayment(false)}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Selection
              </Button>

              <Card variant="gold">
                <CardHeader className="text-center">
                  <CardTitle className="text-2xl">Complete Your Payment</CardTitle>
                  <CardDescription>
                    {challengeTypes.find((c) => c.id === selectedChallenge)?.label} — $
                    {selectedSize.toLocaleString()} account · ${price}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Payment method selector */}
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("korapay")}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all",
                        paymentMethod === "korapay"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Landmark
                        className={cn(
                          "w-6 h-6",
                          paymentMethod === "korapay" ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-sm font-medium text-foreground">Bank Payment</span>
                      <span className="text-[11px] text-muted-foreground">Recommended</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("crypto")}
                      className={cn(
                        "flex flex-col items-center gap-1 rounded-xl border-2 p-4 transition-all",
                        paymentMethod === "crypto"
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <Bitcoin
                        className={cn(
                          "w-6 h-6",
                          paymentMethod === "crypto" ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <span className="text-sm font-medium text-foreground">Crypto</span>
                      <span className="text-[11px] text-muted-foreground">USDT / USDC (BSC)</span>
                    </button>
                  </div>

                  {paymentMethod === "korapay" ? (
                    <div className="space-y-6">
                      <div className="bg-secondary/50 rounded-lg p-6 space-y-5">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-primary mb-1">
                            ${price}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            Converted to naira automatically on the secure checkout page
                          </div>
                        </div>

                        <div className="text-sm text-muted-foreground space-y-2">
                          <p className="flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-primary" />
                            Bank transfer & pay with bank
                          </p>
                          <p className="flex items-center gap-2">
                            <Check className="w-4 h-4 text-primary" />
                            Account activated automatically after payment
                          </p>
                        </div>
                      </div>

                      <Button
                        variant="gold"
                        size="lg"
                        className="w-full"
                        onClick={handleKorapayCheckout}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Redirecting…
                          </>
                        ) : (
                          "Pay Securely"
                        )}
                      </Button>

                      <p className="text-center text-sm text-muted-foreground">
                        You'll be taken to a secure checkout to finish paying, then returned to your
                        dashboard.
                      </p>
                    </div>
                  ) : (
                  <div className="space-y-6">
                  <div className="bg-secondary/50 rounded-lg p-6">
                    <div className="text-center mb-4">
                      <div className="text-4xl font-bold text-primary mb-2">${price}</div>
                      <div className="text-muted-foreground">
                        {challengeTypes.find(c => c.id === selectedChallenge)?.label} - ${selectedSize.toLocaleString()} Account
                      </div>
                    </div>

                    {/* QR Code */}
                    <div className="flex justify-center mb-6">
                      <div className="p-4 bg-white rounded-xl shadow-sm">
                        <img 
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(CRYPTO_WALLET)}`}
                          alt="Payment QR Code" 
                          className="w-44 h-44"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground block mb-2">
                          Wallet Address (BEP-20 - Binance Smart Chain)
                        </label>
                        <div className="flex gap-2">
                          <code className="flex-1 bg-background p-3 rounded-lg text-sm text-foreground break-all border border-border">
                            {CRYPTO_WALLET}
                          </code>
                          <Button variant="outline" onClick={copyAddress}>
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground space-y-2">
                        <p className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary" />
                          Accepted: USDT, USDC, BNB (BEP-20 tokens only)
                        </p>
                        <p className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary" />
                          Network: Binance Smart Chain (BSC)
                        </p>
                        <p className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-primary" />
                          Account activated within 24 hours after confirmation
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="gold"
                    size="lg"
                    className="w-full"
                    onClick={handlePurchase}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing..." : "I've Sent the Payment"}
                  </Button>

                  <p className="text-center text-sm text-muted-foreground">
                    After sending payment, click the button above. Your account will be activated once we confirm the transaction.
                  </p>
                  </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
      </main>
    </div>
  );
}
