import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  CircleDollarSign,
  Check,
  CreditCard,
  Clock3,
  RefreshCw,
  ShieldCheck,
  Users,
  UserRoundCheck,
  WalletCards,
  FileCheck2,
  ExternalLink,
  Gift,
  Award,
  Plus,
  Pencil,
  Trash2,
  XCircle,
  Archive,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useTradingViewPrices } from "@/hooks/useTradingViewPrices";
import { calculatePositionPL } from "@/lib/tradingCalculations";
import { cn } from "@/lib/utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type User = {
  id: string;
  email?: string;
  name: string | null;
  lastSignInAt: string | null;
  createdAt: string;
  isAffiliate: boolean;
  isAdmin: boolean;
};
type Account = {
  id: string;
  user_id: string;
  account_size: number;
  challenge_type: string;
  status: string;
  current_balance: number | null;
  profit_loss: number | null;
  current_phase: number | null;
  consistency_score: number | null;
  best_trading_day_profit: number | null;
  closed_profit_total: number | null;
  high_water_mark: number | null;
  daily_start_balance: number | null;
  daily_start_date: string | null;
  max_drawdown_percent: number | null;
  daily_drawdown_percent: number | null;
  drawdown_violated: boolean | null;
  violation_type: string | null;
  phase_passed: boolean | null;
  archived_at: string | null;
  archive_expires_at: string | null;
  updated_at: string;
  created_at: string;
};
type Asset = {
  symbol: string;
  pip_value?: number | null;
  asset_type: string;
  quote_currency?: string | null;
  lot_size?: number | null;
};
type Position = {
  id: string;
  account_id: string;
  asset_id: string;
  position_type: string;
  lot_size: number;
  profit_loss: number | null;
  status: string;
  opened_at: string;
  closed_at: string | null;
  entry_price: number;
  exit_price: number | null;
  stop_loss: number | null;
  take_profit: number | null;
  assets?: Asset;
};
type Referral = {
  referrer_id: string;
  referred_user_id: string;
  status: string;
  commission_earned: number;
  referred_at: string;
  account_purchased: boolean;
};
type AffiliateApplication = {
  id: string;
  user_id: string;
  desired_code: string;
  phone: string;
  country: string;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  x_handle: string | null;
  audience_size: string;
  promotion_channels: string;
  affiliate_experience: string | null;
  promotion_plan: string;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
};
type AffiliateCode = {
  id: string;
  user_id: string;
  code: string;
  discount_percent: number;
  is_active: boolean;
  created_at: string;
};
type History = {
  id: string;
  account_id: string;
  symbol: string;
  action: string;
  lot_size: number;
  profit_loss: number | null;
  created_at: string;
  price: number;
  notes: string | null;
};
type Payment = {
  id: string;
  user_id: string | null;
  account_id: string | null;
  provider: string;
  provider_reference: string;
  amount: number;
  currency: string;
  status: string;
  checkout_at: string;
  verified_at: string | null;
  webhook_at: string | null;
  failure_reason: string | null;
  refund_amount: number | null;
  refunded_at: string | null;
};
type Payout = {
  id: string;
  user_id: string;
  account_id: string | null;
  amount: number;
  method: string;
  destination: string;
  source: "trading_profit" | "referral_commission" | "manual_award";
  status: string;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  auditFlag?: "legacy_or_pre_funded" | null;
};
type AdminSection =
  | "traders"
  | "exposure"
  | "referrals"
  | "affiliates"
  | "activity"
  | "kyc"
  | "payments"
  | "payouts"
  | "coupons";
type Kyc = {
  id: string;
  user_id: string;
  identity_document_type: string | null;
  identity_document_path: string | null;
  identity_submitted_at: string | null;
  address_document_type: string | null;
  address_document_path: string | null;
  address_submitted_at: string | null;
  status: string;
  rejection_reason: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};
type KycDocument = {
  id: string;
  kyc_id: string;
  document_kind: "identity" | "address";
  document_type: string;
  storage_path: string;
  submitted_at: string;
};
type Snapshot = {
  users: User[];
  accounts: Account[];
  positions: Position[];
  referrals: Referral[];
  affiliateApplications: AffiliateApplication[];
  affiliateCodes: AffiliateCode[];
  history: History[];
  kyc: Kyc[];
  kycDocuments: KycDocument[];
  payments: Payment[];
  payouts: Payout[];
  coupons: Coupon[];
  generatedAt: string;
};
type GrantChallenge = "three_step" | "two_step" | "one_step" | "instant";
type Coupon = {
  id: string;
  code: string;
  discount_percent: number;
  challenge_types: GrantChallenge[] | null;
  is_active: boolean;
  expires_at: string | null;
  max_uses: number | null;
  times_used: number;
  created_at: string;
  updated_at: string;
};

const normalizeSnapshot = (data: Partial<Snapshot>): Snapshot => ({
  users: data.users ?? [],
  accounts: data.accounts ?? [],
  positions: data.positions ?? [],
  referrals: data.referrals ?? [],
  affiliateApplications: data.affiliateApplications ?? [],
  affiliateCodes: data.affiliateCodes ?? [],
  history: data.history ?? [],
  kyc: data.kyc ?? [],
  kycDocuments: data.kycDocuments ?? [],
  payments: data.payments ?? [],
  payouts: data.payouts ?? [],
  coupons: data.coupons ?? [],
  generatedAt: data.generatedAt ?? new Date().toISOString(),
});

