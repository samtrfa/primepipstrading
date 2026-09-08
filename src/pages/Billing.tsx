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
  Gift,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import jsPDF from "jspdf";

interface Invoice {
  id: string;
  amount: number;
  status: "pending" | "earned" | "paid" | "failed" | "overdue" | "refunded" | "unmatched" | "granted";
  date: string;
  due_date: string;
  description: string;
  currency?: string;
  reference?: string;
}

interface BillingAccount {
  id: string;
  price: number;
  status: "pending_payment" | "active" | "failed" | "passed" | "funded";
  created_at: string;
  account_size: number;
  challenge_type: string;
}

interface CommissionEntry {
  id: string;
  commission_earned: number;
  referred_at: string;
}

interface CommissionWithdrawal {
  id: string;
  amount: number;
  status: "pending" | "approved" | "paid" | "rejected";
  created_at: string;
}

const statusConfig: Record<string, { icon: typeof Clock; color: string; label: string }> = {
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
  earned: {
    icon: Gift,
    color: "bg-primary/20 text-primary",
    label: "Earned",
  },
  overdue: {
    icon: AlertCircle,
    color: "bg-destructive/20 text-destructive",
    label: "Overdue",
  },
  failed: {
    icon: AlertCircle,
    color: "bg-destructive/20 text-destructive",
    label: "Failed",
  },
  refunded: {
    icon: AlertCircle,
    color: "bg-secondary text-muted-foreground",
    label: "Refunded",
  },
  unmatched: {
    icon: AlertCircle,
    color: "bg-destructive/20 text-destructive",
    label: "Unmatched",
  },
  granted: {
    icon: Gift,
    color: "bg-primary/20 text-primary",
    label: "Granted",
  },
};

const formatCurrency = (value: number) => `$${value.toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

async function downloadInvoice(invoice: Invoice) {
  const document = new jsPDF();
  const pageWidth = document.internal.pageSize.getWidth();
  const rightEdge = pageWidth - 20;

  document.setFillColor(20, 29, 42);
  document.rect(0, 0, pageWidth, 42, "F");
  const logo = await fetch("/logo.svg").then((response) => response.text()).catch(() => "");
  if (logo) {
    const logoData = await new Promise<string>((resolve) => {
      const image = new Image();
      image.onload = () => {
        const canvas = window.document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        canvas.getContext("2d")?.drawImage(image, 0, 0, 128, 128);
        resolve(canvas.toDataURL("image/png"));
      };
      image.onerror = () => resolve("");
      image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logo)}`;
    });
    if (logoData) document.addImage(logoData, "PNG", 20, 7, 28, 28);
  }
  document.setTextColor(255, 255, 255);
  document.setFont("helvetica", "bold");
  document.setFontSize(24);
  document.text("PrimePips", 54, 20);
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.text("Trading performance, funded with purpose", 54, 29);

  document.setTextColor(20, 29, 42);
  document.setFont("helvetica", "bold");
  document.setFontSize(20);
  document.text("INVOICE", rightEdge, 62, { align: "right" });
  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.setTextColor(95, 105, 120);
  document.text(invoice.id, rightEdge, 70, { align: "right" });
  document.text(`Issued ${new Date(invoice.date).toLocaleDateString()}`, rightEdge, 77, { align: "right" });

  document.setDrawColor(220, 225, 232);
  document.line(20, 90, rightEdge, 90);
  document.setTextColor(95, 105, 120);
  document.setFontSize(10);
  document.text("BILLED FOR", 20, 105);
  document.setTextColor(20, 29, 42);
  document.setFont("helvetica", "bold");
  document.setFontSize(12);
  document.text("PrimePips Trading Account", 20, 114);
  document.setFont("helvetica", "normal");
  document.setTextColor(95, 105, 120);
  document.setFontSize(10);
  document.text("Challenge access and trading platform services", 20, 122);

  document.setFillColor(246, 248, 250);
  document.roundedRect(20, 140, pageWidth - 40, 42, 3, 3, "F");
  document.setTextColor(95, 105, 120);
  document.text("DESCRIPTION", 28, 153);
  document.text("STATUS", pageWidth - 92, 153);
  document.text("AMOUNT", rightEdge - 2, 153, { align: "right" });
  document.setTextColor(20, 29, 42);
  document.setFont("helvetica", "bold");
  document.text(invoice.description, 28, 166);
  document.setFont("helvetica", "normal");
  document.setTextColor(30, 130, 85);
  document.text(statusConfig[invoice.status].label, pageWidth - 92, 166);
  document.setTextColor(20, 29, 42);
  document.setFont("helvetica", "bold");
  document.text(formatCurrency(invoice.amount), rightEdge - 2, 166, { align: "right" });

  document.setFont("helvetica", "normal");
  document.setFontSize(10);
  document.setTextColor(95, 105, 120);
  document.text(`Payment due: ${new Date(invoice.due_date).toLocaleDateString()}`, 20, 205);
  document.text("Thank you for choosing PrimePips.", 20, 222);
  document.setDrawColor(220, 225, 232);
  document.line(20, 270, rightEdge, 270);
  document.setFontSize(9);
  document.text("PrimePips Trading | This invoice was generated electronically.", 20, 280);

  document.save(`${invoice.id.toLowerCase()}.pdf`);
}

