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
    if (typeof body.payoutId !== "string" || !["approved", "rejected"].includes(body.status)) return json({ error: "Invalid payout review request" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const reviewerId = claimsData.claims.sub;
    const reviewedAt = new Date().toISOString();
    const { data: payout, error } = await admin
      .from("payout_requests")
      .update({ status: body.status, reviewed_by: reviewerId, reviewed_at: reviewedAt })
      .eq("id", body.payoutId)
      .eq("status", "pending")
      .select("id, status, updated_at, reviewed_by, reviewed_at")
      .maybeSingle();
    if (error) return json({ error: "Could not update payout request" }, 500);
    if (!payout) return json({ error: "Payout request was not found or has already been reviewed" }, 409);
    return json({ payout });
  } catch (error) {
    console.error("admin-payout error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
