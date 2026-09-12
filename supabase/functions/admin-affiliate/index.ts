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
    const admin = createClient(supabaseUrl, serviceRoleKey);

    if (body.action === "update-code") {
      if (typeof body.userId !== "string" || typeof body.code !== "string" || typeof body.discountPercent !== "number" || typeof body.isActive !== "boolean") {
        return json({ error: "Invalid affiliate code update" }, 400);
      }
      const code = body.code.trim().toUpperCase();
      if (!/^[A-Z0-9]{6,8}$/.test(code) || body.discountPercent < 0 || body.discountPercent > 100) {
        return json({ error: "Invalid affiliate code or discount" }, 400);
      }
      const { data: conflict } = await admin.from("affiliate_codes").select("user_id").eq("code", code).neq("user_id", body.userId).maybeSingle();
      if (conflict) return json({ error: "This affiliate code is already in use" }, 409);
      const { data, error } = await admin.from("affiliate_codes").upsert({ user_id: body.userId, code, discount_percent: body.discountPercent, is_active: body.isActive }, { onConflict: "user_id" }).select("id, user_id, code, discount_percent, is_active, created_at").single();
      if (error) return json({ error: "Could not update affiliate code" }, 500);
      return json({ affiliateCode: data });
    }

    if (body.action === "review") {
      if (typeof body.applicationId !== "string" || !["approved", "rejected"].includes(body.status)) {
        return json({ error: "Invalid review request" }, 400);
      }
      const { data: application, error: applicationError } = await admin
        .from("affiliate_applications")
        .select("id, user_id, desired_code, status")
        .eq("id", body.applicationId)
        .single();
      if (applicationError || !application) return json({ error: "Application not found" }, 404);
      if (application.status !== "pending") return json({ error: "This application has already been reviewed" }, 400);

      if (body.status === "rejected") {
        const { error } = await admin.from("affiliate_applications").update({
          status: "rejected",
          rejection_reason: typeof body.rejectionReason === "string" ? body.rejectionReason.trim().slice(0, 500) : null,
          reviewed_at: new Date().toISOString(),
        }).eq("id", application.id);
        if (error) return json({ error: "Could not reject application" }, 500);
        return json({ status: "rejected" });
      }

      const code = String(application.desired_code).toUpperCase();
      if (!/^[A-Z0-9]{6,8}$/.test(code)) return json({ error: "The requested affiliate code is invalid" }, 400);
      const [{ data: existingAffiliate }, { data: existingCoupon }] = await Promise.all([
        admin.from("affiliate_codes").select("user_id").eq("code", code).maybeSingle(),
        admin.from("coupons").select("id").eq("code", code).maybeSingle(),
      ]);
      if (existingAffiliate && existingAffiliate.user_id !== application.user_id) return json({ error: "This affiliate code is already in use" }, 409);
      if (existingCoupon && !(code === "SHAKER" && application.user_id === (await admin.auth.admin.getUserByEmail("utiungmathias7@gmail.com")).data.user?.id)) {
        return json({ error: "This code is already used by a purchase coupon" }, 409);
      }

      const { error: codeError } = await admin.from("affiliate_codes").upsert({ user_id: application.user_id, code }, { onConflict: "user_id" });
      if (codeError) return json({ error: "Could not assign affiliate code" }, 500);
      const { data: target, error: targetError } = await admin.auth.admin.getUserById(application.user_id);
      if (targetError || !target.user) return json({ error: "User not found" }, 404);
      const { error: updateError } = await admin.auth.admin.updateUserById(application.user_id, { app_metadata: { ...target.user.app_metadata, affiliate: true } });
      if (updateError) return json({ error: "Could not update affiliate status" }, 500);
      const { error: applicationUpdateError } = await admin.from("affiliate_applications").update({ status: "approved", reviewed_at: new Date().toISOString() }).eq("id", application.id);
      if (applicationUpdateError) return json({ error: "Could not approve application" }, 500);
      return json({ status: "approved", code });
    }

    if (typeof body.userId !== "string" || typeof body.affiliate !== "boolean") return json({ error: "Invalid request" }, 400);
    const requestedCode = typeof body.code === "string" ? body.code.trim().toUpperCase() : null;
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.userId);
    if (targetError || !target.user) return json({ error: "User not found" }, 404);
    if (target.user.app_metadata?.role === "admin") return json({ error: "Admin status cannot be changed here" }, 400);

    if (body.affiliate) {
      if (!requestedCode) return json({ error: "A code is required before granting affiliate access" }, 400);
      if (!/^[A-Z0-9]{6,8}$/.test(requestedCode)) return json({ error: "Affiliate code must be 6-8 letters or numbers" }, 400);

      const [{ data: existingAffiliate }, { data: existingCoupon }] = await Promise.all([
        admin.from("affiliate_codes").select("user_id").eq("code", requestedCode).maybeSingle(),
        admin.from("coupons").select("id").eq("code", requestedCode).maybeSingle(),
      ]);
      if (existingAffiliate && existingAffiliate.user_id !== body.userId) return json({ error: "This affiliate code is already in use" }, 409);
      if (existingCoupon) return json({ error: "This code is already used by a purchase coupon" }, 409);

      const { error: affiliateCodeError } = await admin.from("affiliate_codes").upsert({
        user_id: body.userId,
        code: requestedCode,
        discount_percent: Number.isFinite(Number(body.discountPercent)) ? Number(body.discountPercent) : 10,
        is_active: body.isActive === undefined ? true : Boolean(body.isActive),
      }, { onConflict: "user_id" });
      if (affiliateCodeError) return json({ error: "Could not assign affiliate code" }, 500);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(body.userId, { app_metadata: { ...target.user.app_metadata, affiliate: body.affiliate } });
    if (updateError) return json({ error: "Could not update affiliate status" }, 500);
    return json({ affiliate: body.affiliate, code: requestedCode || null });
  } catch (error) {
    console.error("admin-affiliate error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
