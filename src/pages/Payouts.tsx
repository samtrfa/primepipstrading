import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DollarSign, ArrowDownRight, Calendar, Wallet, Clock, CheckCircle2, XCircle } from "lucide-react";
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
  account_id: string;
  amount: number;
  method: string;
  destination: string;
  status: string;
  created_at: string;
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
  const [requests, setRequests] = useState<PayoutRequest[]>([]);
  const [requestOpen, setRequestOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("bank_transfer");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
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
        .select("id, account_id, amount, method, destination, status, created_at")
        .order("created_at", { ascending: false });

      if (payoutError) {
        console.error("Error fetching payout requests:", payoutError);
      } else {
        setRequests(payoutData || []);
      }
      setLoading(false);
    };

    checkAuthAndFetchData();
  }, [navigate]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId);
  const availableForWithdrawal = Math.max(0, accounts.reduce((sum, account) => sum + Math.max(0, account.profit_loss || 0), 0));
  const requestAmount = Number(amount);

  const openRequestDialog = () => {
    const firstEligibleAccount = accounts.find((account) => (account.profit_loss || 0) >= 100) || accounts[0];
    const accountProfit = Math.max(0, firstEligibleAccount?.profit_loss || 0);
    setSelectedAccountId(firstEligibleAccount?.id || "");
    setAmount(accountProfit >= 100 ? String(Math.floor(accountProfit)) : "");
    setDestination("");
    setRequestOpen(true);
  };

  const submitRequest = async () => {
    if (!selectedAccount || requestAmount < 100 || requestAmount > Math.max(0, selectedAccount.profit_loss || 0) || !destination.trim()) {
      toast({ title: "Check your request", description: "Choose a funded account, enter at least $100 within its available profit, and provide payout details." , variant: "destructive" });
      return;
    }

    setSubmitting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setSubmitting(false);
      navigate("/login");
      return;
    }

    const { data, error } = await supabase
      .from("payout_requests")
      .insert({ user_id: user.id, account_id: selectedAccount.id, amount: requestAmount, method, destination: destination.trim() })
      .select("id, account_id, amount, method, destination, status, created_at")
      .single();

    setSubmitting(false);
    if (error) {
      toast({ title: "Payout request failed", description: error.message, variant: "destructive" });
      return;
    }

    setRequests((current) => [data, ...current]);
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
              <Button variant="gold" size="sm" onClick={openRequestDialog} disabled={accounts.length === 0 || availableForWithdrawal < 100}>
                <ArrowDownRight className="w-4 h-4 mr-2" />
                Request payout
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Request a withdrawal from any funded account with at least $100 in available profit. Requests are reviewed within 2-5 business days.
            {accounts.length === 0 && <p className="mt-2 text-warning">You need a funded account before requesting a payout.</p>}
            {accounts.length > 0 && availableForWithdrawal < 100 && <p className="mt-2 text-warning">You need at least $100 in available profit to request a payout.</p>}
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
            <DialogDescription>Choose a funded account and tell us where to send your profit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="payout-account">Funded account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="payout-account"><SelectValue placeholder="Select an account" /></SelectTrigger>
                <SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>${account.account_size.toLocaleString()} · ${(Math.max(0, account.profit_loss || 0)).toLocaleString()} available</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-amount">Amount (USD)</Label>
              <Input id="payout-amount" type="number" min="100" max={Math.max(0, selectedAccount?.profit_loss || 0)} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="100" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-method">Payout method</Label>
              <Select value={method} onValueChange={setMethod}>
                <SelectTrigger id="payout-method"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="crypto">Cryptocurrency</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payout-destination">{method === "crypto" ? "Wallet address" : "Bank details"}</Label>
              <Input id="payout-destination" value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={method === "crypto" ? "Wallet address" : "Account name and bank details"} />
            </div>
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
