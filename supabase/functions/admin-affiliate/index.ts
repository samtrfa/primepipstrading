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
    if (typeof body.userId !== "string" || typeof body.affiliate !== "boolean") return json({ error: "Invalid request" }, 400);
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.userId);
    if (targetError || !target.user) return json({ error: "User not found" }, 404);
    if (target.user.app_metadata?.role === "admin") return json({ error: "Admin status cannot be changed here" }, 400);
    const { error: updateError } = await admin.auth.admin.updateUserById(body.userId, { app_metadata: { ...target.user.app_metadata, affiliate: body.affiliate } });
    if (updateError) return json({ error: "Could not update affiliate status" }, 500);
    return json({ affiliate: body.affiliate });
  } catch (error) {
    console.error("admin-affiliate error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
