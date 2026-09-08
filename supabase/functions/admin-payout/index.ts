import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const token = authorization.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || claimsData?.claims?.app_metadata?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    if (typeof body.payoutId !== "string" || !["approved", "rejected", "paid"].includes(body.status)) return json({ error: "Invalid payout review request" }, 400);
    const rejectionReason = typeof body.rejectionReason === "string" ? body.rejectionReason.trim() : "";
    if (body.status === "rejected" && rejectionReason.length < 3) return json({ error: "A rejection reason is required" }, 422);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const reviewerId = claimsData.claims.sub;
    const reviewedAt = new Date().toISOString();
    const { data: requestedPayout, error: payoutLookupError } = await admin
      .from("payout_requests")
      .select("id, account_id, amount, source, status")
      .eq("id", body.payoutId)
      .eq("status", body.status === "paid" ? "approved" : "pending")
      .maybeSingle();
    if (payoutLookupError) return json({ error: "Could not load payout request" }, 500);
    if (!requestedPayout) return json({ error: "Payout request was not found or has already been reviewed" }, 409);

    if (body.status === "approved" && requestedPayout.source === "trading_profit") {
      if (!requestedPayout.account_id) return json({ error: "Trading payout has no account" }, 422);
      const { data: account, error: accountError } = await admin
        .from("accounts")
        .select("status, funded_started_at, funded_profit_loss, consistency_score")
        .eq("id", requestedPayout.account_id)
        .maybeSingle();
      if (accountError) return json({ error: "Could not validate payout account" }, 500);
      const submittedBeforeFunded = !account || account.status !== "funded" || !account.funded_started_at;
      if (submittedBeforeFunded || Number(account.consistency_score ?? 0) >= 30 || Number(requestedPayout.amount) > Number(account.funded_profit_loss ?? 0)) {
        return json({ error: "This payout is not eligible for approval from funded-stage profit." }, 422);
      }
    }

    const { data: payout, error } = await admin
      .from("payout_requests")
      .update({ status: body.status, rejection_reason: body.status === "rejected" ? rejectionReason : null, reviewed_by: reviewerId, reviewed_at: reviewedAt })
      .eq("id", body.payoutId)
      .eq("status", body.status === "paid" ? "approved" : "pending")
      .select("id, user_id, account_id, amount, method, source, status, rejection_reason, updated_at, reviewed_by, reviewed_at")
      .maybeSingle();
    if (error) return json({ error: "Could not update payout request" }, 500);
    if (!payout) return json({ error: "Payout request was not found or has already been reviewed" }, 409);

    return json({ payout });
  } catch (error) {
    console.error("admin-payout error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
