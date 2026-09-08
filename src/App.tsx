import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Analytics from "./pages/Analytics";
import Payouts from "./pages/Payouts";
import Certificates from "./pages/Certificates";
import Referrals from "./pages/Referrals";
import Billing from "./pages/Billing";
import Settings from "./pages/Settings";
import KYC from "./pages/KYC";
import Pricing from "./pages/Pricing";
import HowItWorks from "./pages/HowItWorks";
import FAQ from "./pages/FAQ";
import PurchaseAccount from "./pages/PurchaseAccount";
import TradingPlatform from "./pages/TradingPlatform";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import {
  About,
  Careers,
  Contact,
  Press,
  Blog,
  RiskDisclosure,
  RefundPolicy,
} from "./pages/FooterPages";
import NotFound from "./pages/NotFound";
import Admin from "./pages/Admin";
import TraderDetails from "./pages/TraderDetails";
import AffiliateDetails from "./pages/AffiliateDetails";
import AuthCallback from "./pages/AuthCallback";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import VerifyEmail from "./pages/VerifyEmail";
import { Navigate } from "react-router-dom";
import { FaqSupportBot } from "./components/support/FaqSupportBot";

const queryClient = new QueryClient();

const App = () => (
  <div className="w-full min-h-screen overflow-x-hidden">
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/analytics" element={<Analytics />} />
            <Route path="/dashboard/payouts" element={<Payouts />} />
            <Route path="/dashboard/certificates" element={<Certificates />} />
            <Route path="/dashboard/affiliate" element={<Referrals />} />
            <Route path="/dashboard/referrals" element={<Navigate to="/dashboard/affiliate" replace />} />
            <Route path="/dashboard/billing" element={<Billing />} />
            <Route path="/dashboard/settings" element={<Settings />} />
            <Route path="/dashboard/kyc" element={<KYC />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/kyc" element={<Admin section="kyc" />} />
            <Route path="/admin/traders" element={<Admin section="traders" />} />
            <Route path="/admin/traders/:userId" element={<TraderDetails />} />
            <Route path="/admin/affiliates/:userId" element={<AffiliateDetails />} />
            <Route path="/admin/exposure" element={<Admin section="exposure" />} />
            <Route path="/admin/referrals" element={<Admin section="referrals" />} />
            <Route path="/admin/affiliates" element={<Admin section="affiliates" />} />
            <Route path="/admin/activity" element={<Admin section="activity" />} />
            <Route path="/admin/payouts" element={<Admin section="payouts" />} />
            <Route path="/admin/payments" element={<Admin section="payments" />} />
            <Route path="/admin/coupons" element={<Admin section="coupons" />} />
            <Route path="/purchase" element={<PurchaseAccount />} />
            <Route path="/trade/:accountId" element={<TradingPlatform />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/about" element={<About />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/press" element={<Press />} />
            <Route path="/blog" element={<Blog />} />
            <Route path="/risk-disclosure" element={<RiskDisclosure />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          <FaqSupportBot />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </div>
);

export default App;
