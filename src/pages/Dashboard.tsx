import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Target,
  AlertTriangle,
  DollarSign,
  Calendar,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
  Settings,
  LogOut,
  Menu,
  X,
  Users,
  FileCheck,
  CreditCard,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sidebarLinks = [
  { href: "/dashboard", icon: BarChart3, label: "Overview" },
  { href: "/dashboard/payouts", icon: Wallet, label: "Payouts" },
  { href: "/dashboard/kyc", icon: FileCheck, label: "KYC Verification" },
  { href: "/dashboard/referrals", icon: Users, label: "Referrals" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
];

const mockAccountData = {
  accountSize: "$50,000",
  currentBalance: "$52,340",
  profitLoss: "+$2,340",
  profitLossPercent: "+4.68%",
  phase: "Phase 1",
  status: "Active",
  profitTarget: 8,
  currentProfit: 4.68,
  dailyDrawdown: 5,
  currentDailyDrawdown: 1.2,
  maxDrawdown: 10,
  currentMaxDrawdown: 2.1,
  tradingDays: 12,
  winRate: 67,
};

const recentTrades = [
  { pair: "EUR/USD", type: "BUY", profit: "+$320", time: "2 hours ago", status: "win" },
  { pair: "GBP/JPY", type: "SELL", profit: "-$150", time: "5 hours ago", status: "loss" },
  { pair: "XAU/USD", type: "BUY", profit: "+$580", time: "1 day ago", status: "win" },
  { pair: "USD/CAD", type: "SELL", profit: "+$210", time: "2 days ago", status: "win" },
];

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
                <span className="text-primary font-semibold">JD</span>
              </div>
              <div>
                <div className="font-medium text-foreground">John Doe</div>
                <div className="text-sm text-muted-foreground">Funded Trader</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1">
                <Settings className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="flex-1">
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
                <p className="text-sm text-muted-foreground">Welcome back, John</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon">
                <Bell className="w-5 h-5" />
              </Button>
              <Button variant="gold" size="sm">
                Request Payout
              </Button>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="flex-1 p-4 lg:p-8 space-y-6">
          {/* Account Status Banner */}
          <Card variant="gold" className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-gold opacity-10" />
            <CardContent className="p-6 relative z-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm font-medium">
                      {mockAccountData.phase}
                    </span>
                    <span className="px-3 py-1 rounded-full bg-success/20 text-success text-sm font-medium">
                      {mockAccountData.status}
                    </span>
                  </div>
                  <h2 className="text-3xl font-bold text-foreground">
                    {mockAccountData.accountSize} Challenge
                  </h2>
                </div>
                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                  <div className="text-3xl font-bold text-foreground">
                    {mockAccountData.currentBalance}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-success">
                    <ArrowUpRight className="w-4 h-4" />
                    <span className="font-medium">{mockAccountData.profitLoss}</span>
                    <span className="text-sm">({mockAccountData.profitLossPercent})</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Profit Target */}
            <Card variant="elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Profit Target</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-foreground">
                    {mockAccountData.currentProfit}%
                  </span>
                  <span className="text-muted-foreground"> / {mockAccountData.profitTarget}%</span>
                </div>
                <Progress
                  value={(mockAccountData.currentProfit / mockAccountData.profitTarget) * 100}
                  className="h-2"
                />
              </CardContent>
            </Card>

            {/* Daily Drawdown */}
            <Card variant="elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <TrendingDown className="w-5 h-5 text-warning" />
                  <span className="text-sm text-muted-foreground">Daily Drawdown</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-foreground">
                    {mockAccountData.currentDailyDrawdown}%
                  </span>
                  <span className="text-muted-foreground"> / {mockAccountData.dailyDrawdown}%</span>
                </div>
                <Progress
                  value={(mockAccountData.currentDailyDrawdown / mockAccountData.dailyDrawdown) * 100}
                  className="h-2 [&>div]:bg-warning"
                />
              </CardContent>
            </Card>

            {/* Max Drawdown */}
            <Card variant="elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                  <span className="text-sm text-muted-foreground">Max Drawdown</span>
                </div>
                <div className="mb-2">
                  <span className="text-2xl font-bold text-foreground">
                    {mockAccountData.currentMaxDrawdown}%
                  </span>
                  <span className="text-muted-foreground"> / {mockAccountData.maxDrawdown}%</span>
                </div>
                <Progress
                  value={(mockAccountData.currentMaxDrawdown / mockAccountData.maxDrawdown) * 100}
                  className="h-2 [&>div]:bg-destructive"
                />
              </CardContent>
            </Card>

            {/* Trading Days */}
            <Card variant="elevated">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <Calendar className="w-5 h-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Trading Days</span>
                </div>
                <div className="text-2xl font-bold text-foreground mb-2">
                  {mockAccountData.tradingDays}
                </div>
                <div className="text-sm text-muted-foreground">No minimum required</div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Trades */}
          <Card variant="elevated">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Recent Trades</span>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTrades.map((trade, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-lg flex items-center justify-center",
                          trade.status === "win" ? "bg-success/20" : "bg-destructive/20"
                        )}
                      >
                        {trade.status === "win" ? (
                          <ArrowUpRight className="w-5 h-5 text-success" />
                        ) : (
                          <ArrowDownRight className="w-5 h-5 text-destructive" />
                        )}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{trade.pair}</div>
                        <div className="text-sm text-muted-foreground">{trade.type}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={cn(
                          "font-semibold",
                          trade.status === "win" ? "text-success" : "text-destructive"
                        )}
                      >
                        {trade.profit}
                      </div>
                      <div className="text-sm text-muted-foreground">{trade.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
