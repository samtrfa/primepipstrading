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
    const couponType = body?.couponType === undefined ? "discount" : body.couponType;
    if (couponType !== "discount" && couponType !== "bogo") {
      return json({ error: "Coupon type must be discount or BOGO." }, 400);
    }

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
    const rawPayPercent = couponType === "bogo" ? Number(body?.payPercent) : null;
    const payPercent = rawPayPercent === null || !Number.isFinite(rawPayPercent)
      ? rawPayPercent
      : Math.round(rawPayPercent * 100) / 100;
    const discountPercent = couponType === "bogo" ? 100 - Number(payPercent) : Number(body?.discountPercent);
    const maxUses = body?.maxUses === "" || body?.maxUses == null ? null : Number(body.maxUses);
    if (!code || !/^[A-Z0-9_-]{2,32}$/.test(code)) return json({ error: "Coupon code must be 2-32 letters, numbers, underscores, or hyphens." }, 400);
    if (couponType === "discount" && (!Number.isFinite(discountPercent) || discountPercent <= 0 || discountPercent > 100)) {
      return json({ error: "Discount must be between 1 and 100 percent." }, 400);
    }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses < 1)) return json({ error: "Maximum uses must be a positive whole number." }, 400);

    const validChallengeTypes = ["three_step", "two_step", "one_step", "instant"];
    if (challengeTypes && (!challengeTypes.every((type: unknown) => validChallengeTypes.includes(String(type))))) {
      return json({ error: "One or more account types are invalid." }, 400);
    }

    let bonusChallengeType: string | null = null;
    let bonusSizeMode: string | null = null;
    let bonusAccountSize: number | null = null;
    if (couponType === "bogo") {
      if (
        !Number.isFinite(rawPayPercent) ||
        rawPayPercent! < 1 ||
        rawPayPercent! > 100 ||
        Math.abs(rawPayPercent! - Number(payPercent)) > 1e-9
      ) {
        return json({ error: "The amount paid must be between 1 and 100 percent, with up to two decimal places." }, 400);
      }
      if (!challengeTypes || challengeTypes.length !== 1) {
        return json({ error: "A BOGO coupon must apply to exactly one purchased account type." }, 400);
      }
      if (!validChallengeTypes.includes(String(body?.bonusChallengeType))) {
        return json({ error: "Select a valid bonus account type." }, 400);
      }
      bonusChallengeType = body.bonusChallengeType;
      bonusSizeMode = body?.bonusSizeMode;
      if (bonusSizeMode === "fixed") {
        bonusAccountSize = Number(body?.bonusAccountSize);
        if (![5000, 10000, 25000, 50000, 100000, 200000].includes(bonusAccountSize)) {
          return json({ error: "Select a valid fixed bonus account size." }, 400);
        }
      } else if (bonusSizeMode === "same_as_primary") {
        bonusSizeMode = "same_as_primary";
      } else {
        return json({ error: "Select whether the bonus account uses the purchased size or a fixed size." }, 400);
      }
    }

    const values = {
      code,
      discount_percent: discountPercent,
      challenge_types: challengeTypes,
      coupon_type: couponType,
      pay_percent: couponType === "bogo" ? payPercent : null,
      bonus_challenge_type: bonusChallengeType,
      bonus_size_mode: bonusSizeMode,
      bonus_account_size: bonusAccountSize,
      is_active: body?.isActive !== false,
      expires_at: body?.expiresAt || null,
      max_uses: maxUses,
    };
    const query = action === "update"
      ? admin.from("coupons").update(values).eq("id", body.id)
      : admin.from("coupons").insert(values);
    const { data, error } = await query.select("id, code, discount_percent, challenge_types, coupon_type, pay_percent, bonus_challenge_type, bonus_size_mode, bonus_account_size, is_active, expires_at, max_uses, times_used, created_at, updated_at").single();
    if (error) return json({ error: error.message }, 400);
    return json({ coupon: data });
  } catch (error) {
    console.error("admin-coupon error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});