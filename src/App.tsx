import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Payouts from "./pages/Payouts";
import KYC from "./pages/KYC";
import Referrals from "./pages/Referrals";
import Billing from "./pages/Billing";
import Pricing from "./pages/Pricing";
import HowItWorks from "./pages/HowItWorks";
import FAQ from "./pages/FAQ";
import PurchaseAccount from "./pages/PurchaseAccount";
import TradingPlatform from "./pages/TradingPlatform";
import NotFound from "./pages/NotFound";

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
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/dashboard/payouts" element={<Payouts />} />
            <Route path="/dashboard/kyc" element={<KYC />} />
            <Route path="/dashboard/referrals" element={<Referrals />} />
            <Route path="/dashboard/billing" element={<Billing />} />
            <Route path="/purchase" element={<PurchaseAccount />} />
            <Route path="/trade/:accountId" element={<TradingPlatform />} />
            <Route path="/pricing" element={<Pricing />} />
            <Route path="/how-it-works" element={<HowItWorks />} />
            <Route path="/faq" element={<FAQ />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </div>
);

export default App;
