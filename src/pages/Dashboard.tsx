import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  AlertTriangle,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Rocket,
  Activity,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FUNDED_CONSISTENCY_PERCENT, isInstantAccount } from "@/lib/challengeRules";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Account {
  id: string;
  challenge_type: string;
  account_size: number;
  price: number;
  status: string;
  current_balance: number | null;
  profit_loss: number | null;
  current_phase: number | null;
  drawdown_violated: boolean | null;
  created_at: string;
}

const challengeLabels: Record<string, string> = {
  three_step: "3-Step Challenge",
  two_step: "2-Step Challenge",
  one_step: "1-Step Challenge",
  instant: "Instant Funding",
};

const statusColors: Record<string, string> = {
  pending_payment: "bg-warning/20 text-warning",
  active: "bg-success/20 text-success",
  failed: "bg-destructive/20 text-destructive",
  passed: "bg-primary/20 text-primary",
  funded: "bg-success/20 text-success",
};

const PAYMENT_EXPIRY_MS = 30 * 60 * 1000;

export default function Dashboard() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      const paymentReference = searchParams.get("reference") || searchParams.get("trxref");
      if (paymentReference) {
        const { error: verificationError } = await supabase.functions.invoke(
          "verify-paystack-payment",
          { body: { reference: paymentReference } },
        );

        if (verificationError) {
          console.error("Error verifying Paystack payment:", verificationError);
        }

        navigate("/dashboard", { replace: true });
      }

      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching accounts:", error);
      } else {
        let accountsData = (data || []).filter(
          (account) => account.status !== "failed" || account.drawdown_violated === true,
        );

        const stalePendingIds = accountsData
          .filter((account) => {
            if (account.status !== "pending_payment") return false;
            const ageMs = Date.now() - new Date(account.created_at).getTime();
            return ageMs >= PAYMENT_EXPIRY_MS;
          })
          .map((account) => account.id);

        if (stalePendingIds.length > 0) {
          const { error: stalePendingError } = await supabase
            .from("accounts")
            .update({ status: "failed" })
            .in("id", stalePendingIds)
            .eq("status", "pending_payment");

          if (stalePendingError) {
            console.error("Error expiring stale pending accounts:", stalePendingError);
          } else {
            accountsData = accountsData.filter((account) => !stalePendingIds.includes(account.id));
          }
        }

        setAccounts(accountsData);
      }
      
      setLoading(false);
    };

    checkAuthAndFetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams]);

  const activeAccounts = accounts.filter(a => a.status === "active" || a.status === "funded");
  const pendingAccounts = accounts.filter(a => a.status === "pending_payment");
  const failedAccounts = accounts.filter(a => a.status === "failed");

  const content = (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      ) : (
        <>
          {/* Pending Payment Accounts */}
          {pendingAccounts.length > 0 && (
            <Card variant="elevated" className="border-warning/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-warning">
                  <Clock className="w-5 h-5" />
                  Pending Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-secondary/50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        ${account.account_size.toLocaleString()} {challengeLabels[account.challenge_type]}
                      </div>
                      <div className="text-sm text-muted-foreground break-words">
                        Price: ${account.price} • Created {new Date(account.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <Badge className={statusColors[account.status]}>
                      Awaiting Payment
                    </Badge>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">
                  Your payment is being verified automatically. Account activates within 10 minutes of confirmed payment.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Active Accounts */}
          {activeAccounts.length > 0 ? (
            activeAccounts.map((account) => (
              <Card key={account.id} variant="gold" className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-gold opacity-10" />
                <CardContent className="p-4 sm:p-6 relative z-10">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge className="bg-primary/20 text-primary">
                          {account.status === "funded" || isInstantAccount(account.challenge_type)
                            ? "Funded"
                            : `Phase ${account.current_phase}`}
                        </Badge>
                        <Badge className={statusColors[account.status]}>
                          {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                        </Badge>
                      </div>
                      <h2 className="text-2xl sm:text-3xl font-bold text-foreground break-words">
                        ${account.account_size.toLocaleString()} {challengeLabels[account.challenge_type]}
                      </h2>
                    </div>
                    <div className="flex min-w-0 w-full flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center md:w-auto md:justify-end">
                      <div className="sm:text-right">
                        <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                        <div className="text-2xl sm:text-3xl font-bold text-foreground break-words">
                          ${(account.current_balance || account.account_size).toLocaleString()}
                        </div>
                        {account.profit_loss !== null && account.profit_loss !== 0 && (
                          <div className={cn(
                            "flex items-center gap-1 sm:justify-end",
                            account.profit_loss > 0 ? "text-success" : "text-destructive"
                          )}>
                            {account.profit_loss > 0 ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            <span className="font-medium">
                              {account.profit_loss > 0 ? "+" : ""}${account.profit_loss.toLocaleString()}
                            </span>
                          </div>
                        )}
                      </div>
                      {account.status === "funded" && (
                        <div className="sm:text-right">
                          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1 sm:justify-end">
                            <ShieldCheck className="w-4 h-4 text-primary" />
                            Consistency Score
                          </div>
                          <div className="text-2xl font-bold text-primary">{FUNDED_CONSISTENCY_PERCENT}%</div>
                          <div className="text-xs text-muted-foreground">Maximum best-day share</div>
                        </div>
                      )}
                      <Button
                        variant="gold"
                        size="lg"
                        onClick={() => navigate(`/trade/${account.id}`)}
                        className="w-full sm:w-auto shrink-0"
                      >
                        <Activity className="w-4 h-4 mr-2" />
                        Trade
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : pendingAccounts.length === 0 ? (
            <Card variant="elevated" className="text-center py-12">
              <CardContent>
                <Rocket className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Active Accounts</h3>
                <p className="text-muted-foreground mb-4">Purchase a challenge to start trading</p>
                <Button variant="gold" onClick={() => navigate("/purchase")}>
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {/* Quick Stats for active accounts */}
          {activeAccounts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card variant="elevated">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <Target className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground text-right">Total Accounts</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {activeAccounts.length}
                  </div>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <Wallet className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground text-right">Total Balance</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    ${activeAccounts.reduce((sum, a) => sum + (a.current_balance || a.account_size), 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <TrendingUp className="w-5 h-5 text-success" />
                    <span className="text-sm text-muted-foreground text-right">Total P/L</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    ${activeAccounts.reduce((sum, a) => sum + (a.profit_loss || 0), 0).toLocaleString()}
                  </div>
                </CardContent>
              </Card>

              <Card variant="elevated">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="text-sm text-muted-foreground text-right">Funded Accounts</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    {accounts.filter(a => a.status === "funded").length}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Failed Accounts */}
          {failedAccounts.length > 0 && (
            <Card variant="elevated" className="border-destructive/30 bg-destructive/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  Failed Accounts
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {failedAccounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground">
                        ${account.account_size.toLocaleString()} {challengeLabels[account.challenge_type]}
                      </div>
                        <div className="text-sm text-muted-foreground break-words">
                        Created {new Date(account.created_at).toLocaleDateString()}
                        {account.profit_loss !== null && (
                          <span className="ml-2">
                            • Final Balance: ${(account.current_balance || account.account_size).toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={statusColors[account.status]}>
                        {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/trade/${account.id}`)}
                      >
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
                <p className="text-sm text-muted-foreground">
                  These accounts did not meet the challenge requirements. Review your trading history and try a new challenge.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );

  if (!loading && accounts.length === 0) {
    return (
      <DashboardLayout
        title="Dashboard"
        subtitle="Welcome back! Here's an overview of your accounts."
      >
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card variant="glass" className="max-w-lg w-full text-center">
            <CardContent className="p-8 space-y-6">
              <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                <Rocket className="w-10 h-10 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
                  Welcome to Your Dashboard!
                </h1>
                <p className="text-muted-foreground">
                  You don't have any trading accounts yet. Start your funded trading journey by purchasing a challenge account.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  variant="gold"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate("/purchase")}
                >
                  Get Your First Account
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Welcome back! Here's an overview of your accounts."
    >
      {content}
    </DashboardLayout>
  );
}