import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ChallengeType = "three_step" | "two_step" | "one_step" | "instant";

// Server-side source of truth for pricing (USD). Never trust client prices.
const PRICES: Record<number, Record<ChallengeType, number>> = {
  5000: { three_step: 16, two_step: 20, one_step: 18, instant: 18 },
  10000: { three_step: 28, two_step: 40, one_step: 34, instant: 34 },
  25000: { three_step: 56, two_step: 80, one_step: 62, instant: 62 },
  50000: { three_step: 144, two_step: 198, one_step: 153, instant: 153 },
  100000: { three_step: 320, two_step: 396, one_step: 342, instant: 342 },
  200000: { three_step: 490, two_step: 560, one_step: 520, instant: 520 },
};

const CHALLENGE_TYPES: ChallengeType[] = ["three_step", "two_step", "one_step", "instant"];
async function getNairaRate(): Promise<number> {
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`Exchange rate lookup failed [${res.status}]`);
  const body = await res.json();
  const rate = body?.rates?.NGN;
  if (!rate || typeof rate !== "number") {
    throw new Error("No exchange rate available for NGN");
  }
  return rate;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (!PAYSTACK_SECRET_KEY) {
      return json({ error: "Paystack is not configured yet." }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;
    const email = (claimsData.claims.email as string) || "customer@primepips.app";

    const body = await req.json().catch(() => null);
    const challengeType = body?.challengeType;
    const accountSize = Number(body?.accountSize);
    const paymentMethod = body?.paymentMethod === "other" ? "other" : "bank_transfer";
    const couponCode = typeof body?.couponCode === "string"
      ? body.couponCode.trim().toUpperCase().slice(0, 32)
      : challengeType === "one_step"
        ? "PRIME50"
        : null;
    const currency = "NGN";
    const redirectUrl = typeof body?.redirectUrl === "string" ? body.redirectUrl : null;
    const customerName = typeof body?.customerName === "string" && body.customerName.trim()
      ? body.customerName.trim().slice(0, 100)
      : email.split("@")[0];

    const errors: Record<string, string> = {};
    if (!CHALLENGE_TYPES.includes(challengeType)) errors.challengeType = "Invalid challenge type";
    if (!PRICES[accountSize]) errors.accountSize = "Invalid account size";
    if (!redirectUrl || !/^https?:\/\//.test(redirectUrl)) errors.redirectUrl = "Invalid redirect URL";
    if (Object.keys(errors).length > 0) {
      return json({ error: errors }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const basePriceUsd = PRICES[accountSize][challengeType as ChallengeType];

    // Validate the coupon server-side; never trust a client-supplied discount.
    let discountPercent = 0;
    let appliedCoupon: string | null = null;
    let couponId: string | null = null;
    let couponUses = 0;

    if (couponCode) {
      const couponQuery = await admin
        .from("coupons")
        .select("id, code, discount_percent, challenge_types, expires_at, max_uses, times_used")
        .eq("code", couponCode)
        .eq("is_active", true)
        .maybeSingle();

      const row = couponQuery.data;
      const invalidCoupon = json(
        { error: { couponCode: "This coupon code is not valid for this purchase." } },
        400,
      );

      if (!row) return invalidCoupon;
      if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return invalidCoupon;

      const uses = Number(row.times_used || 0);
      if (row.max_uses != null && uses >= Number(row.max_uses)) return invalidCoupon;

      const types = row.challenge_types;
      if (Array.isArray(types) && types.length > 0 && !types.includes(challengeType)) {
        return invalidCoupon;
      }

      discountPercent = Number(row.discount_percent);
      appliedCoupon = row.code;
      couponId = row.id;
      couponUses = uses;
    }

    const priceUsd = Math.round(basePriceUsd * (100 - discountPercent)) / 100;
    const rate = await getNairaRate();
    const localAmount = Math.ceil(priceUsd * rate);

    const reference = `pp_${crypto.randomUUID().replace(/-/g, "")}`;

    const { data: account, error: insertError } = await admin
      .from("accounts")
      .insert({
        user_id: userId,
        challenge_type: challengeType,
        account_size: accountSize,
        price: priceUsd,
        status: "pending_payment",
        current_balance: accountSize,
        payment_provider: "paystack",
        payment_reference: reference,
        payment_currency: currency,
        payment_amount_local: localAmount,
        coupon_code: appliedCoupon,
        discount_percent: discountPercent,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create pending account:", insertError.message);
      return json({ error: "Could not start checkout. Please try again." }, 500);
    }

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference,
        amount: localAmount * 100,
        currency,
        callback_url: redirectUrl,
        channels: paymentMethod === "bank_transfer"
          ? ["bank_transfer"]
          : ["card", "ussd", "mobile_money", "bank_transfer", "bank"],
        email,
        metadata: {
          account_id: account.id,
          user_id: userId,
          price_usd: String(priceUsd),
          customer_name: customerName,
        },
      }),
    });

    const paystackBody = await paystackRes.text();
    if (!paystackRes.ok) {
      console.error(`Paystack initialize failed [${paystackRes.status}]: ${paystackBody}`);
      await admin.from("accounts").delete().eq("id", account.id).eq("status", "pending_payment");
      return json(
        { error: "Payment provider request failed", status: paystackRes.status, details: paystackBody },
        paystackRes.status,
      );
    }

    const parsed = JSON.parse(paystackBody);
    if (parsed?.status !== true || !parsed?.data?.authorization_url) {
      console.error("Paystack returned an unsuccessful payload:", paystackBody);
      await admin.from("accounts").delete().eq("id", account.id).eq("status", "pending_payment");
      return json({ error: parsed?.message || "Payment provider error", details: paystackBody }, 502);
    }

    if (couponId) {
      await admin.from("coupons").update({ times_used: couponUses + 1 }).eq("id", couponId);
    }

    return json({
      checkoutUrl: parsed.data.authorization_url,
      reference,
      accountId: account.id,
      currency,
      localAmount,
      priceUsd,
    });
  } catch (error) {
    console.error("paystack-checkout error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});