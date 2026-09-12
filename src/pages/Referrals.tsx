import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Copy,
  Users,
  Gift,
  TrendingUp,
  CheckCircle2,
  Clock3,
  Send,
  ArrowDownRight,
  Wallet,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Referral {
  id: string;
  name: string;
  email: string;
  status: "pending" | "active" | "completed";
  commission_earned: number;
  referred_at: string;
  account_purchased: boolean;
}

interface AffiliateApplication {
  id: string;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  created_at: string;
  desired_code: string;
}

interface AffiliatePurchase {
  id: string;
  user_id: string;
  account_size: number;
  challenge_type: string;
  status: string;
  price: number;
  coupon_code: string;
  created_at: string;
}

interface PaymentMethod {
  id: string;
  network: string;
  wallet_address: string;
  label: string | null;
}

const emptyApplication = {
  desired_code: "",
  phone: "",
  country: "",
  website: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  x_handle: "",
  audience_size: "",
  promotion_channels: "",
  affiliate_experience: "",
  promotion_plan: "",
};

const countryOptions = [
  "Argentina", "Australia", "Austria", "Belgium", "Brazil", "Canada", "China", "Colombia", "Denmark", "Egypt",
  "Finland", "France", "Germany", "Ghana", "Greece", "India", "Indonesia", "Ireland", "Israel", "Italy",
  "Japan", "Kenya", "Malaysia", "Mexico", "Morocco", "Netherlands", "New Zealand", "Nigeria", "Norway", "Pakistan",
  "Philippines", "Poland", "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", "Singapore", "South Africa", "South Korea",
  "Spain", "Sweden", "Switzerland", "Tanzania", "Thailand", "Turkey", "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom",
  "United States", "Vietnam", "Zambia", "Zimbabwe",
];

