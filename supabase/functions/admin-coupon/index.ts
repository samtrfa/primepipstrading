import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const url = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
    const token = authorization.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || claimsData?.claims?.app_metadata?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const admin = createClient(url, serviceKey);
    const action = body?.action || "create";
    const challengeTypes = body?.challengeTypes === null || body?.challengeTypes === undefined
      ? null
      : Array.isArray(body.challengeTypes) && body.challengeTypes.length > 0
        ? body.challengeTypes
        : null;

    if (action === "delete") {
      const { error } = await admin.from("coupons").delete().eq("id", body.id);
      if (error) return json({ error: error.message }, 400);
      return json({ deleted: true });
    }

    const code = String(body?.code || "").trim().toUpperCase();
    const discountPercent = Number(body?.discountPercent);
    const maxUses = body?.maxUses === "" || body?.maxUses == null ? null : Number(body.maxUses);
    if (!code || !/^[A-Z0-9_-]{2,32}$/.test(code)) return json({ error: "Coupon code must be 2-32 letters, numbers, underscores, or hyphens." }, 400);
    if (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100) return json({ error: "Discount must be between 1 and 100 percent." }, 400);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return json({ error: "Maximum uses must be a positive whole number." }, 400);

    const values = {
      code,
      discount_percent: discountPercent,
      challenge_types: challengeTypes,
      is_active: body?.isActive !== false,
      expires_at: body?.expiresAt || null,
      max_uses: maxUses,
    };
    const query = action === "update"
      ? admin.from("coupons").update(values).eq("id", body.id)
      : admin.from("coupons").insert(values);
    const { data, error } = await query.select("id, code, discount_percent, challenge_types, is_active, expires_at, max_uses, times_used, created_at, updated_at").single();
    if (error) return json({ error: error.message }, 400);
    return json({ coupon: data });
  } catch (error) {
    console.error("admin-coupon error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});