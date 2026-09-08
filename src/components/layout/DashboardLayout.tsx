import { useState, useEffect, ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Activity,
  TrendingUp,
  BarChart3,
  LineChart,
  Wallet,
  Users,
  CreditCard,
  Tag,
  Settings,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  FileCheck2,
  Headphones,
  Award,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import NotificationsCenter from "@/components/layout/NotificationsCenter";

const sidebarLinks: Array<{ href: string; icon: typeof Activity; label: string; nested?: boolean }> = [
  { href: "/dashboard", icon: BarChart3, label: "Overview" },
  { href: "/dashboard/analytics", icon: LineChart, label: "Analytics", nested: true },
  { href: "/dashboard/payouts", icon: Wallet, label: "Payouts" },
  { href: "/dashboard/certificates", icon: Award, label: "Certificates" },
  { href: "/dashboard/kyc", icon: FileCheck2, label: "Identity verification" },
  { href: "/dashboard/billing", icon: CreditCard, label: "Billing" },
];

const adminLinks = [
  { href: "/admin", icon: ShieldCheck, label: "Platform overview" },
  { href: "/admin/kyc", icon: FileCheck2, label: "KYC review" },
  { href: "/admin/traders", icon: Users, label: "Traders" },
  { href: "/admin/exposure", icon: LineChart, label: "Trading exposure" },
  { href: "/admin/referrals", icon: Users, label: "Referral analytics" },
  { href: "/admin/affiliates", icon: Users, label: "Affiliate partners" },
  { href: "/admin/activity", icon: Activity, label: "Trade activity" },
  { href: "/admin/payouts", icon: Wallet, label: "Payout requests" },
  { href: "/admin/payments", icon: CreditCard, label: "Payment reconciliation" },
  { href: "/admin/coupons", icon: Tag, label: "Purchase coupons" },
];

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export default function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState("");
  const [activeAccounts, setActiveAccounts] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAffiliate, setIsAffiliate] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const handleNavigation = (href: string) => {
    setSidebarOpen(false);
  };

  useEffect(() => {
    const checkAuthAndFetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/login");
        return;
      }

      const adminSession = session.user.app_metadata?.role === "admin";
      const affiliateSession = session.user.app_metadata?.affiliate === true;
      setUserName(session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || (adminSession ? "Admin" : "Trader"));
      setIsAdmin(adminSession);
      setIsAffiliate(affiliateSession);

      if (adminSession && !location.pathname.startsWith("/admin")) {
        navigate("/admin", { replace: true });
        return;
      }

      if (!adminSession) {
        const { data } = await supabase
          .from("accounts")
          .select("*")
          .order("created_at", { ascending: false });

        if (data) {
          const active = data.filter(a => a.status === "active" || a.status === "funded").length;
          setActiveAccounts(active);
        }
      }
    };

    checkAuthAndFetchData();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/login");
      }
    });

    return () => subscription.unsubscribe();
  }, [location.pathname, navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out.",
    });
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[min(18rem,calc(100vw-1rem))] overflow-y-auto bg-card border-r border-border transform transition-transform lg:translate-x-0 lg:static",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex min-h-full flex-col">
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
            {(isAdmin ? adminLinks : [...sidebarLinks, { href: "/dashboard/affiliate", icon: Users, label: isAffiliate ? "Affiliate" : "Become an Affiliate" }]).map((link) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => handleNavigation(link.href)}
                className={cn(
                  "flex items-center gap-3 rounded-lg py-3 transition-all duration-300",
                  link.nested ? "ml-4 px-4 text-sm" : "px-4",
                  link.label === "Become an Affiliate" ? "bg-gradient-to-r from-primary via-gold-light to-primary text-primary-foreground font-bold hover:shadow-gold hover:scale-[1.02] active:scale-[0.98]" : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  location.pathname === link.href && "bg-primary/10 text-primary"
                )}
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
                  {isAdmin ? "Platform Admin" : activeAccounts > 0 ? "Funded Trader" : "Trader"}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {!isAdmin && <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => navigate("/dashboard/settings")}
                aria-label="Open settings"
              >
                <Settings className="w-4 h-4" />
              </Button>}
              <Button variant="ghost" size="sm" className="flex-1" onClick={() => window.dispatchEvent(new Event("primepips:open-support"))} aria-label="Open PrimePips support">
                <Headphones className="w-4 h-4" />
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
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border px-4 lg:px-8 py-4">
          <div className="flex min-w-0 items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-foreground"
              >
                <Menu className="w-6 h-6" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-xl font-serif font-bold text-foreground">{title}</h1>
                {subtitle && (
                  <p className="text-sm text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:gap-4">
              {!isAdmin && <NotificationsCenter />}
              {!isAdmin && <Button variant="gold" size="sm" onClick={() => navigate("/purchase")}>
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Account</span>
              </Button>}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="min-w-0 flex-1 p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
