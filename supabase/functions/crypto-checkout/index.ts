import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WALLET_ADDRESS = "0x66aeC4645A4d204653d2e62FCA26968Ce1B5db1a";

type ChallengeType = "three_step" | "two_step" | "one_step" | "instant";
const CHALLENGE_TYPES: ChallengeType[] = ["three_step", "two_step", "one_step", "instant"];
const PRICES: Record<number, Record<ChallengeType, number>> = {
  5000: { three_step: 16, two_step: 20, one_step: 18, instant: 18 },
  10000: { three_step: 28, two_step: 40, one_step: 34, instant: 34 },
  25000: { three_step: 56, two_step: 80, one_step: 62, instant: 62 },
  50000: { three_step: 144, two_step: 198, one_step: 153, instant: 153 },
  100000: { three_step: 320, two_step: 396, one_step: 342, instant: 342 },
  200000: { three_step: 490, two_step: 560, one_step: 520, instant: 520 },
};

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
    if (claimsError || !claimsData?.claims?.sub) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => null);
    const challengeType = body?.challengeType as ChallengeType;
    const accountSize = Number(body?.accountSize);
    const couponCode = typeof body?.couponCode === "string"
      ? body.couponCode.trim().toUpperCase().slice(0, 32)
      : null;
    if (!CHALLENGE_TYPES.includes(challengeType) || !PRICES[accountSize]) {
      return json({ error: "Invalid account details" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let discountPercent = 0;
    let appliedCoupon: string | null = null;
    if (couponCode) {
      const { data: coupon } = await admin.from("coupons")
        .select("code, discount_percent, challenge_types, expires_at, max_uses, times_used")
        .eq("code", couponCode).eq("is_active", true).maybeSingle();
      let row = coupon;
      if (!row) {
        const { data: affiliate } = await admin.from("affiliate_codes")
          .select("code, discount_percent, is_active")
          .eq("code", couponCode).eq("is_active", true).maybeSingle();
        row = affiliate ? { ...affiliate, challenge_types: null, expires_at: null, max_uses: null, times_used: 0 } : null;
      }
      if (!row || (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) ||
        (row.max_uses != null && Number(row.times_used || 0) >= Number(row.max_uses)) ||
        (Array.isArray(row.challenge_types) && row.challenge_types.length > 0 && !row.challenge_types.includes(challengeType))) {
        return json({ error: { couponCode: "This coupon code is not valid for this purchase." } }, 400);
      }
      discountPercent = Number(row.discount_percent);
      appliedCoupon = row.code;
    }

    const price = Math.round(PRICES[accountSize][challengeType] * (100 - discountPercent)) / 100;
    const userId = claimsData.claims.sub as string;
    const reference = `crypto_${crypto.randomUUID().replace(/-/g, "")}`;
    const { data: account, error: accountError } = await admin.from("accounts").insert({
      user_id: userId,
      challenge_type: challengeType,
      account_size: accountSize,
      price,
      status: "pending_payment",
      current_balance: accountSize,
      current_phase: challengeType === "instant" ? null : 1,
      payment_provider: "crypto",
      payment_reference: reference,
      payment_currency: "USD",
      payment_amount_local: price,
      payment_address: WALLET_ADDRESS,
      coupon_code: appliedCoupon,
      discount_percent: discountPercent,
    }).select("id").single();
    if (accountError) {
      console.error("Failed to create crypto account:", accountError.message);
      return json({ error: "Could not start crypto checkout" }, 500);
    }

    const { error: paymentError } = await admin.from("payment_orders").insert({
      user_id: userId,
      account_id: account.id,
      provider: "crypto",
      provider_reference: reference,
      amount: price,
      currency: "USD",
      status: "pending",
      provider_metadata: { challenge_type: challengeType, account_size: accountSize, wallet_address: WALLET_ADDRESS },
    });
    if (paymentError) {
      await admin.from("accounts").delete().eq("id", account.id).eq("status", "pending_payment");
      console.error("Failed to create crypto payment order:", paymentError.message);
      return json({ error: "Could not start crypto checkout" }, 500);
    }

    return json({ accountId: account.id, reference, walletAddress: WALLET_ADDRESS, amount: price, currency: "USD" });
  } catch (error) {
    console.error("crypto-checkout error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
