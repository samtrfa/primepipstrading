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
    const [{ data: usersData, error: usersError }, accounts, positions, referrals, history, kyc, payments] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      admin.from("accounts").select("id, user_id, account_size, challenge_type, status, current_balance, profit_loss, updated_at, created_at").in("status", ["active", "funded", "passed"]),
      admin.from("positions").select("id, account_id, asset_id, position_type, lot_size, profit_loss, status, opened_at, entry_price, assets(symbol, pip_value, asset_type, quote_currency, lot_size)"),
      admin.from("referrals").select("referrer_id, referred_user_id, status, commission_earned, referred_at, account_purchased"),
      admin.from("trade_history").select("id, account_id, symbol, action, lot_size, profit_loss, created_at, price").order("created_at", { ascending: false }).limit(200),
      admin.from("kyc_verifications").select("id, user_id, identity_document_type, identity_document_path, identity_submitted_at, address_document_type, address_document_path, address_submitted_at, status, rejection_reason, reviewed_at, reviewed_by, created_at, updated_at").order("created_at", { ascending: false }),
      admin.from("payment_orders").select("id, user_id, account_id, provider, provider_reference, amount, currency, status, checkout_at, verified_at, webhook_at, failure_reason, refund_amount, refunded_at").order("checkout_at", { ascending: false }).limit(200),
    ]);

    if (usersError) {
      console.error("Could not load users:", usersError.message);
      return json({ error: "Could not load users" }, 500);
    }
    const failed = [accounts, positions, referrals, history, kyc, payments].find((result) => result.error);
    if (failed?.error) {
      console.error("Could not load platform data:", failed.error.message);
      return json({ error: "Could not load platform data" }, 500);
    }

    const users = usersData?.users ?? [];

    return json({
      users: (users ?? []).map((user) => ({
        id: user.id,
        email: user.email,
        name: user.user_metadata?.full_name ?? null,
        lastSignInAt: user.last_sign_in_at,
        createdAt: user.created_at,
        isAffiliate: user.app_metadata?.affiliate === true,
        isAdmin: user.app_metadata?.role === "admin",
      })),
      accounts: accounts.data ?? [],
      positions: positions.data ?? [],
      referrals: referrals.data ?? [],
      history: history.data ?? [],
      kyc: kyc.data ?? [],
      payments: payments.data ?? [],
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("admin-snapshot error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});