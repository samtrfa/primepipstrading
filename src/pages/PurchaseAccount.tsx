import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Check, Zap, Target, Clock, Rocket, Copy, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type ChallengeType = "three_step" | "two_step" | "one_step" | "instant";

interface PricingTier {
  size: number;
  label: string;
  prices: Record<ChallengeType, number>;
}

const challengeTypes: { id: ChallengeType; label: string; icon: React.ElementType; description: string; badge?: string }[] = [
  { id: "three_step", label: "3-Step Challenge", icon: Target, description: "3 phases to prove your skills" },
  { id: "two_step", label: "2-Step Challenge", icon: Clock, description: "2 phases, faster evaluation" },
  { id: "one_step", label: "1-Step Challenge", icon: Zap, description: "Single phase evaluation", badge: "Popular" },
  { id: "instant", label: "Instant Funding", icon: Rocket, description: "Skip evaluation, trade funded", badge: "Best Value" },
];

const pricingTiers: PricingTier[] = [
  { size: 5000, label: "$5K", prices: { three_step: 35, two_step: 49, one_step: 69, instant: 149 } },
  { size: 10000, label: "$10K", prices: { three_step: 59, two_step: 79, one_step: 99, instant: 249 } },
  { size: 25000, label: "$25K", prices: { three_step: 119, two_step: 149, one_step: 179, instant: 449 } },
  { size: 50000, label: "$50K", prices: { three_step: 199, two_step: 249, one_step: 299, instant: 749 } },
  { size: 100000, label: "$100K", prices: { three_step: 349, two_step: 449, one_step: 549, instant: 1299 } },
];

// Demo crypto wallet address (replace with your actual wallet)
const CRYPTO_WALLET = "0x742d35Cc6634C0532925a3b844Bc9e7595f3217a";

export default function PurchaseAccount() {
  const [selectedChallenge, setSelectedChallenge] = useState<ChallengeType>("one_step");
  const [selectedSize, setSelectedSize] = useState<number>(10000);
  const [showPayment, setShowPayment] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
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
      {/* Header */}
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
            {/* Challenge Type Selection */}
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

            {/* Account Size Selection */}
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

            {/* Summary & Purchase */}
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
          /* Payment Section */
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
                <CardTitle className="text-2xl">Crypto Payment</CardTitle>
                <CardDescription>
                  Send exactly ${price} in USDT/USDC/ETH/BTC to complete your purchase
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-secondary/50 rounded-lg p-6">
                  <div className="text-center mb-4">
                    <div className="text-4xl font-bold text-primary mb-2">${price}</div>
                    <div className="text-muted-foreground">
                      {challengeTypes.find(c => c.id === selectedChallenge)?.label} - ${selectedSize.toLocaleString()} Account
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground block mb-2">
                        Wallet Address (ERC-20 / BEP-20)
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
                        Accepted: USDT, USDC, ETH, BTC
                      </p>
                      <p className="flex items-center gap-2">
                        <Check className="w-4 h-4 text-primary" />
                        Networks: Ethereum, BSC, Polygon, Arbitrum
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
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}