export default function BillingPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
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

      const [{ data: accounts, error: accountsError }, { data: payments, error: paymentsError }] = await Promise.all([
        supabase
          .from("accounts")
          .select("id, price, status, created_at, account_size, challenge_type")
          .order("created_at", { ascending: false }),
        supabase
          .from("payment_orders")
          .select("id, amount, currency, status, checkout_at, provider_reference, account_id, provider")
          .order("checkout_at", { ascending: false }),
      ]);

      if (accountsError) console.error("Error fetching accounts:", accountsError);
      if (paymentsError) console.error("Error fetching payment orders:", paymentsError);

      const accountRows = (accounts || []) as BillingAccount[];
      const paymentRows = payments || [];
      const paymentsByAccount = new Map(paymentRows.filter((payment) => payment.account_id).map((payment) => [payment.account_id, payment]));
      const generatedInvoices: Invoice[] = accountRows.map((account) => {
        const payment = paymentsByAccount.get(account.id);
        const status = account.status === "pending_payment"
          ? "pending"
          : account.status === "failed"
            ? "failed"
            : "paid";
        return {
          id: payment ? `PAY-${payment.id.slice(0, 8).toUpperCase()}` : `INV-${account.id.slice(0, 8).toUpperCase()}`,
          amount: Number(account.price),
          status,
          date: payment?.checkout_at || account.created_at,
          due_date: payment?.checkout_at || account.created_at,
          description: `${account.account_size.toLocaleString()} ${account.challenge_type.replace(/_/g, " ")} Challenge`,
          currency: payment?.currency,
          reference: payment?.provider_reference,
        };
      });

      const accountIds = new Set(accountRows.map((account) => account.id));
      const standaloneInvoices: Invoice[] = paymentRows
        .filter((payment) => !payment.account_id || !accountIds.has(payment.account_id))
        .map((payment) => ({
          id: `PAY-${payment.id.slice(0, 8).toUpperCase()}`,
          amount: Number(payment.amount),
          status: payment.status === "success" ? "paid" : payment.status === "granted" ? "granted" : payment.status === "refunded" ? "refunded" : payment.status === "unmatched" ? "unmatched" : payment.status === "pending" ? "pending" : "failed",
          date: payment.checkout_at,
          due_date: payment.checkout_at,
          description: `${payment.provider.toUpperCase()} payment${payment.account_id ? ` for account ${payment.account_id.slice(0, 8)}` : ""}`,
          currency: payment.currency,
          reference: payment.provider_reference,
        }));
      setInvoices([...generatedInvoices, ...standaloneInvoices]);

      const allPaymentInvoices = [...generatedInvoices, ...standaloneInvoices];
      setTotalSpent(allPaymentInvoices.filter((invoice) => invoice.status === "paid").reduce((sum, invoice) => sum + invoice.amount, 0));
      setPendingBalance(allPaymentInvoices.filter((invoice) => invoice.status === "pending").reduce((sum, invoice) => sum + invoice.amount, 0));

      const [{ data: commissionData, error: commissionError }, { data: withdrawalData, error: withdrawalError }] = await Promise.all([
        supabase
          .from("referrals")
          .select("id, commission_earned, referred_at")
          .gt("commission_earned", 0)
          .order("referred_at", { ascending: false }),
        supabase
          .from("payout_requests")
          .select("id, amount, status, created_at")
          .eq("source", "referral_commission")
          .order("created_at", { ascending: false }),
      ]);

      if (commissionError) {
        console.error("Error fetching commission entries:", commissionError);
      }
      if (withdrawalError) {
        console.error("Error fetching commission withdrawals:", withdrawalError);
      }

      const commissionEntries: Invoice[] = (commissionData as CommissionEntry[] || []).map((entry) => ({
        id: `COM-${entry.id.slice(0, 8).toUpperCase()}`,
        amount: entry.commission_earned,
        status: "earned",
        date: entry.referred_at,
        due_date: entry.referred_at,
        description: "Referral commission earned",
      }));
      const commissionWithdrawals: Invoice[] = (withdrawalData as CommissionWithdrawal[] || []).map((withdrawal) => ({
        id: `WD-${withdrawal.id.slice(0, 8).toUpperCase()}`,
        amount: withdrawal.amount,
        status: withdrawal.status === "paid"
          ? "paid"
          : withdrawal.status === "rejected"
            ? "failed"
            : "pending",
        date: withdrawal.created_at,
        due_date: withdrawal.created_at,
        description: "Referral commission withdrawal",
      }));

      if (commissionEntries.length > 0 || commissionWithdrawals.length > 0) {
        setInvoices((current) => [...current, ...commissionEntries, ...commissionWithdrawals]
          .sort((first, second) => new Date(second.date).getTime() - new Date(first.date).getTime()));
      }

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
      <div className="space-y-4 sm:space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card variant="elevated">
            <CardContent className="p-4 sm:p-6">
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
            <CardContent className="p-4 sm:p-6">
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
            <CardContent className="p-4 sm:p-6">
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

        {/* Invoices */}
        <Card variant="elevated">
          <CardHeader className="px-4 sm:px-6">
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {invoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <DollarSign className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground">No invoices yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="hidden overflow-x-auto md:block">
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
                              {invoice.currency || "USD"} {invoice.amount.toLocaleString()}
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
                              onClick={() => downloadInvoice(invoice)}
                              aria-label={`Download ${invoice.id} invoice`}
                              title="Download invoice"
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
                <div className="space-y-3 md:hidden">
                {invoices.map((invoice) => {
                  const config = statusConfig[invoice.status];
                  const StatusIcon = config.icon;
                  return (
                    <div key={invoice.id} className="rounded-lg border border-border bg-secondary/30 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground">{invoice.id}</p>
                          <p className="mt-1 break-words text-sm text-muted-foreground">{invoice.description}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 text-primary"
                          onClick={() => downloadInvoice(invoice)}
                          aria-label={`Download ${invoice.id} invoice`}
                          title="Download invoice"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="mt-1 font-semibold text-foreground">{invoice.currency || "USD"} {invoice.amount.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Status</p>
                          <Badge className={`mt-1 ${config.color}`}><StatusIcon className="mr-1 h-3 w-3" />{config.label}</Badge>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Issued</p>
                          <p className="mt-1 text-foreground">{new Date(invoice.date).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Due date</p>
                          <p className="mt-1 text-foreground">{new Date(invoice.due_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
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
