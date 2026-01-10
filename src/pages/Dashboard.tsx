import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  AlertTriangle,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Settings,
  LogOut,
  Menu,
  Users,
  FileCheck,
  CreditCard,
  Plus,
  Clock,
  Rocket,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const sidebarLinks = [
  { href: "/dashboard", icon: BarChart3, label: "Overview" },
  { href: "/dashboard/payouts", icon: Wallet, label: "Payouts" },
  { href: "/dashboard/kyc", icon: FileCheck, label: "KYC Verification" },
  { href: "/dashboard/referrals", icon: Users, label: "Referrals" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
];

interface Account {
  id: string;
  challenge_type: string;
  account_size: number;
  price: number;
  status: string;
  current_balance: number | null;
  profit_loss: number | null;
  current_phase: number | null;
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

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "Trader");

      const { data, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching accounts:", error);
      } else {
        setAccounts(data || []);
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
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/");
  };

  const activeAccounts = accounts.filter(a => a.status === "active" || a.status === "funded");
  const pendingAccounts = accounts.filter(a => a.status === "pending_payment");

  // No accounts - show purchase prompt
  if (!loading && accounts.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card variant="glass" className="max-w-lg w-full text-center">
          <CardContent className="p-8 space-y-6">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
              <Rocket className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-bold text-foreground mb-2">
                Welcome, {userName}!
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
                <Plus className="w-5 h-5 mr-2" />
                Get Your First Account
              </Button>
              <Button
                variant="ghost"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link to="/" className="flex items-center gap-2">
              <div className="relative w-10 h-10 flex items-center justify-center">
                <div className="absolute inset-0 bg-gradient-gold rounded-lg opacity-20" />
                <TrendingUp className="w-6 h-6 text-primary relative z-10" />
              </div>
              <span className="text-xl font-serif font-bold text-foreground">
                Prime<span className="text-primary">Pips</span>
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {sidebarLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className="flex items-center gap-3 px-4 py-3 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <link.icon className="w-5 h-5" />
                <span>{link.label}</span>
              </Link>
            ))}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-primary font-semibold">
                  {userName.slice(0, 2).toUpperCase()}
                </span>
              </div>
              <div>
                <div className="font-medium text-foreground">{userName}</div>
                <div className="text-sm text-muted-foreground">
                  {activeAccounts.length > 0 ? "Funded Trader" : "Trader"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1">
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="flex-1" onClick={handleLogout}>
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-foreground"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-xl font-serif font-bold text-foreground">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Welcome back, {userName}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="gold" size="sm" onClick={() => navigate("/purchase")}>
                <Plus className="w-4 h-4 mr-2" />
                New Account
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 lg:p-8 space-y-6">
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
                        className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                      >
                        <div>
                          <div className="font-medium text-foreground">
                            ${account.account_size.toLocaleString()} {challengeLabels[account.challenge_type]}
                          </div>
                          <div className="text-sm text-muted-foreground">
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
                    <CardContent className="p-6 relative z-10">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className="bg-primary/20 text-primary">
                              {account.status === "funded" ? "Funded" : `Phase ${account.current_phase}`}
                            </Badge>
                            <Badge className={statusColors[account.status]}>
                              {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                            </Badge>
                          </div>
                          <h2 className="text-3xl font-bold text-foreground">
                            ${account.account_size.toLocaleString()} {challengeLabels[account.challenge_type]}
                          </h2>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                            <div className="text-3xl font-bold text-foreground">
                              ${(account.current_balance || account.account_size).toLocaleString()}
                            </div>
                            {account.profit_loss !== null && account.profit_loss !== 0 && (
                              <div className={cn(
                                "flex items-center justify-end gap-1",
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
                          <Button
                            variant="gold"
                            size="lg"
                            onClick={() => navigate(`/trade/${account.id}`)}
                            className="shrink-0"
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
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Target className="w-5 h-5 text-primary" />
                        <span className="text-sm text-muted-foreground">Total Accounts</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {activeAccounts.length}
                      </div>
                    </CardContent>
                  </Card>

                  <Card variant="elevated">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Wallet className="w-5 h-5 text-primary" />
                        <span className="text-sm text-muted-foreground">Total Balance</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        ${activeAccounts.reduce((sum, a) => sum + (a.current_balance || a.account_size), 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>

                  <Card variant="elevated">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <TrendingUp className="w-5 h-5 text-success" />
                        <span className="text-sm text-muted-foreground">Total P/L</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        ${activeAccounts.reduce((sum, a) => sum + (a.profit_loss || 0), 0).toLocaleString()}
                      </div>
                    </CardContent>
                  </Card>

                  <Card variant="elevated">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <Calendar className="w-5 h-5 text-primary" />
                        <span className="text-sm text-muted-foreground">Funded Accounts</span>
                      </div>
                      <div className="text-2xl font-bold text-foreground">
                        {accounts.filter(a => a.status === "funded").length}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}