const money = (value: number) =>
  `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const price = (value: number | null | undefined) =>
  value === null || value === undefined
    ? "-"
    : value >= 100
      ? value.toFixed(2)
      : value >= 1
        ? value.toFixed(3)
        : value >= 0.01
          ? value.toFixed(4)
          : value.toFixed(6);
const date = (value: string | null) =>
  value
    ? new Date(value).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Never";
const activeWindow = 15 * 60 * 1000;
const isPurchasedAccount = (account: Account) =>
  !["pending_payment", "failed"].includes(account.status);

export default function Admin({ section }: { section?: AdminSection }) {
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingAffiliate, setUpdatingAffiliate] = useState<string | null>(
    null,
  );
  const [reviewingKyc, setReviewingKyc] = useState<string | null>(null);
  const [rejectionReasons, setRejectionReasons] = useState<
    Record<string, string>
  >({});
  const [grantUserId, setGrantUserId] = useState("");
  const [grantChallenge, setGrantChallenge] =
    useState<GrantChallenge>("one_step");
  const [grantSize, setGrantSize] = useState("10000");
  const [grantingAccount, setGrantingAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [savingAccount, setSavingAccount] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<string | null>(null);
  const [resettingAccount, setResettingAccount] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState("");
  const [editUserId, setEditUserId] = useState("");
  const [editChallenge, setEditChallenge] =
    useState<GrantChallenge>("one_step");
  const [editSize, setEditSize] = useState("10000");
  const [editStatus, setEditStatus] = useState("active");
  const [editPhase, setEditPhase] = useState("1");
  const [editBalance, setEditBalance] = useState("0");
  const [editProfitLoss, setEditProfitLoss] = useState("0");
  const [closingPositionId, setClosingPositionId] = useState<string | null>(
    null,
  );
  const [bulkClosing, setBulkClosing] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState("10");
  const [couponTypes, setCouponTypes] = useState<GrantChallenge[]>([]);
  const [couponExpires, setCouponExpires] = useState("");
  const [couponMaxUses, setCouponMaxUses] = useState("");
  const [couponActive, setCouponActive] = useState(true);
  const [savingCoupon, setSavingCoupon] = useState(false);
  const [reviewingAffiliate, setReviewingAffiliate] = useState<string | null>(null);
  const [selectedAffiliateApplication, setSelectedAffiliateApplication] = useState<AffiliateApplication | null>(null);
  const [savingAffiliateCode, setSavingAffiliateCode] = useState<string | null>(null);
  const [affiliateCodeDrafts, setAffiliateCodeDrafts] = useState<Record<string, { discount: string; isActive: boolean }>>({});
  const [reviewingPayout, setReviewingPayout] = useState<string | null>(null);
  const [selectedPayout, setSelectedPayout] = useState<Payout | null>(null);
  const [payoutRejectionReason, setPayoutRejectionReason] = useState("");
  const [manualAwardOpen, setManualAwardOpen] = useState(false);
  const [manualAwardUserId, setManualAwardUserId] = useState("");
  const [manualAwardChallenge, setManualAwardChallenge] = useState<GrantChallenge>("instant");
  const [manualAwardSize, setManualAwardSize] = useState("10000");
  const [manualAwardAmount, setManualAwardAmount] = useState("");
  const [manualAwardDate, setManualAwardDate] = useState(new Date().toISOString().slice(0, 10));
  const [manualAwardMethod, setManualAwardMethod] = useState("bank_transfer");
  const [manualAwardDestination, setManualAwardDestination] = useState("");
  const [awardingPayout, setAwardingPayout] = useState(false);

  const loadSnapshot = async (background = false) => {
    if (!background) setLoading(true);
    setError("");
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      navigate("/login");
      return;
    }
    if (session.user.app_metadata?.role !== "admin") {
      navigate("/dashboard", { replace: true });
      return;
    }
    const [{ data, error: invokeError }, { data: couponData, error: couponError }] =
      await Promise.all([
        supabase.functions.invoke("admin-snapshot"),
        supabase
          .from("coupons")
          .select("id, code, discount_percent, challenge_types, is_active, expires_at, max_uses, times_used, created_at, updated_at")
          .order("created_at", { ascending: false }),
      ]);
    if (invokeError) {
      setError("The admin snapshot could not be loaded.");
    } else {
      const snapshotData = normalizeSnapshot(data as Partial<Snapshot>);
      setSnapshot({
        ...snapshotData,
        coupons: couponError ? snapshotData.coupons : (couponData as Coupon[]),
      });
      if (couponError) setError("Purchase coupons could not be loaded.");
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadSnapshot();

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadSnapshot(true);
    };
    const refreshInterval = window.setInterval(refreshWhenVisible, 5000);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, []);

  const updateAffiliateStatus = async (user: User) => {
    setUpdatingAffiliate(user.id);
    const { error: updateError } = await supabase.functions.invoke(
      "admin-affiliate",
      {
        body: { userId: user.id, affiliate: !user.isAffiliate },
      },
    );
    if (updateError) {
      setError("The affiliate status could not be updated.");
    } else {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              users: current.users.map((candidate) =>
                candidate.id === user.id
                  ? { ...candidate, isAffiliate: !user.isAffiliate }
                  : candidate,
              ),
            }
          : current,
      );
    }
    setUpdatingAffiliate(null);
  };

  const reviewAffiliateApplication = async (application: AffiliateApplication, status: "approved" | "rejected") => {
    setReviewingAffiliate(application.id);
    setError("");
    const { error: reviewError } = await supabase.functions.invoke("admin-affiliate", {
      body: { action: "review", applicationId: application.id, status },
    });
    if (reviewError) {
      setError(reviewError.message || "The affiliate application could not be reviewed.");
    } else {
      setSnapshot((current) => current ? {
        ...current,
        affiliateApplications: current.affiliateApplications.map((candidate) => candidate.id === application.id ? { ...candidate, status } : candidate),
        users: status === "approved" ? current.users.map((user) => user.id === application.user_id ? { ...user, isAffiliate: true } : user) : current.users,
      } : current);
    }
    setReviewingAffiliate(null);
    if (selectedAffiliateApplication?.id === application.id) setSelectedAffiliateApplication(null);
  };

  const updateAffiliateCode = async (affiliateCode: AffiliateCode) => {
    const draft = affiliateCodeDrafts[affiliateCode.id] ?? { discount: String(affiliateCode.discount_percent), isActive: affiliateCode.is_active };
    const discountPercent = Number(draft.discount);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
      setError("Affiliate discounts must be between 0 and 100 percent.");
      return;
    }
    setSavingAffiliateCode(affiliateCode.id);
    const { data, error: updateError } = await supabase.functions.invoke("admin-affiliate", {
      body: { action: "update-code", userId: affiliateCode.user_id, code: affiliateCode.code, discountPercent, isActive: draft.isActive },
    });
    if (updateError || !data?.affiliateCode) {
      setError(updateError?.message || "The affiliate code could not be updated.");
    } else {
      setSnapshot((current) => current ? { ...current, affiliateCodes: current.affiliateCodes.map((candidate) => candidate.id === affiliateCode.id ? data.affiliateCode : candidate) } : current);
      setAffiliateCodeDrafts((current) => ({ ...current, [affiliateCode.id]: { discount: String(data.affiliateCode.discount_percent), isActive: data.affiliateCode.is_active } }));
    }
    setSavingAffiliateCode(null);
  };

  const grantAccount = async () => {
    if (!grantUserId) {
      setError("Select a trader to receive the account.");
      return;
    }
    setGrantingAccount(true);
    setError("");
    const { data, error: grantError } = await supabase.functions.invoke(
      "admin-account",
      {
        body: {
          userId: grantUserId,
          challengeType: grantChallenge,
          accountSize: Number(grantSize),
        },
      },
    );
    if (grantError || !data?.account) {
      setError(grantError?.message || "The account could not be granted.");
    } else {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              accounts: [...current.accounts, data.account as Account],
            }
          : current,
      );
    }
    setGrantingAccount(false);
  };

  const startEditingAccount = (account: Account) => {
    setEditingAccount(account);
    setEditUserId(account.user_id);
    setEditChallenge(account.challenge_type as GrantChallenge);
    setEditSize(String(account.account_size));
    setEditStatus(account.status);
    setEditPhase(
      account.current_phase === null ? "none" : String(account.current_phase),
    );
    setEditBalance(String(account.current_balance ?? 0));
    setEditProfitLoss(String(account.profit_loss ?? 0));
  };

  const updateAccount = async () => {
    if (!editingAccount || !editUserId) return;
    setSavingAccount(true);
    setError("");
    const { data, error: updateError } = await supabase.functions.invoke(
      "admin-account",
      {
        body: {
          action: "update",
          accountId: editingAccount.id,
          userId: editUserId,
          challengeType: editChallenge,
          accountSize: Number(editSize),
          status: editStatus,
          currentPhase: editPhase === "none" ? null : Number(editPhase),
          currentBalance: Number(editBalance),
          profitLoss: Number(editProfitLoss),
        },
      },
    );
    if (updateError || !data?.account)
      setError(updateError?.message || "The account could not be updated.");
    else {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              accounts: current.accounts.map((account) =>
                account.id === editingAccount.id
                  ? (data.account as Account)
                  : account,
              ),
            }
          : current,
      );
      setEditingAccount(null);
    }
    setSavingAccount(false);
  };

  const deleteAccount = async (account: Account) => {
    if (
      !window.confirm(
        `Archive account ${account.id.slice(0, 8)}? It can be restored by an admin for 30 days.`,
      )
    )
      return;
    setDeletingAccount(account.id);
    setError("");
    const { data, error: deleteError } = await supabase.functions.invoke(
      "admin-account",
      {
        body: {
          action: "delete",
          accountId: account.id,
          userId: account.user_id,
        },
      },
    );
    if (deleteError || !data?.deleted)
      setError(deleteError?.message || "The account could not be archived.");
    else {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              accounts: current.accounts.filter(
                (candidate) => candidate.id !== account.id,
              ),
            }
          : current,
      );
      if (editingAccount?.id === account.id) setEditingAccount(null);
    }
    setDeletingAccount(null);
  };

  const restoreAccount = async (account: Account) => {
    setDeletingAccount(account.id);
    setError("");
    const { data, error: restoreError } = await supabase.functions.invoke(
      "admin-account",
      { body: { action: "restore", accountId: account.id, userId: account.user_id } },
    );
    if (restoreError || !data?.restored) {
      setError(restoreError?.message || "The account could not be restored.");
    } else {
      setSnapshot((current) => current ? {
        ...current,
        accounts: current.accounts.map((candidate) =>
          candidate.id === account.id
            ? { ...candidate, archived_at: null, archive_expires_at: null }
            : candidate,
        ),
      } : current);
    }
    setDeletingAccount(null);
  };

  const deleteTrader = async () => {
    const user = snapshot?.users.find(
      (candidate) => candidate.id === deleteUserId,
    );
    if (!user) {
      setError("Select a trader to delete.");
      return;
    }
    if (
      !window.confirm(
        `Archive all accounts for ${user.email || user.name || "this trader"}? They can be restored by an admin for 30 days.`,
      )
    )
      return;
    setDeletingUser(true);
    setError("");
    const { data, error: deleteError } = await supabase.functions.invoke(
      "admin-account",
      {
        body: { action: "delete-user", userId: user.id },
      },
    );
    if (deleteError || !data?.archived)
      setError(deleteError?.message || "The trader accounts could not be archived.");
    else {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              users: current.users.filter(
                (candidate) => candidate.id !== user.id,
              ),
            }
          : current,
      );
      setDeleteUserId("");
    }
    setDeletingUser(false);
  };

  const resetAccount = async (account: Account) => {
    if (
      !window.confirm(
        `Reset account ${account.id.slice(0, 8)}? This will close and permanently clear all positions, trade history, analytics, rule progress, and account alerts.`,
      )
    )
      return;
    setResettingAccount(account.id);
    setError("");
    const { data, error: resetError } = await supabase.functions.invoke(
      "admin-account",
      {
        body: {
          action: "reset",
          accountId: account.id,
          userId: account.user_id,
        },
      },
    );
    if (resetError || !data?.account)
      setError(resetError?.message || "The account could not be reset.");
    else {
      setSnapshot((current) =>
        current
          ? {
              ...current,
              accounts: current.accounts.map((candidate) =>
                candidate.id === account.id
                  ? (data.account as Account)
                  : candidate,
              ),
              positions: current.positions.filter(
                (position) => position.account_id !== account.id,
              ),
              history: current.history.filter(
                (trade) => trade.account_id !== account.id,
              ),
            }
          : current,
      );
    }
    setResettingAccount(null);
  };

  const resetCouponForm = () => {
    setEditingCoupon(null);
    setCouponCode("");
    setCouponDiscount("10");
    setCouponTypes([]);
    setCouponExpires("");
    setCouponMaxUses("");
    setCouponActive(true);
  };

  const startEditingCoupon = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCouponCode(coupon.code);
    setCouponDiscount(String(coupon.discount_percent));
    setCouponTypes(coupon.challenge_types ?? []);
    setCouponExpires(coupon.expires_at ? coupon.expires_at.slice(0, 10) : "");
    setCouponMaxUses(coupon.max_uses === null ? "" : String(coupon.max_uses));
    setCouponActive(coupon.is_active);
  };

  const saveCoupon = async () => {
    setSavingCoupon(true);
    setError("");
    const { data, error: saveError } = await supabase.functions.invoke("admin-coupon", {
      body: {
        action: editingCoupon ? "update" : "create",
        id: editingCoupon?.id,
        code: couponCode,
        discountPercent: Number(couponDiscount),
        challengeTypes: couponTypes.length ? couponTypes : null,
        expiresAt: couponExpires ? `${couponExpires}T23:59:59.000Z` : null,
        maxUses: couponMaxUses,
        isActive: couponActive,
      },
    });
    if (saveError || !data?.coupon) {
      setError(saveError?.message || "The coupon could not be saved.");
    } else {
      const coupon = data.coupon as Coupon;
      setSnapshot((current) => current ? {
        ...current,
        coupons: editingCoupon
          ? current.coupons.map((item) => item.id === coupon.id ? coupon : item)
          : [coupon, ...current.coupons],
      } : current);
      resetCouponForm();
    }
    setSavingCoupon(false);
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`Delete coupon ${coupon.code}? This cannot be undone.`)) return;
    setError("");
    const { data, error: deleteError } = await supabase.functions.invoke("admin-coupon", {
      body: { action: "delete", id: coupon.id },
    });
    if (deleteError || !data?.deleted) {
      setError(deleteError?.message || "The coupon could not be deleted.");
    } else {
      setSnapshot((current) => current ? {
        ...current,
        coupons: current.coupons.filter((item) => item.id !== coupon.id),
      } : current);
      if (editingCoupon?.id === coupon.id) resetCouponForm();
    }
  };

  const reviewKyc = async (
    application: Kyc,
    status: "approved" | "rejected",
  ) => {
    const reason = rejectionReasons[application.id]?.trim() || "";
    if (status === "rejected" && !reason) {
      setError("A rejection reason is required.");
      return;
    }
    setReviewingKyc(application.id);
    const { data, error: reviewError } = await supabase.rpc("review_kyc", {
      p_kyc_id: application.id,
      p_status: status,
      p_rejection_reason: reason || null,
    });
    if (reviewError) setError(reviewError.message);
    else
      setSnapshot((current) =>
        current
          ? {
              ...current,
              kyc: current.kyc.map((item) =>
                item.id === application.id ? data : item,
              ),
            }
          : current,
      );
    setReviewingKyc(null);
  };

  const reviewPayout = async (payout: Payout, status: "approved" | "rejected", rejectionReason = "") => {
    if (status === "rejected" && rejectionReason.trim().length < 3) {
      setError("A rejection reason is required before declining a payout.");
      return;
    }
    setReviewingPayout(payout.id);
    setError("");
    const { data, error: reviewError } = await supabase.functions.invoke("admin-payout", {
      body: { payoutId: payout.id, status, rejectionReason: rejectionReason.trim() },
    });
    if (reviewError || !data?.payout) {
      setError(reviewError?.message || "The payout request could not be reviewed.");
    } else {
      setSnapshot((current) => current ? {
        ...current,
        payouts: current.payouts.map((item) => item.id === payout.id ? { ...item, status, rejection_reason: data.payout.rejection_reason ?? null, updated_at: data.payout.updated_at, reviewed_by: data.payout.reviewed_by, reviewed_at: data.payout.reviewed_at } : item),
      } : current);
      setSelectedPayout(null);
      setPayoutRejectionReason("");
    }
    setReviewingPayout(null);
  };

  const awardManualPayout = async () => {
    if (!manualAwardUserId || !manualAwardAmount || !manualAwardDate || !manualAwardDestination.trim()) {
      setError("Select a trader and provide the payout date, payout amount, and destination.");
      return;
    }
    setAwardingPayout(true);
    setError("");
    const { data, error: awardError } = await supabase.functions.invoke("admin-award-payout", {
      body: {
        userId: manualAwardUserId,
        accountSize: Number(manualAwardSize),
        challengeType: manualAwardChallenge,
        amount: Number(manualAwardAmount),
        payoutDate: new Date(`${manualAwardDate}T12:00:00`).toISOString(),
        method: manualAwardMethod,
        destination: manualAwardDestination,
      },
    });
    if (awardError || !data?.payout) {
      setError(data?.error || awardError?.message || "The manual payout could not be awarded.");
    } else {
      setSnapshot((current) => current ? { ...current, payouts: [data.payout as Payout, ...current.payouts] } : current);
      setManualAwardOpen(false);
      setManualAwardAmount("");
      setManualAwardDestination("");
    }
    setAwardingPayout(false);
  };

  const previewDocument = async (path: string | null) => {
    if (!path) return;
    const { data, error: previewError } = await supabase.functions.invoke(
      "admin-kyc-document",
      { body: { path } },
    );
    if (previewError || !data?.signedUrl) {
      setError("The document preview could not be created.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const closePositions = async (positions: Position[], label: string) => {
    if (
      !positions.length ||
      !window.confirm(
        `Close ${positions.length} open position${positions.length === 1 ? "" : "s"} for ${label}?`,
      )
    )
      return;
    setBulkClosing(true);
    setError("");
    const results = await Promise.all(
      positions.map(async (position) => {
        const asset = position.assets;
        const price = asset ? prices[asset.symbol] : undefined;
        const exitPrice = price
          ? position.position_type.toLowerCase() === "buy"
            ? price.bid
            : price.ask
          : null;
        if (!exitPrice)
          return {
            error: `${asset?.symbol || position.id}: live price unavailable`,
          };
        const { error: closeError } = await supabase.rpc("close_trade", {
          p_account_id: position.account_id,
          p_position_id: position.id,
          p_exit_price: exitPrice,
        });
        return closeError
          ? { error: `${asset?.symbol || position.id}: ${closeError.message}` }
          : { error: null };
      }),
    );
    const failures = results.filter((result): result is { error: string } =>
      Boolean(result.error),
    );
    if (failures.length)
      setError(
        `${failures.length} position${failures.length === 1 ? "" : "s"} could not be closed: ${failures.map((failure) => failure.error).join("; ")}`,
      );
    await loadSnapshot();
    setBulkClosing(false);
  };

  const closeOnePosition = async (position: Position) => {
    setClosingPositionId(position.id);
    await closePositions([position], "this trader");
    setClosingPositionId(null);
  };

  const purchasedAccounts = (snapshot?.accounts ?? []).filter(
    isPurchasedAccount,
  );
  const failedAccounts = (snapshot?.accounts ?? []).filter(
    (account) => account.status === "failed" && !account.archived_at,
  );
  const archivedAccounts = (snapshot?.accounts ?? []).filter(
    (account) => Boolean(account.archived_at),
  );
  const userMap = useMemo(
    () => new Map((snapshot?.users ?? []).map((user) => [user.id, user])),
    [snapshot],
  );
  const sortedUsers = useMemo(
    () =>
      [...(snapshot?.users ?? [])].sort((firstUser, secondUser) =>
        (firstUser.name || firstUser.email || "").localeCompare(
          secondUser.name || secondUser.email || "",
        ),
      ),
    [snapshot],
  );
  const accountMap = useMemo(
    () => new Map(purchasedAccounts.map((account) => [account.id, account])),
    [purchasedAccounts],
  );
  const activeUsers = (snapshot?.users ?? []).filter(
    (user) =>
      user.lastSignInAt &&
      Date.now() - new Date(user.lastSignInAt).getTime() < activeWindow,
  );
  const activeAccounts = purchasedAccounts.filter((account) =>
    ["active", "funded"].includes(account.status),
  );
  const totalPL = purchasedAccounts.reduce(
    (total, account) => total + (account.profit_loss ?? 0),
    0,
  );
  const openPositions = (snapshot?.positions ?? []).filter(
    (position) => position.status === "open",
  );
  const recentHistory = (snapshot?.history ?? []).slice(0, 12);
  const symbols = useMemo(
    () => [
      ...new Set(
        openPositions
          .map((position) => position.assets?.symbol)
          .filter((symbol): symbol is string => Boolean(symbol)),
      ),
    ],
    [openPositions],
  );
  const { prices, isConnected } = useTradingViewPrices(symbols);
  const floatingPL = (position: Position) => {
    const asset = position.assets;
    const price = asset ? prices[asset.symbol] : undefined;
    if (!asset || !price) return null;
    const currentPrice =
      position.position_type.toLowerCase() === "buy" ? price.bid : price.ask;
    return calculatePositionPL(
      asset,
      position.position_type.toLowerCase() as "buy" | "sell",
      position.entry_price,
      currentPrice,
      position.lot_size,
    ).profitLoss;
  };
  const traderGroups = useMemo(
    () =>
      (snapshot?.users ?? [])
        .map((user) => {
          const accounts = (snapshot?.accounts ?? []).filter(
            (account) => account.user_id === user.id,
          );
          const accountIds = new Set(accounts.map((account) => account.id));
          const positions = openPositions.filter((position) =>
            accountIds.has(position.account_id),
          );
          const history = recentHistory.filter((trade) =>
            accountIds.has(trade.account_id),
          );
          return {
            user,
            accounts,
            positions,
            history,
            accountPL: accounts.reduce(
              (sum, account) => sum + (account.profit_loss ?? 0),
              0,
            ),
          };
        })
        .filter(
          ({ accounts, positions, history }) =>
            accounts.length > 0 || positions.length > 0 || history.length > 0,
        ),
    [snapshot, openPositions, recentHistory],
  );

  const pageTitle =
    section === "traders"
      ? "Traders"
      : section === "exposure"
        ? "Trading exposure"
        : section === "referrals"
          ? "Referral analytics"
          : section === "affiliates"
            ? "Affiliate partners"
            : section === "activity"
              ? "Trade activity"
              : section === "kyc"
                ? "KYC review"
                : section === "payments"
                  ? "Payment reconciliation"
                  : section === "payouts"
                    ? "Payout requests"
                    : section === "coupons"
                      ? "Purchase coupons"
                      : "Platform overview";

  const statCards = [
    {
      label: "Registered traders",
      value: snapshot?.users.length ?? 0,
      detail: `${activeUsers.length} signed in within 15 min`,
      icon: Users,
    },
    {
      label: "Active accounts",
      value: activeAccounts.length,
      detail: `${purchasedAccounts.length} purchased accounts`,
      icon: WalletCards,
    },
    {
      label: "Platform P/L",
      value: money(totalPL),
      detail: `${openPositions.length} open positions`,
      icon: CircleDollarSign,
      accent: totalPL >= 0,
    },
    {
      label: "Referrals",
      value: snapshot?.referrals.length ?? 0,
      detail: `${snapshot?.referrals.filter((referral) => referral.account_purchased).length ?? 0} converted`,
      icon: Activity,
    },
  ];

  return (
    <DashboardLayout
      title={pageTitle}
      subtitle="Live platform oversight and trader activity"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2 text-primary">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                Private workspace
              </span>
            </div>
            <h2 className="text-3xl font-serif font-bold">
              {section ? pageTitle : "Platform pulse"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Trader activity, exposure, performance, and referral flow in one
              view.
            </p>
          </div>
          <Button
            className="shrink-0"
            variant="outline"
            onClick={() => void loadSnapshot()}
            disabled={loading}
          >
            <RefreshCw
              className={cn("mr-2 h-4 w-4", loading && "animate-spin")}
            />
            Refresh data
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/40">
            <CardContent className="p-4 text-sm text-destructive">
              {error}
            </CardContent>
          </Card>
        )}
        {loading && !snapshot ? (
          <div className="py-16 text-center text-muted-foreground">
            Loading private platform data...
          </div>
        ) : (
          snapshot && (
            <>
              {!section && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {statCards.map(
                    ({ label, value, detail, icon: Icon, accent }) => (
                      <Card key={label} variant="elevated">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {label}
                              </p>
                              <p
                                className={cn(
                                  "mt-2 text-3xl font-bold",
                                  accent === false && "text-destructive",
                                  accent === true && "text-success",
                                )}
                              >
                                {value}
                              </p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {detail}
                              </p>
                            </div>
                            <div className="rounded-lg bg-primary/10 p-2 text-primary">
                              <Icon className="h-5 w-5" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ),
                  )}
                </div>
              )}

              {(!section || section === "traders") &&
                failedAccounts.length > 0 && (
                  <Card className="border-destructive/40">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between gap-3 text-xl">
                        <span className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-destructive" />
                          Failed accounts
                        </span>
                        <Badge variant="destructive">
                          {failedAccounts.length}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Reset a failed account for the trader to start over, or
                        remove it from their account list.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {failedAccounts.map((account) => {
                        const user = userMap.get(account.user_id);
                        const isBusy =
                          resettingAccount === account.id ||
                          deletingAccount === account.id;
                        return (
                          <div
                            key={account.id}
                            className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between"
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium">
                                  {user?.name ||
                                    user?.email ||
                                    "Unnamed trader"}
                                </p>
                                <Badge variant="destructive">Failed</Badge>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {user?.email && user.name
                                  ? `${user.email} · `
                                  : ""}
                                ${account.challenge_type.replace("_", " ")} · $
                                {money(account.account_size)} · Failed{" "}
                                {date(account.updated_at)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void resetAccount(account)}
                                disabled={isBusy}
                              >
                                {resettingAccount === account.id ? (
                                  "Resetting..."
                                ) : (
                                  <>
                                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                                    Reset account
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => void deleteAccount(account)}
                                disabled={isBusy}
                              >
                                {deletingAccount === account.id ? (
                                  "Deleting..."
                                ) : (
                                  <>
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    Archive account
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}

              {(!section || section === "traders") && archivedAccounts.length > 0 && (
                <Card className="border-amber-500/40">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between gap-3 text-xl">
                      <span className="flex items-center gap-2">
                        <Archive className="h-5 w-5 text-amber-600" />
                        Archived accounts
                      </span>
                      <Badge variant="outline">{archivedAccounts.length}</Badge>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Archived accounts are hidden from traders and permanently removed after 30 days.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {archivedAccounts.map((account) => {
                      const user = userMap.get(account.user_id);
                      return (
                        <div key={account.id} className="flex flex-col gap-4 rounded-lg border border-border p-4 md:flex-row md:items-center md:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium">{user?.name || user?.email || "Unnamed trader"}</p>
                              <Badge variant="outline">Archived</Badge>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {account.challenge_type.replace("_", " ")} · ${money(account.account_size)} ·
                              {account.archive_expires_at ? ` permanently deleted ${date(account.archive_expires_at)}` : " pending deletion"}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => void restoreAccount(account)} disabled={deletingAccount === account.id}>
                            <RefreshCw className="mr-2 h-3.5 w-3.5" />
                            {deletingAccount === account.id ? "Restoring..." : "Restore account"}
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              )}

              {(!section || section === "traders") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Gift className="h-5 w-5 text-primary" />
                      Grant a trading account
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Create a complimentary account with no payment required.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_auto] md:items-end">
                      <div className="space-y-2">
                        <Label htmlFor="grant-user">Trader</Label>
                        <Select
                          value={grantUserId}
                          onValueChange={setGrantUserId}
                        >
                          <SelectTrigger id="grant-user">
                            <SelectValue placeholder="Choose a trader" />
                          </SelectTrigger>
                          <SelectContent>
                            {sortedUsers
                              .filter((user) => !user.isAdmin)
                              .map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name || user.email || "Unnamed trader"}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Challenge</Label>
                        <Select
                          value={grantChallenge}
                          onValueChange={(value) =>
                            setGrantChallenge(value as GrantChallenge)
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="three_step">
                              3-Step Challenge
                            </SelectItem>
                            <SelectItem value="two_step">
                              2-Step Challenge
                            </SelectItem>
                            <SelectItem value="one_step">
                              1-Step Challenge
                            </SelectItem>
                            <SelectItem value="instant">
                              Instant Funding
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Account size</Label>
                        <Select value={grantSize} onValueChange={setGrantSize}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {[5000, 10000, 25000, 50000, 100000, 200000].map(
                              (size) => (
                                <SelectItem key={size} value={String(size)}>
                                  ${size.toLocaleString()}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="gold"
                        onClick={() => void grantAccount()}
                        disabled={
                          grantingAccount ||
                          !snapshot.users.some((user) => !user.isAdmin)
                        }
                      >
                        {grantingAccount ? "Granting..." : "Grant account"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!section || section === "traders") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Pencil className="h-5 w-5 text-primary" />
                      Manage user accounts
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Reassign accounts and update their trading state, balance,
                      or performance.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {editingAccount && (
                      <div className="grid gap-4 rounded-lg border border-primary/30 bg-primary/5 p-4 md:grid-cols-2 xl:grid-cols-4">
                        <div className="space-y-2 md:col-span-2">
                          <Label>Account owner</Label>
                          <Select
                            value={editUserId}
                            onValueChange={setEditUserId}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {sortedUsers
                                .filter((user) => !user.isAdmin)
                                .map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name ||
                                      user.email ||
                                      "Unnamed trader"}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Challenge</Label>
                          <Select
                            value={editChallenge}
                            onValueChange={(value) =>
                              setEditChallenge(value as GrantChallenge)
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="three_step">
                                3-Step Challenge
                              </SelectItem>
                              <SelectItem value="two_step">
                                2-Step Challenge
                              </SelectItem>
                              <SelectItem value="one_step">
                                1-Step Challenge
                              </SelectItem>
                              <SelectItem value="instant">
                                Instant Funding
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Account size</Label>
                          <Select value={editSize} onValueChange={setEditSize}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[5000, 10000, 25000, 50000, 100000, 200000].map(
                                (size) => (
                                  <SelectItem key={size} value={String(size)}>
                                    ${size.toLocaleString()}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <Select
                            value={editStatus}
                            onValueChange={setEditStatus}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[
                                "pending_payment",
                                "active",
                                "failed",
                                "passed",
                                "funded",
                              ].map((status) => (
                                <SelectItem key={status} value={status}>
                                  {status.replace("_", " ")}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Phase</Label>
                          <Select
                            value={editPhase}
                            onValueChange={setEditPhase}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Phase 1</SelectItem>
                              <SelectItem value="2">Phase 2</SelectItem>
                              <SelectItem value="3">Phase 3</SelectItem>
                              <SelectItem value="none">No phase</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-balance">Balance</Label>
                          <Input
                            id="edit-balance"
                            type="number"
                            value={editBalance}
                            onChange={(event) =>
                              setEditBalance(event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-profit-loss">
                            Profit / loss
                          </Label>
                          <Input
                            id="edit-profit-loss"
                            type="number"
                            value={editProfitLoss}
                            onChange={(event) =>
                              setEditProfitLoss(event.target.value)
                            }
                          />
                        </div>
                        <div className="flex items-end gap-2">
                          <Button
                            variant="gold"
                            onClick={() => void updateAccount()}
                            disabled={savingAccount}
                          >
                            {savingAccount ? "Saving..." : "Save changes"}
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setEditingAccount(null)}
                            disabled={savingAccount}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    <div className="overflow-x-auto">
                      <table className="min-w-[40rem] w-full text-left text-sm">
                        <thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-4 py-3">Owner</th>
                            <th className="px-4 py-3">Account</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Balance</th>
                            <th className="px-4 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...snapshot.accounts]
                            .sort((firstAccount, secondAccount) =>
                              (
                                userMap.get(firstAccount.user_id)?.name ||
                                userMap.get(firstAccount.user_id)?.email ||
                                ""
                              ).localeCompare(
                                userMap.get(secondAccount.user_id)?.name ||
                                  userMap.get(secondAccount.user_id)?.email ||
                                  "",
                              ),
                            )
                            .map((account) => (
                            <tr
                              key={account.id}
                              className="border-b border-border/60 last:border-0"
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium">
                                  {userMap.get(account.user_id)?.name ||
                                    "Unnamed trader"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {userMap.get(account.user_id)?.email ||
                                    account.user_id.slice(0, 8)}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  ${account.account_size.toLocaleString()} ·{" "}
                                  {account.challenge_type.replace("_", " ")}
                                </div>
                                <div className="font-mono text-[10px] text-muted-foreground">
                                  {account.id.slice(0, 8)}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    account.status === "failed"
                                      ? "destructive"
                                      : "outline"
                                  }
                                >
                                  {account.status.replace("_", " ")}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {money(account.current_balance ?? 0)}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => startEditingAccount(account)}
                                >
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  Edit
                                </Button>
                              </td>
                            </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {snapshot.accounts.length === 0 && (
                      <p className="text-sm text-muted-foreground">
                        No accounts have been created.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {(!section || section === "coupons") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Gift className="h-5 w-5 text-primary" />
                      {editingCoupon ? "Edit purchase coupon" : "Add purchase coupon"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Leave account types unchecked to make the coupon valid for every purchase.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-2">
                        <Label htmlFor="coupon-code">Code</Label>
                        <Input id="coupon-code" value={couponCode} onChange={(event) => setCouponCode(event.target.value.toUpperCase())} placeholder="WELCOME25" maxLength={32} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="coupon-discount">Discount percent</Label>
                        <Input id="coupon-discount" type="number" min="1" max="100" value={couponDiscount} onChange={(event) => setCouponDiscount(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="coupon-expires">Expires on</Label>
                        <Input id="coupon-expires" type="date" value={couponExpires} onChange={(event) => setCouponExpires(event.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="coupon-max-uses">Maximum uses</Label>
                        <Input id="coupon-max-uses" type="number" min="1" value={couponMaxUses} onChange={(event) => setCouponMaxUses(event.target.value)} placeholder="Unlimited" />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label>Account types</Label>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {([
                          ["three_step", "3-Step Challenge"],
                          ["two_step", "2-Step Challenge"],
                          ["one_step", "1-Step Challenge"],
                          ["instant", "Instant Funding"],
                        ] as const).map(([value, label]) => (
                          <label key={value} className="flex items-center gap-2 text-sm">
                            <Checkbox checked={couponTypes.includes(value)} onCheckedChange={(checked) => setCouponTypes((current) => checked ? [...current, value] : current.filter((item) => item !== value))} />
                            {label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={couponActive} onCheckedChange={(checked) => setCouponActive(checked === true)} />
                        Active and available at checkout
                      </label>
                      <div className="flex gap-2">
                        {editingCoupon && <Button variant="ghost" onClick={resetCouponForm}>Cancel</Button>}
                        <Button variant="gold" onClick={() => void saveCoupon()} disabled={savingCoupon || !couponCode.trim()}>
                          {savingCoupon ? "Saving..." : editingCoupon ? "Save changes" : <><Plus className="mr-2 h-4 w-4" />Add coupon</>}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!section || section === "coupons") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">All purchase coupons</CardTitle>
                    <p className="text-sm text-muted-foreground">Manage availability, scope, limits, and expiry for every coupon.</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-[40rem] w-full text-left text-sm">
                        <thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground">
                          <tr><th className="px-6 py-3">Code</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Account types</th><th className="px-4 py-3">Usage</th><th className="px-4 py-3">Status</th><th className="px-6 py-3">Actions</th></tr>
                        </thead>
                        <tbody>
                          {snapshot.coupons.map((coupon) => (
                            <tr key={coupon.id} className="border-b border-border/60 last:border-0">
                              <td className="px-6 py-4 font-mono font-semibold">{coupon.code}</td>
                              <td className="px-4 py-4">{Number(coupon.discount_percent)}%</td>
                              <td className="px-4 py-4 text-xs">{coupon.challenge_types?.length ? coupon.challenge_types.map((type) => type.replace("_", " ")).join(", ") : "All account types"}</td>
                              <td className="px-4 py-4 text-xs">{coupon.times_used}{coupon.max_uses === null ? "" : ` / ${coupon.max_uses}`}</td>
                              <td className="px-4 py-4"><Badge variant={coupon.is_active ? "default" : "outline"}>{coupon.is_active ? "Active" : "Inactive"}</Badge></td>
                              <td className="px-6 py-4"><div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => startEditingCoupon(coupon)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button size="sm" variant="destructive" onClick={() => void deleteCoupon(coupon)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {snapshot.coupons.length === 0 && <p className="p-6 text-sm text-muted-foreground">No purchase coupons have been created.</p>}
                  </CardContent>
                </Card>
              )}

              {(!section || section === "payments") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <CreditCard className="h-5 w-5 text-primary" />
                      Payment reconciliation
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Review provider callbacks that need investigation or did
                      not match a checkout order.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-[40rem] w-full text-left text-sm">
                        <thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-6 py-3">Reference</th>
                            <th className="px-4 py-3">Owner</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Checkout</th>
                            <th className="px-6 py-3">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapshot.payments
                            .filter((payment) =>
                              ["unmatched", "failed", "refunded"].includes(
                                payment.status,
                              ),
                            )
                            .map((payment) => (
                              <tr
                                key={payment.id}
                                className="border-b border-border/60 last:border-0"
                              >
                                <td className="px-6 py-4 font-mono text-xs">
                                  {payment.provider_reference}
                                </td>
                                <td className="px-4 py-4 text-xs">
                                  {payment.user_id
                                    ? userMap.get(payment.user_id)?.email ||
                                      payment.user_id.slice(0, 8)
                                    : "Unknown"}
                                </td>
                                <td className="px-4 py-4 font-medium">
                                  {payment.currency}{" "}
                                  {Number(payment.amount).toLocaleString()}
                                </td>
                                <td className="px-4 py-4">
                                  <Badge
                                    variant={
                                      payment.status === "failed"
                                        ? "destructive"
                                        : "outline"
                                    }
                                  >
                                    {payment.status}
                                  </Badge>
                                </td>
                                <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">
                                  {date(payment.checkout_at)}
                                </td>
                                <td className="max-w-xs px-6 py-4 text-xs text-muted-foreground">
                                  {payment.failure_reason ||
                                    "Provider event requires review"}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                    {snapshot.payments.filter((payment) =>
                      ["unmatched", "failed", "refunded"].includes(
                        payment.status,
                      ),
                    ).length === 0 && (
                      <p className="p-6 text-sm text-muted-foreground">
                        No unmatched, failed, or refunded payments.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {(!section || section === "payouts") && (
                <Card>
                  <CardHeader>
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                      <div>
                        <CardTitle className="flex items-center gap-2 text-xl">
                          <WalletCards className="h-5 w-5 text-primary" />
                          Payout requests
                        </CardTitle>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Review withdrawals or issue a payout certificate manually.
                        </p>
                      </div>
                      <Button variant="gold" onClick={() => setManualAwardOpen(true)}>
                        <Award className="mr-2 h-4 w-4" />Award payout
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-[40rem] w-full text-left text-sm">
                        <thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-6 py-3">Owner</th>
                            <th className="px-4 py-3">Source</th>
                            <th className="px-4 py-3">Amount</th>
                            <th className="px-4 py-3">Method</th>
                            <th className="px-4 py-3">Destination</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Submitted</th>
                            <th className="px-6 py-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {snapshot.payouts.map((payout) => (
                            <tr key={payout.id} className="border-b border-border/60 last:border-0">
                              <td className="px-6 py-4 text-xs">
                                {userMap.get(payout.user_id)?.email || payout.user_id.slice(0, 8)}
                              </td>
                              <td className="px-4 py-4">
                                <Badge variant={payout.auditFlag ? "destructive" : "outline"}>
                                  {payout.source === "referral_commission" ? "Commission" : payout.source === "manual_award" ? "Manual award" : "Funded account"}
                                </Badge>
                                {payout.auditFlag && <p className="mt-1 text-[10px] font-medium text-destructive">Pre-funded or legacy</p>}
                              </td>
                              <td className="px-4 py-4 font-medium">{money(Number(payout.amount))}</td>
                              <td className="px-4 py-4 capitalize">{payout.method.replace("_", " ")}</td>
                              <td className="max-w-xs truncate px-4 py-4 font-mono text-xs" title={payout.destination}>{payout.destination}</td>
                              <td className="px-4 py-4"><Badge>{payout.status}</Badge></td>
                              <td className="whitespace-nowrap px-4 py-4 text-xs text-muted-foreground">{date(payout.created_at)}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                  <Button size="sm" variant="outline" onClick={() => setSelectedPayout(payout)}>Details</Button>
                                  {payout.status === "pending" && <>
                                    <Button size="sm" variant="outline" onClick={() => void reviewPayout(payout, "approved")} disabled={reviewingPayout === payout.id}>
                                      <Check className="mr-1.5 h-3.5 w-3.5" />Approve
                                    </Button>
                                    <Button size="sm" variant="destructive" onClick={() => { setSelectedPayout(payout); setPayoutRejectionReason(""); }} disabled={reviewingPayout === payout.id}>Decline</Button>
                                  </>}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {snapshot.payouts.length === 0 && <p className="p-6 text-sm text-muted-foreground">No payout requests have been submitted.</p>}
                  </CardContent>
                </Card>
              )}

              <Dialog open={selectedPayout !== null} onOpenChange={(open) => { if (!open) setSelectedPayout(null); }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Payout request details</DialogTitle>
                    <DialogDescription>Review the complete payout request before approving or declining it.</DialogDescription>
                  </DialogHeader>
                  {selectedPayout && <div className="grid gap-4 text-sm sm:grid-cols-2">
                    <div><p className="text-xs font-medium text-muted-foreground">Owner</p><p className="break-all">{userMap.get(selectedPayout.user_id)?.email || selectedPayout.user_id}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Request ID</p><p className="break-all font-mono text-xs">{selectedPayout.id}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Source</p><p>{selectedPayout.source === "referral_commission" ? "Referral commission" : "Funded-account profit"}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Amount</p><p className="font-semibold">{money(Number(selectedPayout.amount))}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Method</p><p className="capitalize">{selectedPayout.method.replace("_", " ")}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Status</p><Badge>{selectedPayout.status}</Badge></div>
                    <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Destination</p><p className="break-all font-mono text-xs">{selectedPayout.destination}</p></div>
                    <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Funded account</p>{(() => { const account = selectedPayout.account_id ? accountMap.get(selectedPayout.account_id) : null; return account ? <div><p>${account.account_size.toLocaleString()} account · <span className="capitalize">{account.status.replace("_", " ")}</span></p><p className="text-xs text-muted-foreground">Balance {money(Number(account.current_balance ?? account.account_size))} · Profit {money(Number(account.profit_loss ?? 0))}</p></div> : <p>{selectedPayout.account_id || "Commission payout"}</p>; })()}</div>
                    <div><p className="text-xs font-medium text-muted-foreground">Submitted</p><p>{date(selectedPayout.created_at)}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Last updated</p><p>{date(selectedPayout.updated_at)}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Reviewed by</p><p>{selectedPayout.reviewed_by ? (userMap.get(selectedPayout.reviewed_by)?.email || selectedPayout.reviewed_by) : "Awaiting review"}</p></div>
                    <div><p className="text-xs font-medium text-muted-foreground">Reviewed at</p><p>{date(selectedPayout.reviewed_at)}</p></div>
                    {selectedPayout.rejection_reason && <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Rejection reason</p><p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">{selectedPayout.rejection_reason}</p></div>}
                  </div>}
                  {selectedPayout?.status === "pending" && <DialogFooter>
                    <div className="w-full space-y-2">
                      <Label htmlFor="payout-rejection-reason">Reason for rejection</Label>
                      <textarea id="payout-rejection-reason" value={payoutRejectionReason} onChange={(event) => setPayoutRejectionReason(event.target.value)} placeholder="Explain why this payout is being rejected" className="min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                      <div className="flex justify-end gap-2">
                        <Button variant="destructive" onClick={() => void reviewPayout(selectedPayout, "rejected", payoutRejectionReason)} disabled={reviewingPayout === selectedPayout.id || payoutRejectionReason.trim().length < 3}>Decline payout</Button>
                        <Button variant="gold" onClick={() => void reviewPayout(selectedPayout, "approved")} disabled={reviewingPayout === selectedPayout.id}><Check className="mr-2 h-4 w-4" />Approve payout</Button>
                      </div>
                    </div>
                  </DialogFooter>}
                </DialogContent>
              </Dialog>

              <Dialog open={manualAwardOpen} onOpenChange={setManualAwardOpen}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2"><Award className="h-5 w-5 text-primary" />Award payout certificate</DialogTitle>
                    <DialogDescription>Issue a verified payout and certificate directly to a selected trader.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2"><Label>Trader</Label><Select value={manualAwardUserId} onValueChange={setManualAwardUserId}><SelectTrigger><SelectValue placeholder="Choose a trader" /></SelectTrigger><SelectContent>{snapshot.users.filter((user) => !user.isAdmin).map((user) => <SelectItem key={user.id} value={user.id}>{user.name || user.email || "Unnamed trader"}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Account size</Label><Select value={manualAwardSize} onValueChange={setManualAwardSize}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{[5000, 10000, 25000, 50000, 100000, 200000].map((size) => <SelectItem key={size} value={String(size)}>${size.toLocaleString()}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-2"><Label>Challenge</Label><Select value={manualAwardChallenge} onValueChange={(value) => setManualAwardChallenge(value as GrantChallenge)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="three_step">3-Step Challenge</SelectItem><SelectItem value="two_step">2-Step Challenge</SelectItem><SelectItem value="one_step">1-Step Challenge</SelectItem><SelectItem value="instant">Instant Funding</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label htmlFor="manual-award-amount">Payout amount</Label><Input id="manual-award-amount" type="number" min="0.01" step="0.01" placeholder="2500.00" value={manualAwardAmount} onChange={(event) => setManualAwardAmount(event.target.value)} /></div>
                    <div className="space-y-2"><Label htmlFor="manual-award-date">Payout date</Label><Input id="manual-award-date" type="date" value={manualAwardDate} onChange={(event) => setManualAwardDate(event.target.value)} /></div>
                    <div className="space-y-2"><Label>Method</Label><Select value={manualAwardMethod} onValueChange={setManualAwardMethod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bank_transfer">Bank transfer</SelectItem><SelectItem value="crypto">Crypto</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2 sm:col-span-2"><Label htmlFor="manual-award-destination">Payout destination</Label><Input id="manual-award-destination" placeholder={manualAwardMethod === "crypto" ? "Wallet address" : "Bank details or recipient reference"} value={manualAwardDestination} onChange={(event) => setManualAwardDestination(event.target.value)} /></div>
                  </div>
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">This award is approved immediately and creates a dark, downloadable payout certificate in the trader's dashboard.</div>
                  <DialogFooter><Button variant="outline" onClick={() => setManualAwardOpen(false)}>Cancel</Button><Button variant="gold" onClick={() => void awardManualPayout()} disabled={awardingPayout}>{awardingPayout ? "Awarding..." : "Award payout"}</Button></DialogFooter>
                </DialogContent>
              </Dialog>

              {editingAccount && (!section || section === "traders") && (
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void resetAccount(editingAccount)}
                    disabled={
                      resettingAccount === editingAccount.id ||
                      deletingAccount === editingAccount.id
                    }
                  >
                    {resettingAccount === editingAccount.id ? (
                      "Resetting..."
                    ) : (
                      <>
                        <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        Reset selected account
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => void deleteAccount(editingAccount)}
                    disabled={
                      deletingAccount === editingAccount.id ||
                      resettingAccount === editingAccount.id
                    }
                  >
                    {deletingAccount === editingAccount.id ? (
                      "Deleting..."
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-3.5 w-3.5" />
                        Archive selected account
                      </>
                    )}
                  </Button>
                </div>
              )}

              {(!section || section === "traders") && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Trash2 className="h-5 w-5 text-primary" />
                      Archive trader accounts
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Remove a trader and their accounts. Traders with payout
                      history are protected.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                      <div className="w-full space-y-2 sm:max-w-md">
                        <Label htmlFor="delete-trader">Trader</Label>
                        <Select
                          value={deleteUserId}
                          onValueChange={setDeleteUserId}
                        >
                          <SelectTrigger id="delete-trader">
                            <SelectValue placeholder="Choose a trader" />
                          </SelectTrigger>
                          <SelectContent>
                            {snapshot.users
                              .filter((user) => !user.isAdmin)
                              .map((user) => (
                                <SelectItem key={user.id} value={user.id}>
                                  {user.name || user.email || "Unnamed trader"}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        variant="destructive"
                        onClick={() => void deleteTrader()}
                        disabled={deletingUser || !deleteUserId}
                      >
                        {deletingUser ? "Archiving..." : "Archive trader accounts"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {(!section || section === "exposure") &&
                openPositions.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                      <div>
                        <CardTitle className="text-xl">
                          Position controls
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Close positions at the current live bid or ask price.
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() =>
                          void closePositions(openPositions, "all traders")
                        }
                        disabled={bulkClosing}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {bulkClosing ? "Closing..." : "Close all positions"}
                      </Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {traderGroups
                        .filter(({ positions }) => positions.length > 0)
                        .map(({ user, positions }) => (
                          <div
                            key={user.id}
                            className="space-y-3 rounded-md border border-border p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              <div>
                                <p className="font-medium">
                                  {user.name || "Unnamed trader"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {user.email} · {positions.length} open
                                  position{positions.length === 1 ? "" : "s"}
                                </p>
                              </div>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  void closePositions(
                                    positions,
                                    user.name || user.email || "this trader",
                                  )
                                }
                                disabled={bulkClosing}
                              >
                                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                                Close trader positions
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {positions.map((position) => {
                                const asset = position.assets;
                                const livePrice = asset
                                  ? prices[asset.symbol]
                                  : undefined;
                                const currentPrice = livePrice
                                  ? position.position_type.toLowerCase() ===
                                    "buy"
                                    ? livePrice.bid
                                    : livePrice.ask
                                  : null;
                                const pl = floatingPL(position);
                                return (
                                  <div
                                    key={position.id}
                                    className="grid gap-3 rounded-md bg-secondary/30 p-3 sm:grid-cols-[minmax(7rem,1.1fr)_repeat(4,minmax(5rem,1fr))_auto] sm:items-center"
                                  >
                                    <div>
                                      <div className="flex items-center gap-2 font-medium">
                                        <span
                                          className={cn(
                                            "h-2 w-2 rounded-full",
                                            position.position_type.toLowerCase() ===
                                              "buy"
                                              ? "bg-success"
                                              : "bg-destructive",
                                          )}
                                        />
                                        {asset?.symbol || position.asset_id}
                                        <Badge
                                          variant="outline"
                                          className="text-[10px]"
                                        >
                                          {position.position_type}
                                        </Badge>
                                      </div>
                                      <div className="mt-1 text-xs text-muted-foreground">
                                        Opened {date(position.opened_at)}
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase text-muted-foreground">
                                        Lots
                                      </p>
                                      <p className="font-medium">
                                        {position.lot_size}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase text-muted-foreground">
                                        Open
                                      </p>
                                      <p className="font-medium">
                                        {price(position.entry_price)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase text-muted-foreground">
                                        Current
                                      </p>
                                      <p className="font-medium">
                                        {price(currentPrice)}
                                      </p>
                                    </div>
                                    <div>
                                      <p className="text-[10px] uppercase text-muted-foreground">
                                        Floating P/L
                                      </p>
                                      <p
                                        className={cn(
                                          "font-medium",
                                          pl === null || pl >= 0
                                            ? "text-success"
                                            : "text-destructive",
                                        )}
                                      >
                                        {pl === null ? "-" : money(pl)}
                                      </p>
                                    </div>
                                    <div className="flex gap-3 text-xs">
                                      <span className="text-destructive">
                                        SL {price(position.stop_loss)}
                                      </span>
                                      <span className="text-success">
                                        TP {price(position.take_profit)}
                                      </span>
                                    </div>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        void closeOnePosition(position)
                                      }
                                      disabled={
                                        bulkClosing ||
                                        closingPositionId !== null
                                      }
                                      aria-label={`Close ${asset?.symbol || "position"}`}
                                      title={`Close ${asset?.symbol || "position"}`}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                )}

              <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                {(section === "kyc" || !section) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <FileCheck2 className="h-5 w-5 text-primary" />
                        KYC review queue
                      </CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Review private identity and address documents. Pending
                        applications require a decision.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {snapshot.kyc.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No KYC applications.
                        </p>
                      ) : (
                        snapshot.kyc.map((application) => {
                          const archivedDocuments = snapshot.kycDocuments.filter(
                            (document) => document.kyc_id === application.id,
                          );
                          return (
                            <div
                              key={application.id}
                              className="space-y-3 rounded-lg border border-border p-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="font-medium">
                                    {userMap.get(application.user_id)?.name ||
                                      userMap.get(application.user_id)?.email ||
                                      application.user_id}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    Submitted{" "}
                                    {date(
                                      application.identity_submitted_at ||
                                        application.created_at,
                                    )}
                                  </p>
                                </div>
                                <Badge variant="outline" className="capitalize">
                                  {application.status}
                                </Badge>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void previewDocument(
                                      application.identity_document_path,
                                    )
                                  }
                                  disabled={!application.identity_document_path}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Identity document
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void previewDocument(
                                      application.address_document_path,
                                    )
                                  }
                                  disabled={!application.address_document_path}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                  Proof of address
                                </Button>
                                {archivedDocuments.map((document) => (
                                  <Button
                                    key={document.id}
                                    size="sm"
                                    variant="outline"
                                    onClick={() => void previewDocument(document.storage_path)}
                                  >
                                    <ExternalLink className="h-4 w-4" />
                                    {document.document_kind === "identity" ? "Identity" : "Address"} ({date(document.submitted_at)})
                                  </Button>
                                ))}
                              </div>
                              {application.status === "pending" && <textarea
                                aria-label="Rejection reason"
                                placeholder="Required only when rejecting"
                                value={rejectionReasons[application.id] || ""}
                                onChange={(event) =>
                                  setRejectionReasons((current) => ({
                                    ...current,
                                    [application.id]: event.target.value,
                                  }))
                                }
                                className="min-h-16 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                              />}
                              {application.status === "pending" && <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    void reviewKyc(application, "rejected")
                                  }
                                  disabled={reviewingKyc === application.id}
                                >
                                  Reject
                                </Button>
                                <Button
                                  size="sm"
                                  variant="gold"
                                  onClick={() =>
                                    void reviewKyc(application, "approved")
                                  }
                                  disabled={reviewingKyc === application.id}
                                >
                                  Approve
                                </Button>
                              </div>}
                            </div>
                          );
                        })
                      )}
                    </CardContent>
                  </Card>
                )}
                {(!section || section === "traders") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-xl">
                        <span>Traders</span>
                        <Badge variant="outline">
                          {new Set(snapshot.accounts.filter((account) => account.status !== "pending_payment").map((account) => account.user_id)).size} with accounts
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/60">
                        {sortedUsers.filter((user) => snapshot.accounts.some((account) => account.user_id === user.id && account.status !== "pending_payment")).map((user) => {
                          const group = traderGroups.find(
                            (candidate) => candidate.user.id === user.id,
                          );
                          const accounts = group?.accounts ?? [];
                          const positions = group?.positions ?? [];
                          const history = group?.history ?? [];
                          const pl = group?.accountPL ?? 0;
                          const isActive = activeUsers.some(
                            (active) => active.id === user.id,
                          );
                          return (
                            <Collapsible key={user.id}>
                              <CollapsibleTrigger asChild>
                                <button onClick={() => navigate(`/admin/traders/${user.id}`)} className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-4 text-left hover:bg-secondary/30">
                                  <span className="min-w-0">
                                    <span className="flex items-center gap-2 font-medium">
                                      <span
                                        className={cn(
                                          "inline-block h-2 w-2 shrink-0 rounded-full",
                                          isActive
                                            ? "bg-success"
                                            : "bg-muted-foreground/40",
                                        )}
                                      />
                                      {user.name || "Unnamed trader"}
                                    </span>
                                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                                      {user.email}
                                    </span>
                                  </span>
                                  <span className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
                                    <span>{accounts.length} account{accounts.length === 1 ? "" : "s"}</span>
                                    <span className={cn("font-medium", pl >= 0 ? "text-success" : "text-destructive")}>
                                      {money(pl)}
                                    </span>
                                    <span>Last sign in {date(user.lastSignInAt)}</span>
                                    <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                                  </span>
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent className="space-y-5 bg-secondary/10 px-6 pb-5 pt-1">
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                  {accounts.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">No trading accounts.</p>
                                  ) : accounts.map((account) => (
                                    <div key={account.id} className="rounded-md border border-border bg-background p-3">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="font-medium">${account.account_size.toLocaleString()}</p>
                                        <Badge variant="outline">{account.status.replace("_", " ")}</Badge>
                                      </div>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {account.challenge_type.replace("_", " ")} · Phase {account.current_phase ?? "-"}
                                      </p>
                                      <p className={cn("mt-2 text-sm font-medium", (account.profit_loss ?? 0) >= 0 ? "text-success" : "text-destructive")}>
                                        {money(account.profit_loss ?? 0)} P/L
                                      </p>
                                      <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                                        <span>Daily DD: <strong className={cn((account.daily_drawdown_percent ?? 0) >= 80 ? "text-warning" : "text-foreground")}>{(account.daily_drawdown_percent ?? 0).toFixed(2)}%</strong></span>
                                        <span>Max DD: <strong className={cn((account.max_drawdown_percent ?? 0) >= 80 ? "text-warning" : "text-foreground")}>{(account.max_drawdown_percent ?? 0).toFixed(2)}%</strong></span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                                <div className="grid gap-5 lg:grid-cols-2">
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Open positions</p>
                                      <Badge variant="outline">{positions.length}</Badge>
                                    </div>
                                    {positions.length === 0 ? <p className="text-sm text-muted-foreground">No open positions.</p> : positions.map((position) => (
                                      <div key={position.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
                                        <div>
                                          <p className="font-medium">{position.assets?.symbol || position.asset_id} <Badge variant="outline" className="ml-1 text-[10px]">{position.position_type}</Badge></p>
                                          <p className="mt-1 text-xs text-muted-foreground">{position.lot_size} lots · Opened {date(position.opened_at)}</p>
                                          <p className="mt-1 text-xs text-muted-foreground">SL {price(position.stop_loss)} · TP {price(position.take_profit)}</p>
                                        </div>
                                        <p className="text-xs text-muted-foreground">Entry {price(position.entry_price)}</p>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent trades</p>
                                      <Badge variant="outline">{history.length}</Badge>
                                    </div>
                                    {history.length === 0 ? <p className="text-sm text-muted-foreground">No recent trades.</p> : history.map((trade) => (
                                      <div key={trade.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background p-3 text-sm">
                                        <div>
                                          <p className="font-medium">{trade.symbol} <Badge variant="secondary" className="ml-1 text-[10px]">{trade.action}</Badge></p>
                                          <p className="mt-1 text-xs text-muted-foreground">{trade.lot_size} lots · {date(trade.created_at)}</p>
                                        </div>
                                        <p className={cn("font-medium", (trade.profit_loss ?? 0) >= 0 ? "text-success" : "text-destructive")}>{money(trade.profit_loss ?? 0)}</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          );
                          })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {(!section || section === "exposure") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-xl">
                        <span>Open exposure</span>
                        <Badge variant="outline">
                          {isConnected ? "Live prices" : "Connecting"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {openPositions.length === 0 ? (
                        <p className="p-6 text-sm text-muted-foreground">
                          No open positions right now.
                        </p>
                      ) : (
                        <div className="divide-y divide-border/60">
                          {traderGroups
                            .filter(({ positions }) => positions.length > 0)
                            .map(({ user, positions }, index) => (
                              <Collapsible
                                key={user.id}
                                defaultOpen={index === 0}
                              >
                                <CollapsibleTrigger asChild>
                                  <button className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-secondary/30">
                                    <span>
                                      <span className="font-medium">
                                        {user.name || "Unnamed trader"}
                                      </span>
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        {user.email}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                      {positions.length} position
                                      {positions.length === 1 ? "" : "s"}
                                      <ChevronDown className="h-4 w-4 transition-transform data-[state=open]:rotate-180" />
                                    </span>
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="bg-secondary/10 px-6 pb-3">
                                  <div className="space-y-3">
                                    {positions.slice(0, 8).map((position) => {
                                      const account = accountMap.get(
                                        position.account_id,
                                      );
                                      const asset = position.assets;
                                      const pl = floatingPL(position);
                                      const livePrice = asset
                                        ? prices[asset.symbol]
                                        : undefined;
                                      return (
                                        <div
                                          key={position.id}
                                          className="flex items-center justify-between gap-3 border-b border-border/60 pb-3 last:border-0"
                                        >
                                          <div className="min-w-0">
                                            <div className="flex items-center gap-2 font-medium">
                                              <span
                                                className={cn(
                                                  "h-2 w-2 shrink-0 rounded-full",
                                                  position.position_type.toLowerCase() ===
                                                    "buy"
                                                    ? "bg-success"
                                                    : "bg-destructive",
                                                )}
                                              />
                                              {asset?.symbol ||
                                                position.asset_id}
                                              <Badge
                                                variant="outline"
                                                className="text-[10px]"
                                              >
                                                {position.position_type}
                                              </Badge>
                                            </div>
                                            <div className="truncate text-xs text-muted-foreground">
                                              $
                                              {account?.account_size.toLocaleString()}{" "}
                                              · {position.lot_size} lots · entry{" "}
                                              {position.entry_price.toLocaleString(
                                                undefined,
                                                { maximumFractionDigits: 6 },
                                              )}
                                              {livePrice
                                                ? ` · now ${livePrice[position.position_type.toLowerCase() === "buy" ? "bid" : "ask"].toLocaleString(undefined, { maximumFractionDigits: 6 })}`
                                                : ""}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              SL {price(position.stop_loss)} · TP {price(position.take_profit)}
                                            </div>
                                          </div>
                                          <div
                                            className={cn(
                                              "shrink-0 text-right text-sm font-medium",
                                              pl === null
                                                ? "text-muted-foreground"
                                                : pl >= 0
                                                  ? "text-success"
                                                  : "text-destructive",
                                            )}
                                          >
                                            {pl === null ? (
                                              "Waiting"
                                            ) : (
                                              <>
                                                <div>
                                                  {pl >= 0 ? (
                                                    <ArrowUpRight className="mr-1 inline h-3 w-3" />
                                                  ) : (
                                                    <ArrowDownRight className="mr-1 inline h-3 w-3" />
                                                  )}
                                                  {money(pl)}
                                                </div>
                                                <div className="text-[10px] font-normal text-muted-foreground">
                                                  floating PnL
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>

              {section === "affiliates" && (
                <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Affiliate applications</CardTitle>
                    <p className="text-sm text-muted-foreground">Approve a requested code only when it is available. Approved codes can attribute signups and earn commissions.</p>
                  </CardHeader>
                  <CardContent className="p-0">
                    {snapshot.affiliateApplications.filter((application) => application.status === "pending").length === 0 ? <p className="p-6 text-sm text-muted-foreground">No pending affiliate applications.</p> : <div className="overflow-x-auto"><table className="min-w-[40rem] w-full text-left text-sm"><thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground"><tr><th className="px-6 py-3">Applicant</th><th className="px-4 py-3">Requested code</th><th className="px-6 py-3 text-right">Review</th></tr></thead><tbody>{snapshot.affiliateApplications.filter((application) => application.status === "pending").map((application) => <tr key={application.id} className="border-b border-border/60 last:border-0"><td className="px-6 py-4"><div className="font-medium">{userMap.get(application.user_id)?.name || "Unnamed applicant"}</div><div className="text-xs text-muted-foreground">{userMap.get(application.user_id)?.email || application.user_id.slice(0, 8)}</div></td><td className="px-4 py-4 font-mono font-semibold">{application.desired_code}</td><td className="px-6 py-4 text-right"><Button size="sm" variant="outline" onClick={() => setSelectedAffiliateApplication(application)}>Review details</Button></td></tr>)}</tbody></table></div>}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-xl">Affiliate purchase codes</CardTitle>
                    <p className="text-sm text-muted-foreground">Manage the discount customers receive when they purchase with an affiliate code.</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {snapshot.affiliateCodes.length === 0 ? <p className="text-sm text-muted-foreground">No affiliate codes have been assigned.</p> : snapshot.affiliateCodes.map((affiliateCode) => {
                      const draft = affiliateCodeDrafts[affiliateCode.id] ?? { discount: String(affiliateCode.discount_percent), isActive: affiliateCode.is_active };
                      const owner = userMap.get(affiliateCode.user_id);
                      return <div key={affiliateCode.id} className="grid gap-3 rounded-md border border-border/60 p-4 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"><div><p className="font-mono font-semibold">{affiliateCode.code}</p><p className="text-xs text-muted-foreground">{owner?.email || affiliateCode.user_id.slice(0, 8)}</p></div><div className="flex items-center gap-2"><Input aria-label={`${affiliateCode.code} discount percentage`} type="number" min="0" max="100" step="1" className="w-24" value={draft.discount} onChange={(event) => setAffiliateCodeDrafts((current) => ({ ...current, [affiliateCode.id]: { ...draft, discount: event.target.value } }))} /><span className="text-sm text-muted-foreground">% off</span></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={draft.isActive} onCheckedChange={(checked) => setAffiliateCodeDrafts((current) => ({ ...current, [affiliateCode.id]: { ...draft, isActive: checked === true } }))} />Active</label><Button size="sm" variant="gold" onClick={() => void updateAffiliateCode(affiliateCode)} disabled={savingAffiliateCode === affiliateCode.id}>{savingAffiliateCode === affiliateCode.id ? "Saving..." : "Save"}</Button></div>;
                    })}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <UserRoundCheck className="h-5 w-5 text-primary" />
                      Affiliate partners
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Assign or remove affiliate access for normal trader
                      accounts.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-[40rem] w-full text-left text-sm">
                        <thead className="border-y border-border bg-secondary/40 text-xs uppercase text-muted-foreground">
                          <tr>
                            <th className="px-6 py-3">Trader</th>
                            <th className="px-4 py-3">Joined</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-6 py-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedUsers
                            .filter((user) => !user.isAdmin)
                            .map((user) => (
                              <tr
                                key={user.id}
                                className="border-b border-border/60 last:border-0"
                              >
                                <td className="px-6 py-4">
                                  <div className="font-medium">
                                    {user.name || "Unnamed trader"}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {user.email}
                                  </div>
                                </td>
                                <td className="px-4 py-4 text-xs text-muted-foreground">
                                  {date(user.createdAt)}
                                </td>
                                <td className="px-4 py-4">
                                  <Badge
                                    variant={
                                      user.isAffiliate ? "default" : "outline"
                                    }
                                  >
                                    {user.isAffiliate
                                      ? "Partnered affiliate"
                                      : "Normal account"}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <Button
                                    variant={
                                      user.isAffiliate ? "outline" : "gold"
                                    }
                                    size="sm"
                                    onClick={() =>
                                      void updateAffiliateStatus(user)
                                    }
                                    disabled={updatingAffiliate === user.id}
                                  >
                                    {updatingAffiliate === user.id
                                      ? "Updating..."
                                      : user.isAffiliate
                                        ? "Remove access"
                                        : "Assign affiliate"}
                                  </Button>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
                <Dialog open={selectedAffiliateApplication !== null} onOpenChange={(open) => { if (!open) setSelectedAffiliateApplication(null); }}>
                  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    {selectedAffiliateApplication && <>
                      <DialogHeader>
                        <DialogTitle>Review affiliate application</DialogTitle>
                        <DialogDescription>Review the applicant's submitted information before making a decision.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div><p className="text-xs font-medium text-muted-foreground">Applicant</p><p>{userMap.get(selectedAffiliateApplication.user_id)?.email || selectedAffiliateApplication.user_id}</p></div>
                        <div><p className="text-xs font-medium text-muted-foreground">Requested code</p><p className="font-mono font-semibold">{selectedAffiliateApplication.desired_code}</p></div>
                        <div><p className="text-xs font-medium text-muted-foreground">Phone</p><p>{selectedAffiliateApplication.phone}</p></div>
                        <div><p className="text-xs font-medium text-muted-foreground">Country</p><p>{selectedAffiliateApplication.country}</p></div>
                        <div><p className="text-xs font-medium text-muted-foreground">Audience size</p><p>{selectedAffiliateApplication.audience_size}</p></div>
                        <div><p className="text-xs font-medium text-muted-foreground">Promotion channels</p><p>{selectedAffiliateApplication.promotion_channels}</p></div>
                        <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Website</p><p>{selectedAffiliateApplication.website || "Not provided"}</p></div>
                        <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Social profiles</p><p>{[selectedAffiliateApplication.instagram && `Instagram: ${selectedAffiliateApplication.instagram}`, selectedAffiliateApplication.tiktok && `TikTok: ${selectedAffiliateApplication.tiktok}`, selectedAffiliateApplication.youtube && `YouTube: ${selectedAffiliateApplication.youtube}`, selectedAffiliateApplication.x_handle && `X: ${selectedAffiliateApplication.x_handle}`].filter(Boolean).join(" · ") || "Not provided"}</p></div>
                        <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Affiliate experience</p><p className="whitespace-pre-wrap">{selectedAffiliateApplication.affiliate_experience || "Not provided"}</p></div>
                        <div className="sm:col-span-2"><p className="text-xs font-medium text-muted-foreground">Promotion plan</p><p className="whitespace-pre-wrap">{selectedAffiliateApplication.promotion_plan}</p></div>
                      </div>
                      <DialogFooter><Button variant="outline" onClick={() => void reviewAffiliateApplication(selectedAffiliateApplication, "rejected")} disabled={reviewingAffiliate === selectedAffiliateApplication.id}>Reject</Button><Button variant="gold" onClick={() => void reviewAffiliateApplication(selectedAffiliateApplication, "approved")} disabled={reviewingAffiliate === selectedAffiliateApplication.id}>Approve application</Button></DialogFooter>
                    </>}
                  </DialogContent>
                </Dialog>
                </div>
              )}

              <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
                {(!section || section === "referrals") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-xl">
                        Referral network
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {snapshot.referrals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No referrals recorded yet.
                        </p>
                      ) : (
                        snapshot.referrals.slice(0, 8).map((referral) => (
                          <div
                            key={referral.referred_user_id}
                            className="flex items-center justify-between border-b border-border/60 pb-3 last:border-0"
                          >
                            <div>
                              <div className="font-medium">
                                {userMap.get(referral.referred_user_id)
                                  ?.email ||
                                  referral.referred_user_id.slice(0, 8)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                referred by{" "}
                                {userMap.get(referral.referrer_id)?.email ||
                                  referral.referrer_id.slice(0, 8)}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">{referral.status}</Badge>
                              <div className="mt-1 text-xs text-primary">
                                {money(referral.commission_earned)}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </CardContent>
                  </Card>
                )}
                {(!section || section === "activity") && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <Clock3 className="h-5 w-5 text-primary" />
                        Recent trade activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {recentHistory.length === 0 ? (
                        <p className="p-6 text-sm text-muted-foreground">
                          No trade activity recorded yet.
                        </p>
                      ) : (
                        <div className="divide-y divide-border/60">
                          {traderGroups
                            .filter(({ history }) => history.length > 0)
                            .map(({ user, history }, index) => (
                              <Collapsible
                                key={user.id}
                                defaultOpen={index === 0}
                              >
                                <CollapsibleTrigger asChild>
                                  <button className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left hover:bg-secondary/30">
                                    <span>
                                      <span className="font-medium">
                                        {user.name || "Unnamed trader"}
                                      </span>
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        {user.email}
                                      </span>
                                    </span>
                                    <span className="flex items-center gap-3 text-xs text-muted-foreground">
                                      {history.length} trade
                                      {history.length === 1 ? "" : "s"}
                                      <ChevronDown className="h-4 w-4" />
                                    </span>
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="bg-secondary/10">
                                  {history.map((trade) => {
                                    const pl = trade.profit_loss ?? 0;
                                    return (
                                      <div
                                        key={trade.id}
                                        className="flex items-center justify-between gap-3 border-t border-border/60 px-6 py-3"
                                      >
                                        <div className="min-w-0">
                                          <div className="flex items-center gap-2 font-medium">
                                            <span className="truncate">
                                              {trade.symbol}
                                            </span>
                                            <Badge
                                              variant="secondary"
                                              className="text-[10px]"
                                            >
                                              {trade.action}
                                            </Badge>
                                          </div>
                                          <div className="truncate text-xs text-muted-foreground">
                                            {trade.lot_size} lots ·{" "}
                                            {date(trade.created_at)}
                                          </div>
                                        </div>
                                        <div
                                          className={cn(
                                            "flex shrink-0 items-center gap-1 font-medium",
                                            pl >= 0
                                              ? "text-success"
                                              : "text-destructive",
                                          )}
                                        >
                                          {pl >= 0 ? (
                                            <ArrowUpRight className="h-3 w-3" />
                                          ) : (
                                            <ArrowDownRight className="h-3 w-3" />
                                          )}
                                          {money(pl)}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </CollapsibleContent>
                              </Collapsible>
                            ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
              <p className="text-right text-xs text-muted-foreground">
                Snapshot generated {date(snapshot.generatedAt)}
              </p>
            </>
          )
        )}
      </div>
    </DashboardLayout>
  );
}
