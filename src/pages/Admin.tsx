import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRoundCheck,
  WalletCards,
  FileCheck2,
  ExternalLink,
  Gift,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTradingViewPrices } from "@/hooks/useTradingViewPrices";
import { calculatePositionPL } from "@/lib/tradingCalculations";
import { cn } from "@/lib/utils";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type User = { id: string; email?: string; name: string | null; lastSignInAt: string | null; createdAt: string; isAffiliate: boolean; isAdmin: boolean };
type Account = { id: string; user_id: string; account_size: number; challenge_type: string; status: string; current_balance: number | null; profit_loss: number | null; updated_at: string; created_at: string };
type Asset = { symbol: string; pip_value?: number | null; asset_type: string; quote_currency?: string | null; lot_size?: number | null };
type Position = { id: string; account_id: string; asset_id: string; position_type: string; lot_size: number; profit_loss: number | null; status: string; opened_at: string; entry_price: number; assets?: Asset };
type Referral = { referrer_id: string; referred_user_id: string; status: string; commission_earned: number; referred_at: string; account_purchased: boolean };
type History = { id: string; account_id: string; symbol: string; action: string; lot_size: number; profit_loss: number | null; created_at: string; price: number };
type Payment = { id: string; user_id: string | null; account_id: string | null; provider: string; provider_reference: string; amount: number; currency: string; status: string; checkout_at: string; verified_at: string | null; webhook_at: string | null; failure_reason: string | null; refund_amount: number | null; refunded_at: string | null };
type AdminSection = "traders" | "exposure" | "referrals" | "affiliates" | "activity" | "kyc" | "payments";
type Kyc = { id: string; user_id: string; identity_document_type: string | null; identity_document_path: string | null; identity_submitted_at: string | null; address_document_type: string | null; address_document_path: string | null; address_submitted_at: string | null; status: string; rejection_reason: string | null; reviewed_at: string | null; reviewed_by: string | null; created_at: string; updated_at: string };
type Snapshot = { users: User[]; accounts: Account[]; positions: Position[]; referrals: Referral[]; history: History[]; kyc: Kyc[]; payments: Payment[]; generatedAt: string };
type GrantChallenge = "three_step" | "two_step" | "one_step" | "instant";

