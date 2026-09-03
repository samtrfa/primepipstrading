import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ArrowDownRight, Calendar, Wallet, Clock, CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Account {
  id: string;
  challenge_type: string;
  account_size: number;
  price: number;
  status: string;
  current_balance: number | null;
  profit_loss: number | null;
  created_at: string;
}

interface PayoutRequest {
  id: string;
  account_id: string | null;
  amount: number;
  method: string;
  destination: string;
  source: string;
  status: string;
  created_at: string;
}

interface PaymentMethod {
  id: string;
  network: string;
  wallet_address: string;
  label: string | null;
}

const statusConfig: Record<string, { label: string; className: string; icon: typeof Clock }> = {
  pending: { label: "Pending", className: "bg-warning/20 text-warning", icon: Clock },
  approved: { label: "Approved", className: "bg-primary/20 text-primary", icon: CheckCircle2 },
  paid: { label: "Paid", className: "bg-success/20 text-success", icon: CheckCircle2 },
  rejected: { label: "Rejected", className: "bg-destructive/20 text-destructive", icon: XCircle },
};

export default function PayoutsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProfit, setTotalProfit] = useState(0);
  const [commissionAvailable, setCommissionAvailable] = useState(0);
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [payoutSource, setPayoutSource] = useState("trading_profit");
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [destination, setDestination] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState("");
  const [walletNetwork, setWalletNetwork] = useState("USDT (TRC20)");
  const [walletAddress, setWalletAddress] = useState("");
  const [walletLabel, setWalletLabel] = useState("");
  const [addingWallet, setAddingWallet] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [kycStatus, setKycStatus] = useState("not_started");
  const { toast } = useToast();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // Fetch accounts data
      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        // Instant accounts are funded by definition, including legacy rows not yet normalized.
        .or("status.eq.funded,and(status.eq.active,challenge_type.eq.instant)")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching accounts:", error);
      } else if (data) {
        setAccounts(data);
        // Calculate total profit from all funded accounts
        const total = data.reduce((sum, a) => sum + (a.profit_loss || 0), 0);
        setTotalProfit(total);
      }

      const { data: payoutData, error: payoutError } = await supabase
        .from("payout_requests")
        .select("id, account_id, amount, method, destination, source, status, created_at")
        .order("created_at", { ascending: false });

      if (payoutError) {
        console.error("Error fetching payout requests:", payoutError);
      } else {
        setRequests(payoutData || []);
      }

      const { data: balanceData, error: balanceError } = await supabase
        .from("affiliate_balances")
        .select("available")
        .maybeSingle();
      if (balanceError) {
        console.error("Error fetching affiliate balance:", balanceError);
      } else {
        setCommissionAvailable(Number(balanceData?.available || 0));
      }

      const { data: paymentMethodData, error: paymentMethodError } = await supabase
        .from("payment_methods")
        .select("id, network, wallet_address, label")
        .order("created_at", { ascending: false });
      if (paymentMethodError) {
        console.error("Error fetching payment methods:", paymentMethodError);
      } else {
        setPaymentMethods(paymentMethodData || []);
      }
      const { data: kycData, error: kycError } = await supabase.from("kyc_verifications").select("status").maybeSingle();
      if (kycError) console.error("Error fetching KYC status:", kycError);
      else setKycStatus(kycData?.status || "not_started");
      setLoading(false);
    };

    checkAuthAndFetchData();
  }, [navigate]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const availableTradingProfit = Math.max(0, accounts.reduce((sum, account) => sum + Math.max(0, account.profit_loss || 0), 0));
  const availableForWithdrawal = availableTradingProfit + commissionAvailable;
  const requestAmount = Number(amount);

  const openRequestDialog = () => {
    const firstEligibleAccount = accounts.find((account) => (account.profit_loss || 0) >= 100) || accounts[0];
    const accountProfit = Math.max(0, firstEligibleAccount?.profit_loss || 0);
    setSelectedAccountId(firstEligibleAccount?.id || "");
    setAmount(accountProfit >= 100 ? String(Math.floor(accountProfit)) : "");
    setPayoutSource("trading_profit");
    setDestination("");
    setSelectedPaymentMethodId(paymentMethods[0]?.id || "");
    setRequestOpen(true);
  };

  const addWallet = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAddingWallet(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setAddingWallet(false);
      navigate("/login");
      return;
    }

    const { data, error } = await supabase
      .from("payment_methods")
      .insert({ user_id: user.id, method_type: "crypto", network: walletNetwork, wallet_address: walletAddress.trim(), label: walletLabel.trim() || null })
      .select("id, network, wallet_address, label")
      .single();
    setAddingWallet(false);
    if (error) {
      toast({ title: "Unable to add wallet", description: error.code === "23505" ? "This wallet is already saved for this network." : error.message, variant: "destructive" });
      return;
    }
    setPaymentMethods((current) => [data, ...current]);
    setSelectedPaymentMethodId(data.id);
    setWalletAddress("");
    setWalletLabel("");
    toast({ title: "Wallet added", description: "Your wallet is ready for crypto withdrawals." });
  };

  const removeWallet = async (id: string) => {
    const { error } = await supabase.from("payment_methods").delete().eq("id", id);
    if (error) {
      toast({ title: "Unable to remove wallet", description: error.message, variant: "destructive" });
      return;
    }
    setPaymentMethods((current) => current.filter((paymentMethod) => paymentMethod.id !== id));
    if (selectedPaymentMethodId === id) setSelectedPaymentMethodId("");
    toast({ title: "Wallet removed" });
  };

  const submitRequest = async () => {
    const isCommissionPayout = payoutSource === "referral_commission";
    const payoutDestination = method === "crypto"
      ? paymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId)?.wallet_address || ""
      : destination.trim();
    const sourceBalance = isCommissionPayout ? commissionAvailable : Math.max(0, selectedAccount?.profit_loss || 0);
    if (!isCommissionPayout && kycStatus !== "approved") {
      toast({ title: "KYC approval required", description: "Complete identity verification before requesting a funded-account payout.", variant: "destructive" });
      return;
    }
    if ((!isCommissionPayout && !selectedAccount) || requestAmount < 100 || requestAmount > sourceBalance || !payoutDestination || (isCommissionPayout && method !== "crypto")) {
      toast({ title: "Check your request", description: isCommissionPayout ? "Enter at least $100 within your available commission balance and select a crypto wallet." : "Choose a funded account, enter at least $100 within its available profit, and provide payout details.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      navigate("/login");
      return;
    }

    const result = isCommissionPayout
      ? await supabase.rpc("create_commission_payout", { payout_amount: requestAmount, payout_destination: payoutDestination })
      : await supabase
        .from("payout_requests")
        .insert({ user_id: user.id, account_id: selectedAccount.id, amount: requestAmount, method, destination: payoutDestination, source: "trading_profit" })
        .select("id, account_id, amount, method, destination, source, status, created_at")
        .single();
    const { data, error } = result;

    setSubmitting(false);
    if (error) {
      toast({ title: "Payout request failed", description: error.message, variant: "destructive" });
      return;
    }

    setRequests((current) => [data as PayoutRequest, ...current]);
    if (isCommissionPayout) setCommissionAvailable((current) => current - requestAmount);
    setRequestOpen(false);
    toast({ title: "Payout request submitted", description: "Your request is now pending review." });
  };

  return (
    <DashboardLayout
      title="Payouts"
      subtitle="Manage your withdrawals and payout history"
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Funded Accounts</p>
                  <p className="text-3xl font-bold text-foreground">{accounts.length}</p>
                </div>
                <Wallet className="w-10 h-10 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Profit</p>
                  <p className={`text-3xl font-bold ${
                    totalProfit > 0 ? 'text-success' : 'text-foreground'
                  }`}>
                    ${totalProfit.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-success opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Available for Withdrawal</p>
                  <p className="text-3xl font-bold text-primary">${availableForWithdrawal.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Profit available from funded accounts</p>
                </div>
                <Calendar className="w-10 h-10 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Request Payout Button */}
        <Card variant="elevated" className="bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Request a Payout</span>
              <Button variant="gold" size="sm" onClick={openRequestDialog} disabled={availableForWithdrawal < 100}>
                <ArrowDownRight className="w-4 h-4 mr-2" />
                Request payout
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Request a withdrawal from funded-account profit or accumulated referral commissions. Requests are reviewed within 2-5 business days.
            {accounts.length > 0 && kycStatus !== "approved" && <p className="mt-2 text-warning">Funded-account payouts require approved identity verification. <button type="button" className="font-medium text-primary underline" onClick={() => navigate("/dashboard/kyc")}>{kycStatus === "rejected" ? "Resubmit KYC" : "Complete KYC"}</button></p>}
            {accounts.length === 0 && commissionAvailable < 100 && <p className="mt-2 text-warning">You need at least $100 in available commission or funded-account profit.</p>}
            {accounts.length > 0 && availableForWithdrawal < 100 && <p className="mt-2 text-warning">You need at least $100 in available commission or funded-account profit.</p>}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Payout details</CardTitle>
            <p className="text-sm text-muted-foreground">Add the crypto wallet where your trading earnings and accumulated commissions should be sent before requesting a payout.</p>
          </CardHeader>
          <CardContent className="space-y-5">
            <form onSubmit={addWallet} className="grid gap-4 sm:grid-cols-[1fr_1fr_1.5fr_auto] sm:items-end">
              <div className="space-y-2"><Label htmlFor="payoutWalletNetwork">Network</Label><select id="payoutWalletNetwork" value={walletNetwork} onChange={(event) => setWalletNetwork(event.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option>USDT (TRC20)</option><option>USDT (ERC20)</option><option>USDC (ERC20)</option><option>Bitcoin</option><option>Ethereum</option><option>BNB Smart Chain</option><option>Solana</option></select></div>
              <div className="space-y-2"><Label htmlFor="payoutWalletLabel">Label <span className="text-muted-foreground">(optional)</span></Label><Input id="payoutWalletLabel" value={walletLabel} onChange={(event) => setWalletLabel(event.target.value)} placeholder="Main wallet" /></div>
              <div className="space-y-2"><Label htmlFor="payoutWalletAddress">Wallet address</Label><Input id="payoutWalletAddress" required minLength={20} maxLength={128} value={walletAddress} onChange={(event) => setWalletAddress(event.target.value)} placeholder="Paste your crypto wallet address" /></div>
              <Button type="submit" variant="gold" disabled={addingWallet}><Plus className="h-4 w-4" />{addingWallet ? "Adding..." : "Add wallet"}</Button>
            </form>
            {paymentMethods.length > 0 && <div className="space-y-3 border-t border-border pt-5">{paymentMethods.map((paymentMethod) => <div key={paymentMethod.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 p-4"><div className="min-w-0"><p className="font-medium text-foreground">{paymentMethod.label || paymentMethod.network}</p><p className="truncate text-sm text-muted-foreground">{paymentMethod.network} · {paymentMethod.wallet_address}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => removeWallet(paymentMethod.id)} aria-label={`Remove ${paymentMethod.label || paymentMethod.network} wallet`}><Trash2 className="h-4 w-4 text-destructive" /></Button></div>)}</div>}
          </CardContent>
        </Card>

        {/* Funded Accounts */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Your Funded Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading accounts...</p>
              </div>
            ) : accounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Wallet className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No funded accounts yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  When you have funded accounts, they will appear here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-secondary/50"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        ${account.account_size.toLocaleString()} Account
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Balance: ${(account.current_balance || account.account_size).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        (account.profit_loss || 0) > 0 ? 'text-success' : 'text-foreground'
                      }`}>
                        {(account.profit_loss || 0) > 0 ? '+' : ''}${(account.profit_loss || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Payout History</CardTitle>
          </CardHeader>
          <CardContent>
            {requests.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Your payout requests will appear here.</p>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => {
                  const config = statusConfig[request.status] || statusConfig.pending;
                  const StatusIcon = config.icon;
                  return (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-secondary/50 p-4">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">${request.amount.toLocaleString()} via {request.method === "crypto" ? "Crypto" : "Bank transfer"}</p>
                        <p className="truncate text-sm text-muted-foreground">{request.destination} · {new Date(request.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge className={config.className}><StatusIcon className="mr-1 h-3 w-3" />{config.label}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card variant="elevated" className="bg-primary/5">
          <CardContent className="p-6">
            <h3 className="font-semibold text-foreground mb-3">Payout Information</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Payouts are processed within 2-5 business days</li>
              <li>• Minimum payout amount: $100</li>
              <li>• No fees on withdrawals</li>
              <li>• Only available when your account is in "Funded" status</li>
            </ul>
          </CardContent>
        </Card>
      </div>
      <Dialog open={requestOpen} onOpenChange={setRequestOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request a payout</DialogTitle>
            <DialogDescription>Choose an earnings source and tell us where to send your payout.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payout-source">Earnings source</Label>
              <Select value={payoutSource} onValueChange={(value) => { setPayoutSource(value); if (value === "referral_commission") setMethod("crypto"); }}>
                <SelectTrigger id="payout-source"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="trading_profit">Trading profit (${availableTradingProfit.toLocaleString()})</SelectItem>
                  <SelectItem value="referral_commission">Referral commission (${commissionAvailable.toLocaleString()})</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {payoutSource === "trading_profit" && <div className="space-y-2">
              <Label htmlFor="payout-account">Funded account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="payout-account"><SelectValue placeholder="Select an account" /></SelectTrigger>
                <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>${account.account_size.toLocaleString()} · ${(Math.max(0, account.profit_loss || 0)).toLocaleString()} available</SelectItem>)}</SelectContent>
              </Select>
            </div>}
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Amount (USD)</Label>
              <Input id="payout-amount" type="number" min="100" max={payoutSource === "referral_commission" ? commissionAvailable : Math.max(0, selectedAccount?.profit_loss || 0)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-method">Payout method</Label>
              <Select value={method} onValueChange={setMethod} disabled={payoutSource === "referral_commission"}>
                <SelectTrigger id="payout-method"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="crypto">Cryptocurrency</SelectItem></SelectContent>
              </Select>
            </div>
            {method === "crypto" ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3"><Label htmlFor="payout-wallet">Crypto wallet</Label><Button type="button" variant="link" className="h-auto p-0 text-xs" onClick={() => navigate("/dashboard/settings")}>Manage wallets</Button></div>
                {paymentMethods.length > 0 ? <Select value={selectedPaymentMethodId} onValueChange={setSelectedPaymentMethodId}>
                  <SelectTrigger id="payout-wallet"><SelectValue placeholder="Select a saved wallet" /></SelectTrigger>
                  <SelectContent>{paymentMethods.map((paymentMethod) => <SelectItem key={paymentMethod.id} value={paymentMethod.id}>{paymentMethod.label || paymentMethod.network} · {paymentMethod.wallet_address.slice(0, 8)}...{paymentMethod.wallet_address.slice(-6)}</SelectItem>)}</SelectContent>
                </Select> : <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">Add a crypto wallet in Settings before requesting a crypto payout.</p>}
                {paymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId) && <p className="truncate text-xs text-muted-foreground">{paymentMethods.find((paymentMethod) => paymentMethod.id === selectedPaymentMethodId)?.wallet_address}</p>}
              </div>
            ) : (
              <div className="space-y-2"><Label htmlFor="payout-destination">Bank details</Label><Input id="payout-destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Account name and bank details" /></div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setRequestOpen(false)}>Cancel</Button>
            <Button variant="gold" onClick={submitRequest} disabled={submitting}>{submitting ? "Submitting..." : "Submit request"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
