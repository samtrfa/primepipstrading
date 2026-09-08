import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3, Clock3, ExternalLink, Mail, Percent, Users, WalletCards } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type User = { id: string; email?: string; name: string | null; lastSignInAt: string | null; createdAt: string; isAffiliate: boolean; isAdmin: boolean };
type Account = { id: string; user_id: string; account_size: number; challenge_type: string; status: string; current_balance: number | null; profit_loss: number | null; created_at: string; coupon_code?: string | null };
type Referral = { referrer_id: string; referred_user_id: string; status: string; commission_earned: number; referred_at: string; account_purchased: boolean };
type AffiliateCode = { user_id: string; code: string; discount_percent: number; is_active: boolean; created_at: string };
type AffiliateBalance = { user_id: string; available: number; reserved: number; paid: number };
type Payout = { id: string; user_id: string; amount: number; method: string; source: string; status: string; created_at: string; updated_at: string };
type Application = { user_id: string; desired_code: string; phone: string; country: string; website: string | null; instagram: string | null; tiktok: string | null; youtube: string | null; x_handle: string | null; audience_size: string; promotion_channels: string; affiliate_experience: string | null; promotion_plan: string; status: string; created_at: string };
type Snapshot = { users: User[]; accounts: Account[]; referrals: Referral[]; affiliateCodes: AffiliateCode[]; affiliateBalances: AffiliateBalance[]; affiliateApplications: Application[]; payouts: Payout[] };

const money = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const date = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never";
const challengeName = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const purchasedStatuses = new Set(["active", "funded", "passed", "failed"]);

