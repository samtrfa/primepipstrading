import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

export default function ReferralsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [referralLink, setReferralLink] = useState("");
  const [totalCommission, setTotalCommission] = useState(0);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // The first eight characters are the public referral code stored at signup.
      setReferralLink(`${window.location.origin}/?ref=${session.user.id.slice(0, 8)}`);

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
      setLoading(false);
    };

    checkAuthAndFetchData();
  }, [navigate, toast]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink).then(() => {
      toast({ title: "Copied!", description: "Referral link copied to clipboard" });
    });
  };

  const statusConfig: Record<string, { color: string }> = {
    pending: { color: "bg-warning/20 text-warning" },
    active: { color: "bg-success/20 text-success" },
    completed: { color: "bg-primary/20 text-primary" },
  };

  return (
    <DashboardLayout
      title="Referrals"
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
              Share this link to earn 10% commission on the first account purchase of each referred trader.
            </p>
            <div className="flex gap-2 items-center">
              <div className="flex-1 bg-secondary rounded-lg p-3 font-mono text-sm text-foreground break-all">
                {referralLink}
              </div>
              <Button
                variant="gold"
                size="icon"
                onClick={copyToClipboard}
                className="shrink-0"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
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
                  <p className="font-medium text-foreground">First Account Purchase</p>
                  <p className="text-sm text-muted-foreground">
                    Earned when your referral buys their first account
                  </p>
                </div>
                <p className="text-lg font-bold text-primary">10%</p>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-background/50">
                <div>
                  <p className="font-medium text-foreground">Additional Purchases</p>
                  <p className="text-sm text-muted-foreground">
                    Earned on any subsequent purchases
                  </p>
                </div>
                <p className="text-lg font-bold text-primary">5%</p>
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
                Commission is credited immediately after your referral completes their first account purchase.
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
    </DashboardLayout>
  );
}
