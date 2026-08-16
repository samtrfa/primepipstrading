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
  CreditCard,
  Download,
  AlertCircle,
  CheckCircle2,
  Clock,
  DollarSign,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";

interface Invoice {
  id: string;
  amount: number;
  status: "pending" | "paid" | "overdue";
  date: string;
  due_date: string;
  description: string;
}

interface PaymentMethod {
  id: string;
  type: "card" | "bank";
  last4: string;
  brand: string;
  expiry: string;
  is_default: boolean;
}

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  pending: {
    icon: Clock,
    color: "bg-warning/20 text-warning",
    label: "Pending",
  },
  paid: {
    icon: CheckCircle2,
    color: "bg-success/20 text-success",
    label: "Paid",
  },
  overdue: {
    icon: AlertCircle,
    color: "bg-destructive/20 text-destructive",
    label: "Overdue",
  },
};

export default function BillingPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [pendingBalance, setPendingBalance] = useState(0);

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // Fetch accounts to generate invoices from purchases
      const { data: accounts, error } = await supabase
        .from("accounts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching accounts:", error);
      } else if (accounts) {
        // Generate invoices from accounts data
        const generatedInvoices = accounts.map((account, index) => ({
          id: `INV-${String(index + 1).padStart(3, "0")}`,
          amount: account.price,
          status: account.status === "pending_payment" ? "pending" : "paid",
          date: account.created_at,
          due_date: new Date(new Date(account.created_at).getTime() + 10 * 24 * 60 * 60 * 1000).toISOString(),
          description: `$${account.account_size.toLocaleString()} ${account.challenge_type.replace(/_/g, " ")} Challenge`,
        }));
        setInvoices(generatedInvoices);

        // Calculate total spent from all accounts
        const total = accounts.reduce((sum, a) => sum + a.price, 0);
        setTotalSpent(total);

        // Calculate pending balance
        const pending = accounts
          .filter(a => a.status === "pending_payment")
          .reduce((sum, a) => sum + a.price, 0);
        setPendingBalance(pending);
      }

      // TODO: Fetch payment methods from backend when payment_methods table is created
      setPaymentMethods([]);
      setLoading(false);
    };

    checkAuthAndFetchData();
  }, [navigate]);

  if (loading) {
    return (
      <DashboardLayout
        title="Billing"
        subtitle="Manage your billing and invoices"
      >
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Loading billing information...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      title="Billing"
      subtitle="Manage your billing and invoices"
    >
      <div className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
                  <p className="text-3xl font-bold text-foreground">
                    ${totalSpent.toLocaleString()}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Pending Balance</p>
                  <p className="text-3xl font-bold text-warning">
                    ${pendingBalance.toLocaleString()}
                  </p>
                </div>
                <Clock className="w-10 h-10 text-warning opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card variant="elevated">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Invoices</p>
                  <p className="text-3xl font-bold text-foreground">{invoices.length}</p>
                </div>
                <CreditCard className="w-10 h-10 text-primary opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Payment Methods */}
        <Card variant="elevated">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>Payment Methods</span>
              <Button variant="gold" size="sm">
                Add Payment Method
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentMethods.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CreditCard className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No payment methods added</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a payment method to make purchases
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method) => (
                  <div
                    key={method.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50 hover:bg-secondary/70 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-8 rounded bg-primary/20 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {method.brand} •••• {method.last4}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Expires {method.expiry}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {method.is_default && (
                        <Badge variant="secondary">Default</Badge>
                      )}
                      <Button variant="ghost" size="sm">
                        Edit
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice ID</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Due Date</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => {
                      const config = statusConfig[invoice.status];
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-semibold">
                            {invoice.id}
                          </TableCell>
                          <TableCell className="text-sm">
                            {invoice.description}
                          </TableCell>
                          <TableCell className="font-semibold">
                            ${invoice.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge className={config.color}>
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(invoice.date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="text-sm">
                            {new Date(invoice.due_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Billing Info */}
        <Card variant="elevated" className="bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Billing Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold text-foreground mb-2">Billing Cycle</h4>
              <p className="text-sm text-muted-foreground">
                Your billing cycle is based on the date of purchase for each account. Invoices are issued immediately upon account creation.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Payment</h4>
              <p className="text-sm text-muted-foreground">
                Payments are processed instantly. Once payment is confirmed, your account will be activated and ready to trade.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-2">Refunds</h4>
              <p className="text-sm text-muted-foreground">
                Refunds are not available for purchased accounts. However, if you don't meet the challenge requirements, you can purchase another account.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