export default function AffiliateDetails() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/login"); return; }
      if (session.user.app_metadata?.role !== "admin") { navigate("/dashboard", { replace: true }); return; }
      const { data, error: snapshotError } = await supabase.functions.invoke("admin-snapshot");
      if (cancelled) return;
      if (snapshotError || !data) setError(snapshotError?.message || "The affiliate details could not be loaded.");
      else setSnapshot(data as Snapshot);
      setLoading(false);
    };
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => { cancelled = true; window.clearInterval(interval); };
  }, [navigate]);

  const user = (snapshot?.users ?? []).find((candidate) => candidate.id === userId);
  const referrals = useMemo(() => (snapshot?.referrals ?? []).filter((referral) => referral.referrer_id === userId), [snapshot, userId]);
  const accounts = useMemo(() => (snapshot?.accounts ?? []).filter((account) => account.user_id === userId && purchasedStatuses.has(account.status)), [snapshot, userId]);
  const balance = (snapshot?.affiliateBalances ?? []).find((candidate) => candidate.user_id === userId);
  const code = (snapshot?.affiliateCodes ?? []).find((candidate) => candidate.user_id === userId);
  const application = (snapshot?.affiliateApplications ?? []).find((candidate) => candidate.user_id === userId);
  const payouts = useMemo(() => (snapshot?.payouts ?? []).filter((payout) => payout.user_id === userId && payout.source === "referral_commission"), [snapshot, userId]);
  const codeUses = code ? (snapshot?.accounts ?? []).filter((account) => account.coupon_code?.toUpperCase() === code.code.toUpperCase()).length : 0;
  const totalCommission = referrals.reduce((total, referral) => total + Number(referral.commission_earned || 0), 0);
  const converted = referrals.filter((referral) => referral.account_purchased).length;
  const tradingPL = accounts.reduce((total, account) => total + (account.profit_loss ?? 0), 0);

  if (loading) return <DashboardLayout title="Affiliate details" subtitle="Loading partner analytics"><div className="py-16 text-center text-muted-foreground">Loading affiliate analytics...</div></DashboardLayout>;
  if (error || !user) return <DashboardLayout title="Affiliate details" subtitle="Partner review"><Card><CardContent className="space-y-4 p-8 text-center"><p className="text-destructive">{error || "This affiliate could not be found."}</p><Button variant="outline" onClick={() => navigate("/admin/affiliates")}><ArrowLeft className="mr-2 h-4 w-4" />Back to Affiliates</Button></CardContent></Card></DashboardLayout>;

  return (
    <DashboardLayout title="Affiliate details" subtitle="Complete partner and referral analytics">
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3"><Button variant="outline" size="icon" aria-label="Back to Affiliates" onClick={() => navigate("/admin/affiliates")}><ArrowLeft className="h-4 w-4" /></Button><div><div className="flex items-center gap-2"><Users className="h-5 w-5 text-primary" /><h2 className="text-3xl font-bold">{user.name || "Unnamed affiliate"}</h2></div><p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-3.5 w-3.5" />{user.email || "No email"} · Joined {date(user.createdAt)}</p></div></div>
          <div className="flex flex-wrap gap-2"><Badge variant={user.isAffiliate ? "default" : "outline"}>{user.isAffiliate ? "Active affiliate" : "Affiliate access removed"}</Badge><Badge variant="outline"><Clock3 className="mr-2 h-3.5 w-3.5" />Last sign in {date(user.lastSignInAt)}</Badge></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[{ label: "Total referrals", value: String(referrals.length), detail: `${converted} converted`, icon: Users }, { label: "Code uses", value: String(codeUses), detail: code?.code ? `Uses of ${code.code}` : "No code assigned", icon: BarChart3 }, { label: "Commission earned", value: money(totalCommission), detail: `${money(balance?.paid ?? 0)} paid out`, icon: Percent }, { label: "Available balance", value: money(balance?.available ?? 0), detail: `${money(balance?.reserved ?? 0)} reserved`, icon: WalletCards }].map(({ label, value, detail, icon: Icon }) => <Card key={label} variant="elevated"><CardContent className="p-5"><div className="flex justify-between text-sm text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4 text-primary" /></div><p className="mt-3 text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></CardContent></Card>)}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
          <Card><CardHeader><CardTitle>Partner profile</CardTitle></CardHeader><CardContent className="space-y-4 text-sm"><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Affiliate code</p><p className="font-mono font-semibold">{code?.code || application?.desired_code || "Not assigned"}</p></div><div><p className="text-xs text-muted-foreground">Code status</p><Badge variant={code?.is_active ? "default" : "outline"}>{code ? (code.is_active ? "Active" : "Inactive") : "Not assigned"}</Badge></div><div><p className="text-xs text-muted-foreground">Discount</p><p>{code ? `${code.discount_percent}% off` : "-"}</p></div><div><p className="text-xs text-muted-foreground">Audience size</p><p>{application?.audience_size || "-"}</p></div><div><p className="text-xs text-muted-foreground">Country</p><p>{application?.country || "-"}</p></div><div><p className="text-xs text-muted-foreground">Channels</p><p>{application?.promotion_channels || "-"}</p></div></div>{application?.website && <a className="flex items-center gap-2 text-primary hover:underline" href={application.website} target="_blank" rel="noreferrer">{application.website}<ExternalLink className="h-3.5 w-3.5" /></a>}<div><p className="text-xs text-muted-foreground">Application status</p><p className="capitalize">{application?.status || "No application"} {application ? `· submitted ${date(application.created_at)}` : ""}</p></div></CardContent></Card>
          <Card><CardHeader><CardTitle>Trading account overview</CardTitle><p className="text-sm text-muted-foreground">The affiliate's own account performance is included for a complete partner profile.</p></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3 text-sm"><div><p className="text-muted-foreground">Purchased accounts</p><p className="text-xl font-semibold">{accounts.length}</p></div><div><p className="text-muted-foreground">Account P/L</p><p className={cn("text-xl font-semibold", tradingPL >= 0 ? "text-success" : "text-destructive")}>{money(tradingPL)}</p></div></div>{accounts.map((account) => <div key={account.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border/70 p-3"><div><p className="font-medium">${account.account_size.toLocaleString()} {challengeName(account.challenge_type)}</p><p className="text-xs text-muted-foreground">Created {date(account.created_at)} · Balance {money(account.current_balance ?? account.account_size)}</p></div><div className="text-right"><Badge variant={account.status === "failed" ? "destructive" : "outline"}>{account.status.replaceAll("_", " ")}</Badge><p className={cn("mt-1 text-xs font-medium", (account.profit_loss ?? 0) >= 0 ? "text-success" : "text-destructive")}>{money(account.profit_loss ?? 0)} P/L</p></div></div>)}{!accounts.length && <p className="text-sm text-muted-foreground">No purchased trading accounts.</p>}</CardContent></Card>
        </div>

        <Card><CardHeader><CardTitle>Referral and commission ledger</CardTitle><p className="text-sm text-muted-foreground">Every referral attributed to this affiliate, including conversion status and commission earned.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-[48rem] w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Referred trader</th><th className="px-4 py-3">Referred</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Purchase</th><th className="px-4 py-3 text-right">Commission</th></tr></thead><tbody>{referrals.map((referral) => { const referredUser = (snapshot?.users ?? []).find((candidate) => candidate.id === referral.referred_user_id); return <tr key={referral.referred_user_id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3"><p className="font-medium">{referredUser?.name || "Unnamed trader"}</p><p className="text-xs text-muted-foreground">{referredUser?.email || referral.referred_user_id.slice(0, 8)}</p></td><td className="px-4 py-3 text-muted-foreground">{date(referral.referred_at)}</td><td className="px-4 py-3"><Badge variant="outline">{referral.status}</Badge></td><td className="px-4 py-3">{referral.account_purchased ? <Badge variant="default">Converted</Badge> : <Badge variant="secondary">Pending</Badge>}</td><td className={cn("px-4 py-3 text-right font-medium", referral.commission_earned >= 0 ? "text-success" : "text-destructive")}>{money(referral.commission_earned)}</td></tr>; })}</tbody></table></div>{!referrals.length && <p className="p-6 text-sm text-muted-foreground">No referrals recorded for this affiliate.</p>}</CardContent></Card>

        <Card><CardHeader><CardTitle>Commission payouts</CardTitle><p className="text-sm text-muted-foreground">Withdrawal requests funded from referral commissions.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="min-w-[42rem] w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-3">Requested</th><th className="px-4 py-3">Method</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody>{payouts.map((payout) => <tr key={payout.id} className="border-b border-border/60 last:border-0"><td className="px-4 py-3">{date(payout.created_at)}</td><td className="px-4 py-3 capitalize">{payout.method.replaceAll("_", " ")}</td><td className="px-4 py-3"><Badge variant={payout.status === "rejected" ? "destructive" : "outline"}>{payout.status}</Badge></td><td className="px-4 py-3 text-right font-medium">{money(payout.amount)}</td></tr>)}</tbody></table></div>{!payouts.length && <p className="p-6 text-sm text-muted-foreground">No commission payout requests recorded.</p>}</CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
