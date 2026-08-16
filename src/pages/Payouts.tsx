import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DollarSign, ArrowDownRight, Calendar, Wallet } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

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

export default function PayoutsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalProfit, setTotalProfit] = useState(0);

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
        .eq("status", "funded")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching accounts:", error);
      } else if (data) {
        setAccounts(data);
        // Calculate total profit from all funded accounts
        const total = data.reduce((sum, a) => sum + (a.profit_loss || 0), 0);
        setTotalProfit(total);
      }
      setLoading(false);
    };

    checkAuthAndFetchData();
  }, [navigate]);

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
                  <p className="text-3xl font-bold text-primary">$0</p>
                  <p className="text-xs text-muted-foreground mt-1">Coming soon</p>
                </div>
                <Calendar className="w-10 h-10 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Request Payout Button */}
        <Card variant="elevated" className="bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Request a Payout</span>
              <Button variant="gold" size="sm" disabled>
                <ArrowDownRight className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Payout functionality is currently being set up. You'll be able to withdraw profits from your funded accounts soon.
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
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
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
    </DashboardLayout>
  );
}