const money = (value: number) => `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const date = (value: string | null) => value ? new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Never";
const activeWindow = 15 * 60 * 1000;
const isPurchasedAccount = (account: Account) => !["pending_payment", "failed"].includes(account.status);

export default function Admin({ section }: { section?: AdminSection }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingAffiliate, setUpdatingAffiliate] = useState<string | null>(null);
  const [reviewingKyc, setReviewingKyc] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});
  const [grantUserId, setGrantUserId] = useState("");
  const [grantChallenge, setGrantChallenge] = useState<GrantChallenge>("one_step");
  const [grantSize, setGrantSize] = useState("10000");
  const [grantingAccount, setGrantingAccount] = useState(false);

  const loadSnapshot = async () => {
    setLoading(true);
    setError("");
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/login"); return; }
    if (session.user.app_metadata?.role !== "admin") { navigate("/dashboard", { replace: true }); return; }
    const { data, error: invokeError } = await supabase.functions.invoke("admin-snapshot");
    if (invokeError) setError("The admin snapshot could not be loaded.");
    else setSnapshot(data as Snapshot);
    setLoading(false);
  };

  useEffect(() => { void loadSnapshot(); }, []);

  const updateAffiliateStatus = async (user: User) => {
    setUpdatingAffiliate(user.id);
    const { error: updateError } = await supabase.functions.invoke("admin-affiliate", {
      body: { userId: user.id, affiliate: !user.isAffiliate },
    });
    if (updateError) {
      setError("The affiliate status could not be updated.");
    } else {
      setSnapshot((current) => current ? { ...current, users: current.users.map((candidate) => candidate.id === user.id ? { ...candidate, isAffiliate: !user.isAffiliate } : candidate) } : current);
    }
    setUpdatingAffiliate(null);
  };

  const grantAccount = async () => {
    if (!grantUserId) { setError("Select a trader to receive the account."); return; }
    setGrantingAccount(true);
    setError("");
    const { data, error: grantError } = await supabase.functions.invoke("admin-account", {
      body: { userId: grantUserId, challengeType: grantChallenge, accountSize: Number(grantSize) },
    });
    if (grantError || !data?.account) {
      setError(grantError?.message || "The account could not be granted.");
    } else {
      setSnapshot((current) => current ? { ...current, accounts: [...current.accounts, data.account as Account] } : current);
    }
    setGrantingAccount(false);
  };

  const reviewKyc = async (application: Kyc, status: "approved" | "rejected") => {
    const reason = rejectionReasons[application.id]?.trim() || "";
    if (status === "rejected" && !reason) { setError("A rejection reason is required."); return; }
    setReviewingKyc(application.id);
    const { data, error: reviewError } = await supabase.rpc("review_kyc", { p_kyc_id: application.id, p_status: status, p_rejection_reason: reason || null });
    if (reviewError) setError(reviewError.message);
    else setSnapshot((current) => current ? { ...current, kyc: current.kyc.map((item) => item.id === application.id ? data : item) } : current);
    setReviewingKyc(null);
  };

  const previewDocument = async (path: string | null) => {
    if (!path) return;
    const { data, error: previewError } = await supabase.functions.invoke("admin-kyc-document", { body: { path } });
    if (previewError || !data?.signedUrl) { setError("The document preview could not be created."); return; }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const purchasedAccounts = (snapshot?.accounts ?? []).filter(isPurchasedAccount);
  const userMap = useMemo(() => new Map((snapshot?.users ?? []).map((user) => [user.id, user])), [snapshot]);
  const accountMap = useMemo(() => new Map(purchasedAccounts.map((account) => [account.id, account])), [purchasedAccounts]);
  const activeUsers = (snapshot?.users ?? []).filter((user) => user.lastSignInAt && Date.now() - new Date(user.lastSignInAt).getTime() < activeWindow);
  const activeAccounts = purchasedAccounts.filter((account) => ["active", "funded"].includes(account.status));
  const totalPL = purchasedAccounts.reduce((total, account) => total + (account.profit_loss ?? 0), 0);
  const openPositions = (snapshot?.positions ?? []).filter((position) => position.status === "open");
  const recentHistory = (snapshot?.history ?? []).slice(0, 12);
  const symbols = useMemo(() => [...new Set(openPositions.map((position) => position.assets?.symbol).filter((symbol): symbol is string => Boolean(symbol)))], [openPositions]);
  const { prices, isConnected } = useTradingViewPrices(symbols);
  const floatingPL = (position: Position) => {
    const asset = position.assets;
    const price = asset ? prices[asset.symbol] : undefined;
    if (!asset || !price) return null;
    const currentPrice = position.position_type.toLowerCase() === "buy" ? price.bid : price.ask;
    return calculatePositionPL(asset, position.position_type.toLowerCase() as "buy" | "sell", position.entry_price, currentPrice, position.lot_size).profitLoss;
  };
  const traderGroups = useMemo(() => (snapshot?.users ?? []).map((user) => {
    const accounts = (snapshot?.accounts ?? []).filter((account) => account.user_id === user.id);
    const accountIds = new Set(accounts.map((account) => account.id));
    const positions = openPositions.filter((position) => accountIds.has(position.account_id));
    const history = recentHistory.filter((trade) => accountIds.has(trade.account_id));
    return { user, accounts, positions, history, accountPL: accounts.reduce((sum, account) => sum + (account.profit_loss ?? 0), 0) };
  }).filter(({ accounts, positions, history }) => accounts.length > 0 || positions.length > 0 || history.length > 0), [snapshot, openPositions, recentHistory]);

  const pageTitle = section === "traders" ? "Trader activity" : section === "exposure" ? "Trading exposure" : section === "referrals" ? "Referral analytics" : section === "affiliates" ? "Affiliate partners" : section === "activity" ? "Trade activity" : section === "kyc" ? "KYC review" : section === "payments" ? "Payment reconciliation" : "Platform overview";

  const statCards = [
    { label: "Registered traders", value: snapshot?.users.length ?? 0, detail: `${activeUsers.length} signed in within 15 min`, icon: Users },
    { label: "Active accounts", value: activeAccounts.length, detail: `${purchasedAccounts.length} purchased accounts`, icon: WalletCards },
    { label: "Platform P/L", value: money(totalPL), detail: `${openPositions.length} open positions`, icon: CircleDollarSign, accent: totalPL >= 0 },
    { label: "Referrals", value: snapshot?.referrals.length ?? 0, detail: `${snapshot?.referrals.filter((referral) => referral.account_purchased).length ?? 0} converted`, icon: Activity },
  ];

  return (
    <DashboardLayout title={pageTitle} subtitle="Live platform oversight and trader activity">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.2em]">Private workspace</span></div>
            <h2 className="text-3xl font-serif font-bold">{section ? pageTitle : "Platform pulse"}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Trader activity, exposure, performance, and referral flow in one view.</p>
          </div>
          <Button variant="outline" onClick={() => void loadSnapshot()} disabled={loading}><RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />Refresh data</Button>
        </div>

        {error && <Card className="border-destructive/40"><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card>}
        {loading && !snapshot ? <div className="py-16 text-center text-muted-foreground">Loading private platform data...</div> : snapshot && <>
          {!section && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {statCards.map(({ label, value, detail, icon: Icon, accent }) => <Card key={label} variant="elevated"><CardContent className="p-5"><div className="flex items-start justify-between"><div><p className="text-sm text-muted-foreground">{label}</p><p className={cn("mt-2 text-3xl font-bold", accent === false && "text-destructive", accent === true && "text-success")}>{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div><div className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-5 w-5" /></div></div></CardContent></Card>)}
          </div>}

          {(!section || section === "traders") && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Gift className="h-5 w-5 text-primary" />Grant a trading account</CardTitle><p className="text-sm text-muted-foreground">Create a complimentary account with no payment required.</p></CardHeader><CardContent><div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end"><div className="space-y-2"><Label htmlFor="grant-user">Trader</Label><Select value={grantUserId} onValueChange={setGrantUserId}><SelectTrigger id="grant-user"><SelectValue placeholder="Choose a trader" /></SelectTrigger><SelectContent>{snapshot.users.filter((user) => !user.isAdmin).map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || "Unnamed trader"}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Challenge</Label><Select value={grantChallenge} onValueChange={(value) => setGrantChallenge(value as GrantChallenge)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="three_step">3-Step Challenge</SelectItem><SelectItem value="two_step">2-Step Challenge</SelectItem><SelectItem value="one_step">1-Step Challenge</SelectItem><SelectItem value="instant">Instant Funding</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Account size</Label><Select value={grantSize} onValueChange={setGrantSize}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[5000, 10000, 25000, 50000, 100000, 200000].map((size) => <SelectItem key={size} value={String(size)}>${size.toLocaleString()}</SelectItem>)}</SelectContent></Select></div><Button variant="gold" onClick={() => void grantAccount()} disabled={grantingAccount || !snapshot.users.some((user) => !user.isAdmin)}>{grantingAccount ? "Granting..." : "Grant account"}</Button></div></CardContent></Card>}

          {(!section || section === "payments") && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><CreditCard className="h-5 w-5 text-primary" />Payment reconciliation</CardTitle><p className="text-sm text-muted-foreground">Review provider callbacks that need investigation or did not match a checkout order.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Reference</th><th className="px-4 py-3">Owner</th><th className="px-4 py-3">Amount</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Checkout</th><th className="px-6 py-3">Reason</th></tr></thead><tbody>{snapshot.payments.filter((payment) => ["unmatched", "failed", "refunded"].includes(payment.status)).map((payment) => <tr key={payment.id} className="border-b border-border/60 last:border-0"><td className="px-6 py-4 font-mono text-xs">{payment.provider_reference}</td><td className="px-4 py-4 text-xs">{payment.user_id ? userMap.get(payment.user_id)?.email || payment.user_id.slice(0, 8) : "Unknown"}</td><td className="px-4 py-4 font-medium">{payment.currency} {Number(payment.amount).toLocaleString()}</td><td className="px-4 py-4"><Badge variant={payment.status === "failed" ? "destructive" : "outline"}>{payment.status}</Badge></td><td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{date(payment.checkout_at)}</td><td className="max-w-xs px-6 py-4 text-xs text-muted-foreground">{payment.failure_reason || "Provider event requires review"}</td></tr>)}</tbody></table></div>{snapshot.payments.filter((payment) => ["unmatched", "failed", "refunded"].includes(payment.status)).length === 0 && <p className="p-6 text-sm text-muted-foreground">No unmatched, failed, or refunded payments.</p>}</CardContent></Card>}

          <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
            {(section === "kyc" || !section) && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><FileCheck2 className="h-5 w-5 text-primary" />KYC review queue</CardTitle><p className="text-sm text-muted-foreground">Review private identity and address documents. Pending applications require a decision.</p></CardHeader><CardContent className="space-y-4">{snapshot.kyc.filter((application) => application.status === "pending").length === 0 ? <p className="text-sm text-muted-foreground">No pending KYC applications.</p> : snapshot.kyc.filter((application) => application.status === "pending").map((application) => <div key={application.id} className="space-y-3 rounded-lg border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{userMap.get(application.user_id)?.name || userMap.get(application.user_id)?.email || application.user_id}</p><p className="text-xs text-muted-foreground">Submitted {date(application.identity_submitted_at || application.created_at)}</p></div><Badge variant="outline">Pending</Badge></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void previewDocument(application.identity_document_path)} disabled={!application.identity_document_path}><ExternalLink className="h-4 w-4" />Identity document</Button><Button size="sm" variant="outline" onClick={() => void previewDocument(application.address_document_path)} disabled={!application.address_document_path}><ExternalLink className="h-4 w-4" />Proof of address</Button></div><textarea aria-label="Rejection reason" placeholder="Required only when rejecting" value={rejectionReasons[application.id] || ""} onChange={(event) => setRejectionReasons((current) => ({ ...current, [application.id]: event.target.value }))} className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /><div className="flex justify-end gap-2"><Button size="sm" variant="outline" onClick={() => void reviewKyc(application, "rejected")} disabled={reviewingKyc === application.id}>Reject</Button><Button size="sm" variant="gold" onClick={() => void reviewKyc(application, "approved")} disabled={reviewingKyc === application.id}>Approve</Button></div></div>)}</CardContent></Card>}
            {(!section || section === "traders") && <Card><CardHeader><CardTitle className="flex items-center justify-between text-xl"><span>Trader activity</span><Badge variant="outline">{activeUsers.length} signed in recently</Badge></CardTitle></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Trader</th><th className="px-4 py-3">Account sizes</th><th className="px-4 py-3">P/L</th><th className="px-4 py-3">Last sign in</th></tr></thead><tbody>{snapshot.users.map((user) => { const accounts = snapshot.accounts.filter((account) => account.user_id === user.id); const pl = accounts.reduce((sum, account) => sum + (account.profit_loss ?? 0), 0); const isActive = activeUsers.some((active) => active.id === user.id); return <tr key={user.id} className="border-b border-border/60 last:border-0"><td className="px-6 py-4"><div className="font-medium"><span className={cn("mr-2 inline-block h-2 w-2 rounded-full", isActive ? "bg-success" : "bg-muted-foreground/40")} />{user.name || "Unnamed trader"}</div><div className="text-xs text-muted-foreground">{user.email}</div></td><td className="px-4 py-4 text-xs">{accounts.length ? accounts.map((account) => `$${account.account_size.toLocaleString()}`).join(", ") : "-"}</td><td className={cn("px-4 py-4 font-medium", pl >= 0 ? "text-success" : "text-destructive")}>{money(pl)}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{date(user.lastSignInAt)}</td></tr>})}</tbody></table></div></CardContent></Card>}

            {(!section || section === "exposure") && <Card><CardHeader><CardTitle className="flex items-center justify-between text-xl"><span>Open exposure</span><Badge variant="outline">{isConnected ? "Live prices" : "Connecting"}</Badge></CardTitle></CardHeader><CardContent className="p-0">{openPositions.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No open positions right now.</p> : <div className="divide-y divide-border/60">{traderGroups.filter(({ positions }) => positions.length > 0).map(({ user, positions }, index) => <Collapsible key={user.id} defaultOpen={index === 0}><CollapsibleTrigger asChild><button className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-secondary/30"><span><span className="font-medium">{user.name || "Unnamed trader"}</span><span className="ml-2 text-xs text-muted-foreground">{user.email}</span></span><span className="flex items-center gap-3 text-xs text-muted-foreground">{positions.length} position{positions.length === 1 ? "" : "s"}<ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" /></span></button></CollapsibleTrigger><CollapsibleContent className="bg-secondary/10 px-6 pb-3"><div className="space-y-3">{positions.slice(0, 8).map((position) => { const account = accountMap.get(position.account_id); const asset = position.assets; const pl = floatingPL(position); const price = asset ? prices[asset.symbol] : undefined; return <div key={position.id} className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0"><div className="min-w-0"><div className="flex items-center gap-2 font-medium"><span className={cn("h-2 w-2 shrink-0 rounded-full", position.position_type.toLowerCase() === "buy" ? "bg-success" : "bg-destructive")} />{asset?.symbol || position.asset_id}<Badge variant="outline" className="text-[10px]">{position.position_type}</Badge></div><div className="truncate text-xs text-muted-foreground">${account?.account_size.toLocaleString()} · {position.lot_size} lots · entry {position.entry_price.toLocaleString(undefined, { maximumFractionDigits: 6 })}{price ? ` · now ${price[position.position_type.toLowerCase() === "buy" ? "bid" : "ask"].toLocaleString(undefined, { maximumFractionDigits: 6 })}` : ""}</div></div><div className={cn("shrink-0 text-right text-sm font-medium", pl === null ? "text-muted-foreground" : pl >= 0 ? "text-success" : "text-destructive")}>{pl === null ? "Waiting" : <><div>{pl >= 0 ? <ArrowUpRight className="mr-1 inline h-3 w-3" /> : <ArrowDownRight className="mr-1 inline h-3 w-3" />}{money(pl)}</div><div className="text-[10px] font-normal text-muted-foreground">floating PnL</div></>}</div></div>})}</div></CollapsibleContent></Collapsible>)}</div>}</CardContent></Card>}
          </div>

          {section === "affiliates" && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><UserRoundCheck className="h-5 w-5 text-primary" />Affiliate partners</CardTitle><p className="text-sm text-muted-foreground">Assign or remove affiliate access for normal trader accounts.</p></CardHeader><CardContent className="p-0"><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Trader</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th><th className="px-6 py-3 text-right">Action</th></tr></thead><tbody>{snapshot.users.filter((user) => !user.isAdmin).map((user) => <tr key={user.id} className="border-b border-border/60 last:border-0"><td className="px-6 py-4"><div className="font-medium">{user.name || "Unnamed trader"}</div><div className="text-xs text-muted-foreground">{user.email}</div></td><td className="px-4 py-4 text-xs text-muted-foreground">{date(user.createdAt)}</td><td className="px-4 py-4"><Badge variant={user.isAffiliate ? "default" : "outline"}>{user.isAffiliate ? "Partnered affiliate" : "Normal account"}</Badge></td><td className="px-6 py-4 text-right"><Button variant={user.isAffiliate ? "outline" : "gold"} size="sm" onClick={() => void updateAffiliateStatus(user)} disabled={updatingAffiliate === user.id}>{updatingAffiliate === user.id ? "Updating..." : user.isAffiliate ? "Remove access" : "Assign affiliate"}</Button></td></tr>)}</tbody></table></div></CardContent></Card>}

          <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
            {(!section || section === "referrals") && <Card><CardHeader><CardTitle className="text-xl">Referral network</CardTitle></CardHeader><CardContent className="space-y-3">{snapshot.referrals.length === 0 ? <p className="text-sm text-muted-foreground">No referrals recorded yet.</p> : snapshot.referrals.slice(0, 8).map((referral) => <div key={referral.referred_user_id} className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0"><div><div className="font-medium">{userMap.get(referral.referred_user_id)?.email || referral.referred_user_id.slice(0, 8)}</div><div className="text-xs text-muted-foreground">referred by {userMap.get(referral.referrer_id)?.email || referral.referrer_id.slice(0, 8)}</div></div><div className="text-right"><Badge variant="outline">{referral.status}</Badge><div className="mt-1 text-xs text-primary">{money(referral.commission_earned)}</div></div></div>)}</CardContent></Card>}
            {(!section || section === "activity") && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-xl"><Clock3 className="h-5 w-5 text-primary" />Recent trade activity</CardTitle></CardHeader><CardContent className="p-0">{recentHistory.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No trade activity recorded yet.</p> : <div className="divide-y divide-border/60">{traderGroups.filter(({ history }) => history.length > 0).map(({ user, history }, index) => <Collapsible key={user.id} defaultOpen={index === 0}><CollapsibleTrigger asChild><button className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-secondary/30"><span><span className="font-medium">{user.name || "Unnamed trader"}</span><span className="ml-2 text-xs text-muted-foreground">{user.email}</span></span><span className="flex items-center gap-3 text-xs text-muted-foreground">{history.length} trade{history.length === 1 ? "" : "s"}<ChevronDown className="h-4 w-4" /></span></button></CollapsibleTrigger><CollapsibleContent className="bg-secondary/10">{history.map((trade) => { const pl = trade.profit_loss ?? 0; return <div key={trade.id} className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-3"><div className="min-w-0"><div className="flex items-center gap-2 font-medium"><span className="truncate">{trade.symbol}</span><Badge variant="secondary" className="text-[10px]">{trade.action}</Badge></div><div className="truncate text-xs text-muted-foreground">{trade.lot_size} lots · {date(trade.created_at)}</div></div><div className={cn("flex shrink-0 items-center gap-1 font-medium", pl >= 0 ? "text-success" : "text-destructive")}>{pl >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{money(pl)}</div></div>})}</CollapsibleContent></Collapsible>)}</div>}</CardContent></Card>}
          </div>
          <p className="text-right text-xs text-muted-foreground">Snapshot generated {date(snapshot.generatedAt)}</p>
        </>}
      </div>
    </DashboardLayout>
  );
}