export default function ReferralsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralLink, setReferralLink] = useState("");
  const [affiliateCoupon, setAffiliateCoupon] = useState<{ code: string; discount_percent: number; is_active: boolean } | null>(null);
  const [affiliatePurchases, setAffiliatePurchases] = useState<AffiliatePurchase[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const [application, setApplication] = useState<AffiliateApplication | null>(null);
  const [applicationForm, setApplicationForm] = useState(emptyApplication);
  const [submittingApplication, setSubmittingApplication] = useState(false);
  const [commissionAvailable, setCommissionAvailable] = useState(0);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }
      if (session.user.app_metadata?.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }
      const affiliate = session.user.app_metadata?.affiliate === true;
      setIsAffiliate(affiliate);

      if (!affiliate) {
        const { data, error } = await supabase
          .from("affiliate_applications")
          .select("id, status, rejection_reason, created_at, desired_code")
          .maybeSingle();
        if (error) toast({ title: "Unable to load affiliate application", description: "Please refresh the page and try again.", variant: "destructive" });
        else setApplication(data as AffiliateApplication | null);
        setLoading(false);
        return;
      }

      // The first eight characters are the public referral code stored at signup.
      const [{ data: codeData }, { data: couponData, error: couponError }] = await Promise.all([
        supabase.from("affiliate_codes").select("code").maybeSingle(),
        supabase.from("affiliate_codes").select("code, discount_percent, is_active").maybeSingle(),
      ]);

      if (couponError) {
        console.error("Error fetching affiliate coupon:", couponError);
      } else {
        setAffiliateCoupon(couponData as { code: string; discount_percent: number; is_active: boolean } | null);
      }

      if (codeData?.code) {
        const { data: purchaseData, error: purchaseError } = await supabase
          .from("accounts")
          .select("id, user_id, account_size, challenge_type, status, price, coupon_code, created_at")
          .eq("coupon_code", codeData.code)
          .in("status", ["active", "funded"])
          .order("created_at", { ascending: false });

        if (purchaseError) {
          console.error("Error fetching affiliate purchases:", purchaseError);
        } else {
          setAffiliatePurchases((purchaseData ?? []) as AffiliatePurchase[]);
        }
      } else {
        setAffiliatePurchases([]);
      }

      setReferralLink(`${window.location.origin}/?ref=${codeData?.code || session.user.id.slice(0, 8)}`);

      const { data, error } = await supabase
        .from("referrals")
        .select("id, status, commission_earned, referred_at, account_purchased, referred_user_id")
        .order("referred_at", { ascending: false });

      if (error) {
        console.error("Error fetching referrals:", error);
        toast({ title: "Unable to load referrals", description: "Please refresh the page and try again.", variant: "destructive" });
      } else {
        const loadedReferrals = (data ?? []).map((referral) => ({
          ...referral,
          name: "Referred trader",
          email: "Hidden for privacy",
          status: referral.status as Referral["status"],
          commission_earned: Number(referral.commission_earned),
        }));
        setReferrals(loadedReferrals);
        setTotalCommission(loadedReferrals.reduce((total, referral) => total + referral.commission_earned, 0));
      }

      const [{ data: balanceData, error: balanceError }, { data: paymentMethodData, error: paymentMethodError }] = await Promise.all([
        supabase.from("affiliate_balances").select("available").maybeSingle(),
        supabase.from("payment_methods").select("id, network, wallet_address, label").order("created_at", { ascending: false }),
      ]);
      if (balanceError) console.error("Error fetching affiliate balance:", balanceError);
      else setCommissionAvailable(Number(balanceData?.available || 0));
      if (paymentMethodError) console.error("Error fetching payment methods:", paymentMethodError);
      else {
        setPaymentMethods(paymentMethodData || []);
        setSelectedPaymentMethodId(paymentMethodData?.[0]?.id || "");
      }
      setLoading(false);
    };

    checkAuthAndFetchData();
  }, [navigate, toast]);

  const updateApplicationField = (field: keyof typeof emptyApplication, value: string) => {
    setApplicationForm((current) => ({ ...current, [field]: value }));
  };

  const submitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return; }
    const requestedCode = applicationForm.desired_code.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,8}$/.test(requestedCode)) {
      toast({ title: "Choose a valid affiliate code", description: "Use 6-8 letters or numbers.", variant: "destructive" });
      return;
    }
    setSubmittingApplication(true);
    const { data, error } = await supabase.rpc("submit_affiliate_application", {
      p_phone: applicationForm.phone,
      p_country: applicationForm.country,
      p_website: applicationForm.website,
      p_instagram: applicationForm.instagram,
      p_tiktok: applicationForm.tiktok,
      p_youtube: applicationForm.youtube,
      p_x_handle: applicationForm.x_handle,
      p_audience_size: applicationForm.audience_size,
      p_promotion_channels: applicationForm.promotion_channels,
      p_affiliate_experience: applicationForm.affiliate_experience,
      p_promotion_plan: applicationForm.promotion_plan,
      p_desired_code: requestedCode,
    });
    if (error) {
      const codeInUse = error.message.toLowerCase().includes("already in use");
      toast({ title: codeInUse ? "Choose a different code" : "Application could not be submitted", description: codeInUse ? "That code is already in use." : error.message, variant: "destructive" });
    } else {
      setApplication(data as AffiliateApplication);
      toast({ title: "Application submitted", description: "Our team will review your affiliate application." });
    }
    setSubmittingApplication(false);
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value).then(() => {
      toast({ title: "Copied!", description: `${label} copied to clipboard` });
    });
  };

  const openWithdrawDialog = () => {
    setWithdrawAmount(commissionAvailable >= 50 ? String(Math.floor(commissionAvailable)) : "");
    setSelectedPaymentMethodId(paymentMethods[0]?.id || "");
    setWithdrawOpen(true);
  };

  const submitWithdrawal = async () => {
    const wallet = paymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId);
    const amount = Number(withdrawAmount);
    if (amount < 50 || amount > commissionAvailable || !wallet) {
      toast({ title: "Check your withdrawal", description: "Enter at least $50 within your available commission and select a crypto wallet.", variant: "destructive" });
      return;
    }

    setWithdrawing(true);
    const { error } = await supabase.rpc("create_commission_payout", {
      payout_amount: amount,
      payout_destination: wallet.wallet_address,
    });
    setWithdrawing(false);
    if (error) {
      toast({ title: "Withdrawal failed", description: error.message, variant: "destructive" });
      return;
    }
    setCommissionAvailable((current) => current - amount);
    setWithdrawOpen(false);
    toast({ title: "Withdrawal submitted", description: "Your crypto commission withdrawal is pending review." });
  };

  const statusConfig: Record<string, { color: string }> = {
    pending: { color: "bg-warning/20 text-warning" },
    active: { color: "bg-success/20 text-success" },
    completed: { color: "bg-primary/20 text-primary" },
  };

  const formatChallenge = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

  if (loading) {
    return <DashboardLayout title="Affiliate" subtitle="Apply to partner with PrimePips"><div className="py-16 text-center text-muted-foreground">Loading affiliate information...</div></DashboardLayout>;
  }

  if (!isAffiliate) {
    const isPending = application?.status === "pending";
    return (
      <DashboardLayout title="Become an Affiliate" subtitle="Apply to partner with PrimePips">
        <div className="mx-auto max-w-3xl space-y-6">
          {application ? (
            <Card variant="elevated">
              <CardContent className="flex items-start gap-4 p-6">
                {isPending ? <Clock3 className="mt-1 h-6 w-6 shrink-0 text-warning" /> : <CheckCircle2 className="mt-1 h-6 w-6 shrink-0 text-destructive" />}
                <div><h2 className="font-serif text-2xl font-bold">Application {isPending ? "under review" : "not approved"}</h2><p className="mt-2 text-sm text-muted-foreground">{isPending ? "Our team is reviewing your details. We will update your account after a decision." : application.rejection_reason || "Your application was not approved at this time."}</p></div>
              </CardContent>
            </Card>
          ) : (
            <Card variant="gold"><CardHeader><CardTitle>Partner with PrimePips</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Tell us about your audience and how you plan to introduce traders to PrimePips. Applications are reviewed by our team before affiliate access is granted.</p></CardContent></Card>
          )}
          {!application && <Card><CardHeader><CardTitle>Affiliate application</CardTitle></CardHeader><CardContent><form onSubmit={submitApplication} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="phone">Phone number</Label><Input id="phone" required value={applicationForm.phone} onChange={(event) => updateApplicationField("phone", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="country">Country</Label><Select required value={applicationForm.country} onValueChange={(value) => updateApplicationField("country", value)}><SelectTrigger id="country"><SelectValue placeholder="Select your country" /></SelectTrigger><SelectContent>{countryOptions.map((country) => <SelectItem key={country} value={country}>{country}</SelectItem>)}</SelectContent></Select></div></div>
            <div className="space-y-2"><Label htmlFor="desired_code">Personal affiliate code</Label><Input id="desired_code" required minLength={6} maxLength={8} pattern="[A-Za-z0-9]{6,8}" placeholder="6-8 letters or numbers" value={applicationForm.desired_code} onChange={(event) => updateApplicationField("desired_code", event.target.value.toUpperCase())} /><p className="text-xs text-muted-foreground">Use 6-8 letters or numbers. The code must be available and will be assigned after approval.</p></div>
            <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="website">Website or profile link</Label><Input id="website" type="url" placeholder="https://" value={applicationForm.website} onChange={(event) => updateApplicationField("website", event.target.value)} /></div><div className="space-y-2"><Label htmlFor="audience_size">Audience size</Label><Input id="audience_size" required placeholder="e.g. 10,000 followers" value={applicationForm.audience_size} onChange={(event) => updateApplicationField("audience_size", event.target.value)} /></div></div>
            <div className="space-y-3"><Label>Social media handles</Label><div className="grid gap-4 sm:grid-cols-2"><Input aria-label="Instagram handle" placeholder="Instagram" value={applicationForm.instagram} onChange={(event) => updateApplicationField("instagram", event.target.value)} /><Input aria-label="TikTok handle" placeholder="TikTok" value={applicationForm.tiktok} onChange={(event) => updateApplicationField("tiktok", event.target.value)} /><Input aria-label="YouTube channel" placeholder="YouTube" value={applicationForm.youtube} onChange={(event) => updateApplicationField("youtube", event.target.value)} /><Input aria-label="X handle" placeholder="X / Twitter" value={applicationForm.x_handle} onChange={(event) => updateApplicationField("x_handle", event.target.value)} /></div></div>
            <div className="space-y-2"><Label htmlFor="promotion_channels">Where will you promote PrimePips?</Label><Input id="promotion_channels" required placeholder="e.g. YouTube, Telegram, email newsletter" value={applicationForm.promotion_channels} onChange={(event) => updateApplicationField("promotion_channels", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="affiliate_experience">Previous affiliate experience</Label><Textarea id="affiliate_experience" placeholder="Tell us about relevant partnerships or campaigns." value={applicationForm.affiliate_experience} onChange={(event) => updateApplicationField("affiliate_experience", event.target.value)} /></div>
            <div className="space-y-2"><Label htmlFor="promotion_plan">How would you introduce PrimePips to your audience?</Label><Textarea id="promotion_plan" required placeholder="Share your content and promotion approach." value={applicationForm.promotion_plan} onChange={(event) => updateApplicationField("promotion_plan", event.target.value)} /></div>
            <Button type="submit" variant="gold" disabled={submittingApplication}><Send className="mr-2 h-4 w-4" />{submittingApplication ? "Submitting application..." : "Submit affiliate application"}</Button>
          </form></CardContent></Card>}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Affiliate"
      subtitle="Earn commissions by referring other traders"
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Referrals</p>
                  <p className="text-3xl font-bold text-foreground">{referrals.length}</p>
                </div>
                <Users className="w-10 h-10 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Commission</p>
                  <p className="text-3xl font-bold text-success">
                    ${totalCommission.toLocaleString()}
                  </p>
                </div>
                <Gift className="w-10 h-10 text-success opacity-50" />
              </div>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm text-muted-foreground mb-1">Withdrawable commission</p>
                <p className="text-2xl font-bold text-primary">${commissionAvailable.toLocaleString()}</p>
                <Button className="mt-3 w-full" variant="gold" size="sm" onClick={openWithdrawDialog} disabled={commissionAvailable < 50}>
                  <ArrowDownRight className="mr-2 h-4 w-4" />Withdraw commission
                </Button>
                {commissionAvailable < 50 && <p className="mt-2 text-xs text-muted-foreground">Minimum crypto withdrawal: $50</p>}
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Active Referrals</p>
                  <p className="text-3xl font-bold text-primary">
                    {referrals.filter(r => r.status === "active").length}
                  </p>
                </div>
                <TrendingUp className="w-10 h-10 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Referral Link */}
        <Card variant="gold">
          <CardHeader>
            <CardTitle>Your Referral Link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this link to earn 12.5% commission on every successful account sale.
            </p>
            <div className="flex gap-2 items-center">
              <div className="flex-1 bg-secondary rounded-lg p-3 font-mono text-sm text-foreground break-all">
                {referralLink}
              </div>
              <Button
                variant="gold"
                size="icon"
                onClick={() => copyToClipboard(referralLink, "Referral link")}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Affiliate Coupon */}
        <Card variant="elevated" className="bg-primary/5">
          <CardHeader>
            <CardTitle>Your Affiliate Coupon</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Share this code so buyers can unlock your affiliate discount when they purchase an account.
            </p>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Coupon code</p>
                <p className="mt-1 font-mono text-2xl font-bold text-foreground">
                  {affiliateCoupon?.code || "Not assigned yet"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left sm:text-right">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Discount</p>
                  <p className="mt-1 text-lg font-semibold text-primary">
                    {affiliateCoupon ? `${Number(affiliateCoupon.discount_percent)}% off` : "—"}
                  </p>
                </div>
                <Button
                  variant="gold"
                  size="icon"
                  onClick={() => affiliateCoupon && copyToClipboard(affiliateCoupon.code, "Affiliate coupon")}
                  disabled={!affiliateCoupon}
                  className="shrink-0"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {affiliateCoupon
                ? affiliateCoupon.is_active
                  ? "This coupon is active and ready to share."
                  : "This coupon is currently inactive."
                : "Your affiliate coupon will appear here once your code has been approved."}
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Successful Purchases Using Your Code</CardTitle>
          </CardHeader>
          <CardContent>
            {affiliatePurchases.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-muted-foreground">No successful purchases have used your code yet.</p>
                <p className="mt-1 text-sm text-muted-foreground">When a buyer uses your code, the purchase and commission will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Buyer</TableHead>
                      <TableHead>Account</TableHead>
                      <TableHead>Purchase Date</TableHead>
                      <TableHead>Sale Value</TableHead>
                      <TableHead>Commission</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {affiliatePurchases.map((purchase) => {
                      const commission = Number(purchase.price || 0) * 0.125;
                      return (
                        <TableRow key={purchase.id}>
                          <TableCell className="font-medium">{purchase.user_id.slice(0, 8)}</TableCell>
                          <TableCell>{formatChallenge(purchase.challenge_type)} · ${purchase.account_size.toLocaleString()}</TableCell>
                          <TableCell>{new Date(purchase.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>${Number(purchase.price || 0).toLocaleString()}</TableCell>
                          <TableCell className="font-semibold text-success">${commission.toLocaleString()}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Commission Structure */}
        <Card variant="elevated" className="bg-primary/5">
          <CardHeader>
            <CardTitle>Commission Structure</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                <div>
                  <p className="font-medium text-foreground">Successful Account Sale</p>
                  <p className="text-sm text-muted-foreground">
                    Earn 12.5% on every account purchased by your referral
                  </p>
                </div>
                <p className="text-lg font-bold text-primary">12.5%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Referrals Table */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Your Referrals</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading referrals...</p>
              </div>
            ) : referrals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No referrals yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Start sharing your referral link to earn commissions
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Commission Earned</TableHead>
                      <TableHead>Referred Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {referrals.map((referral) => (
                      <TableRow key={referral.id}>
                        <TableCell className="font-medium">{referral.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {referral.email}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusConfig[referral.status].color}>
                            {referral.status.charAt(0).toUpperCase() + referral.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-success">
                          ${referral.commission_earned.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {new Date(referral.referred_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card variant="elevated" className="bg-secondary/30">
          <CardHeader>
            <CardTitle>Referral FAQs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-1">
                How long does it take to earn commission?
              </h4>
              <p className="text-sm text-muted-foreground">
                Commission is credited immediately after your referral completes an account purchase.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">
                Can I withdraw my referral earnings?
              </h4>
              <p className="text-sm text-muted-foreground">
                Yes! Referral commission is treated like regular account balance and can be withdrawn anytime.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-1">
                Is there a limit to how much I can earn?
              </h4>
              <p className="text-sm text-muted-foreground">
                No limit! Refer as many traders as you want and earn unlimited commissions.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Withdraw commission</DialogTitle>
            <DialogDescription>Send your available referral commission to a saved crypto wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="affiliate-withdraw-amount">Amount (USD)</Label>
              <Input id="affiliate-withdraw-amount" type="number" min="50" max={commissionAvailable} step="0.01" value={withdrawAmount} onChange={(event) => setWithdrawAmount(event.target.value)} placeholder="50" />
              <p className="text-xs text-muted-foreground">Available: ${commissionAvailable.toLocaleString()} · Minimum: $50</p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3"><Label htmlFor="affiliate-withdraw-wallet">Crypto wallet</Label><Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => navigate("/dashboard/settings")}>Manage wallets</Button></div>
              {paymentMethods.length > 0 ? <Select value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                <SelectTrigger id="affiliate-withdraw-wallet"><SelectValue placeholder="Select a saved wallet" /></SelectTrigger>
                <SelectContent>{paymentMethods.map((paymentMethod) => <SelectItem key={paymentMethod.id} value={paymentMethod.id}>{paymentMethod.label || paymentMethod.network} · {paymentMethod.wallet_address.slice(0, 8)}...{paymentMethod.wallet_address.slice(-6)}</SelectItem>)}</SelectContent>
              </Select> : <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning"><Wallet className="mr-2 inline h-4 w-4" />Add a crypto wallet in Settings before withdrawing.</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWithdrawOpen(false)}>Cancel</Button>
            <Button variant="gold" onClick={submitWithdrawal} disabled={withdrawing || paymentMethods.length === 0}>{withdrawing ? "Submitting..." : "Submit withdrawal"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
