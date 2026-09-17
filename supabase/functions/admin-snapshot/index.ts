import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || claimsData?.claims?.app_metadata?.role !== "admin") {
      return json({ error: "Forbidden" }, 403);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const [{ data: usersData, error: usersError }, accounts, positions, referrals, applications, affiliateCodes, affiliateBalances, history, kyc, kycDocuments, payments, payouts, coupons] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("accounts").select("id, user_id, account_size, challenge_type, status, current_balance, profit_loss, current_phase, high_water_mark, daily_start_balance, daily_start_date, max_drawdown_percent, daily_drawdown_percent, consistency_score, best_trading_day_profit, closed_profit_total, drawdown_violated, violation_type, phase_passed, archived_at, archive_expires_at, updated_at, created_at, coupon_code, price, payment_currency, payment_amount_local, payment_provider, payment_reference"),
      admin.from("positions").select("id, account_id, asset_id, position_type, lot_size, profit_loss, status, opened_at, closed_at, entry_price, exit_price, stop_loss, take_profit, assets(symbol, pip_value, asset_type, quote_currency, lot_size)"),
      admin.from("referrals").select("referrer_id, referred_user_id, status, commission_earned, referred_at, account_purchased"),
      admin.from("affiliate_applications").select("id, user_id, desired_code, phone, country, website, instagram, tiktok, youtube, x_handle, audience_size, promotion_channels, affiliate_experience, promotion_plan, status, rejection_reason, created_at, updated_at").order("created_at", { ascending: false }),
      admin.from("affiliate_codes").select("id, user_id, code, discount_percent, is_active, created_at").order("created_at", { ascending: false }),
      admin.from("affiliate_balances").select("user_id, available, reserved, paid"),
      admin.from("trade_history").select("id, account_id, symbol, action, lot_size, profit_loss, created_at, price, notes").order("created_at", { ascending: false }),
      admin.from("kyc_verifications").select("id, user_id, identity_document_type, identity_document_path, identity_submitted_at, address_document_type, address_document_path, address_submitted_at, status, rejection_reason, reviewed_at, reviewed_by, created_at, updated_at").order("created_at", { ascending: false }),
      admin.from("kyc_documents").select("id, kyc_id, document_kind, document_type, storage_path, submitted_at").order("submitted_at", { ascending: false }),
      admin.from("payment_orders").select("id, user_id, account_id, provider, provider_reference, amount, currency, status, checkout_at, verified_at, webhook_at, failure_reason, refund_amount, refunded_at").order("checkout_at", { ascending: false }).limit(200),
      admin.from("payout_requests").select("id, user_id, account_id, amount, method, destination, source, status, rejection_reason, created_at, updated_at, reviewed_by, reviewed_at").order("created_at", { ascending: false }).limit(200),
      admin.from("coupons").select("id, code, discount_percent, challenge_types, is_active, expires_at, max_uses, times_used, created_at, updated_at").order("created_at", { ascending: false }),
    ]);

    if (usersError) {
      console.error("Could not load users:", usersError.message);
      return json({ error: "Could not load users" }, 500);
    }
    const readData = <T,>(result: { data: T[] | null; error: { message: string } | null }, source: string) => {
      if (result.error) {
        console.error(`Could not load ${source}:`, result.error.message);
        return [] as T[];
      }
      return result.data ?? [];
    };
    const accountsData = readData(accounts, "accounts");
    const positionsData = readData(positions, "positions");
    const referralsData = readData(referrals, "referrals");
    const applicationsData = readData(applications, "affiliate applications");
    const affiliateCodesData = readData(affiliateCodes, "affiliate codes");
    const affiliateBalancesData = readData(affiliateBalances, "affiliate balances");
    const historyData = readData(history, "trade history");
    const kycData = readData(kyc, "kyc");
    const kycDocumentsData = readData(kycDocuments, "kyc documents");
    const paymentsData = readData(payments, "payments");
    const payoutsData = readData(payouts, "payouts");
    const couponsData = readData(coupons, "coupons");

    const users = usersData?.users ?? [];
    const adminUserIds = new Set(users.filter((user) => user.app_metadata?.role === "admin").map((user) => user.id));
    const visibleAccounts = accountsData.filter((account) => !adminUserIds.has(account.user_id));
    const accountById = new Map(visibleAccounts.map((account) => [account.id, account]));
    const fundedStartByAccount = new Map<string, string>();
    for (const trade of historyData) {
      if (trade.action !== "phase_advance" || !trade.notes?.toLowerCase().includes("funded")) continue;
      const current = fundedStartByAccount.get(trade.account_id);
      if (!current || new Date(trade.created_at) > new Date(current)) fundedStartByAccount.set(trade.account_id, trade.created_at);
    }
    const auditedPayouts = payoutsData.map((payout) => {
      if (payout.source !== "trading_profit") return { ...payout, auditFlag: null };
      const account = payout.account_id ? accountById.get(payout.account_id) : null;
      const fundedStart = account && (fundedStartByAccount.get(account.id) ?? account.funded_started_at);
      const submittedBeforeFunded = !fundedStart || new Date(payout.created_at) < new Date(fundedStart);
      const accountNotFunded = account?.status !== "funded";
      return {
        ...payout,
        auditFlag: submittedBeforeFunded || accountNotFunded ? "legacy_or_pre_funded" : null,
      };
    });

    return json({
      users: (users ?? []).filter((user) => user.app_metadata?.role !== "admin").map((user) => ({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name ?? null,
        lastSignInAt: user.last_sign_in_at,
        createdAt: user.created_at,
        isAffiliate: user.app_metadata?.affiliate === true,
        isAdmin: user.app_metadata?.role === "admin",
      })),
      accounts: visibleAccounts,
      positions: positionsData,
      referrals: referralsData,
      affiliateApplications: applicationsData,
      affiliateCodes: affiliateCodesData,
      affiliateBalances: affiliateBalancesData,
      history: historyData,
      kyc: kycData,
      kycDocuments: kycDocumentsData,
      payments: paymentsData,
      payouts: auditedPayouts,
      coupons: couponsData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("admin-snapshot error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});