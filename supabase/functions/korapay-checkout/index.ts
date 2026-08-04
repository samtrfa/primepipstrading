import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const KORAPAY_SECRET_KEY = Deno.env.get("KORAPAY_SECRET_KEY");
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
// Currencies Korapay can collect in
const SUPPORTED_CURRENCIES = ["NGN", "KES", "GHS", "ZAR", "USD"];

async function getUsdRate(currency: string): Promise<number> {
  if (currency === "USD") return 1;
  const res = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!res.ok) throw new Error(`Exchange rate lookup failed [${res.status}]`);
  const body = await res.json();
  const rate = body?.rates?.[currency];
  if (!rate || typeof rate !== "number") {
    throw new Error(`No exchange rate available for ${currency}`);
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
    if (!KORAPAY_SECRET_KEY) {
      return json({ error: "Korapay is not configured yet." }, 500);
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
    const currency = String(body?.currency || "USD").toUpperCase();
    const redirectUrl = typeof body?.redirectUrl === "string" ? body.redirectUrl : null;
    const customerName = typeof body?.customerName === "string" && body.customerName.trim()
      ? body.customerName.trim().slice(0, 100)
      : email.split("@")[0];

    const errors: Record<string, string> = {};
    if (!CHALLENGE_TYPES.includes(challengeType)) errors.challengeType = "Invalid challenge type";
    if (!PRICES[accountSize]) errors.accountSize = "Invalid account size";
    if (!SUPPORTED_CURRENCIES.includes(currency)) errors.currency = "Unsupported currency";
    if (!redirectUrl || !/^https?:\/\//.test(redirectUrl)) errors.redirectUrl = "Invalid redirect URL";
    if (Object.keys(errors).length > 0) {
      return json({ error: errors }, 400);
    }

    const priceUsd = PRICES[accountSize][challengeType as ChallengeType];
    const rate = await getUsdRate(currency);
    // Korapay expects minor-unit-free decimals; round sensibly per currency
    const localAmount = currency === "USD"
      ? Number(priceUsd.toFixed(2))
      : Math.ceil(priceUsd * rate);

    const reference = `pp_${crypto.randomUUID().replace(/-/g, "")}`;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: account, error: insertError } = await admin
      .from("accounts")
      .insert({
        user_id: userId,
        challenge_type: challengeType,
        account_size: accountSize,
        price: priceUsd,
        status: "pending_payment",
        current_balance: accountSize,
        payment_provider: "korapay",
        payment_reference: reference,
        payment_currency: currency,
        payment_amount_local: localAmount,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to create pending account:", insertError.message);
      return json({ error: "Could not start checkout. Please try again." }, 500);
    }

    const notificationUrl = `${SUPABASE_URL}/functions/v1/korapay-webhook`;

    const koraRes = await fetch("https://api.korapay.com/merchant/api/v1/charges/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KORAPAY_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reference,
        amount: localAmount,
        currency,
        redirect_url: redirectUrl,
        notification_url: notificationUrl,
        narration: `PrimePips ${challengeType.replace(/_/g, " ")} ${accountSize} USD account`
          .replace(/[^a-zA-Z0-9 ]/g, "")
          .slice(0, 100),
        // Restrict checkout to bank-based payment methods only.
        channels: ["bank_transfer", "pay_with_bank"],
        customer: { name: customerName, email },
        metadata: {
          account_id: account.id,
          user_id: userId,
          price_usd: String(priceUsd),
        },
      }),
    });

    const koraBody = await koraRes.text();
    if (!koraRes.ok) {
      console.error(`Korapay initialize failed [${koraRes.status}]: ${koraBody}`);
      await admin.from("accounts").update({ status: "failed" }).eq("id", account.id);
      return json(
        { error: "Payment provider request failed", status: koraRes.status, details: koraBody },
        koraRes.status,
      );
    }

    const parsed = JSON.parse(koraBody);
    if (parsed?.status !== true || !parsed?.data?.checkout_url) {
      console.error("Korapay returned an unsuccessful payload:", koraBody);
      await admin.from("accounts").update({ status: "failed" }).eq("id", account.id);
      return json({ error: parsed?.message || "Payment provider error", details: koraBody }, 502);
    }

    return json({
      checkoutUrl: parsed.data.checkout_url,
      reference,
      accountId: account.id,
      currency,
      localAmount,
      priceUsd,
    });
  } catch (error) {
    console.error("korapay-checkout error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});