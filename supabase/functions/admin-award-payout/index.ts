import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const challengeTypes = ["three_step", "two_step", "one_step", "instant"];
const methods = ["bank_transfer", "crypto"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const token = authorization.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || claimsData?.claims?.app_metadata?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const amount = Number(body.amount);
    const accountSize = Number(body.accountSize);
    const payoutDate = typeof body.payoutDate === "string" ? new Date(body.payoutDate) : new Date();
    if (typeof body.userId !== "string" || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(accountSize) || accountSize <= 0 || Number.isNaN(payoutDate.getTime()) || !challengeTypes.includes(body.challengeType) || !methods.includes(body.method) || typeof body.destination !== "string" || !body.destination.trim()) {
      return json({ error: "Provide a user, account size, challenge, payout amount, method, and destination" }, 400);
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.userId);
    if (targetError || !target.user) return json({ error: "User not found" }, 404);
    if (target.user.app_metadata?.role === "admin") return json({ error: "Payouts cannot be awarded to admins" }, 400);

    const { data: pendingPayout, error: insertError } = await admin.from("payout_requests").insert({
      user_id: body.userId,
      account_id: null,
      amount: amount.toFixed(2),
      method: body.method,
      destination: body.destination.trim(),
      source: "manual_award",
      status: "pending",
      certificate_account_size: accountSize,
      certificate_challenge_type: body.challengeType,
      payout_date: payoutDate.toISOString(),
    }).select("id").single();
    if (insertError || !pendingPayout) {
      console.error("Could not create manual payout:", insertError);
      return json({ error: insertError?.message || "Could not create manual payout" }, 500);
    }

    const { data: payout, error: approvalError } = await admin.from("payout_requests")
      .update({ status: "approved", reviewed_by: claimsData.claims.sub, reviewed_at: new Date().toISOString() })
      .eq("id", pendingPayout.id)
      .eq("status", "pending")
      .select("id, user_id, account_id, amount, method, destination, source, status, created_at, updated_at, reviewed_by, reviewed_at")
      .single();
    if (approvalError || !payout) {
      console.error("Manual payout approval failed:", approvalError);
      return json({ error: approvalError?.message || "Manual payout could not be approved" }, 500);
    }
    return json({ payout });
  } catch (error) {
    console.error("admin-award-payout error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});