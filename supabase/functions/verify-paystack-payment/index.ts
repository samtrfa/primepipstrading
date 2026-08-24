import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => null);
    const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
    if (!/^pp_[a-f0-9]{32}$/.test(reference)) {
      return json({ error: "Invalid payment reference" }, 400);
    }

    const userId = claimsData.claims.sub as string;
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: account, error: accountError } = await admin
      .from("accounts")
      .select("id, user_id, status, challenge_type, payment_amount_local, created_at")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (accountError) {
      console.error("Failed to look up payment account:", accountError.message);
      return json({ error: "Lookup failed" }, 500);
    }
    if (!account || account.user_id !== userId) {
      return json({ error: "Payment not found" }, 404);
    }

    if (
      account.status === "pending_payment" &&
      Date.now() - new Date(account.created_at).getTime() > 30 * 60 * 1000
    ) {
      const { error: expireError } = await admin
        .from("accounts")
        .update({ status: "failed" })
        .eq("id", account.id)
        .eq("status", "pending_payment");
      if (expireError) {
        console.error("Failed to mark expired payment:", expireError.message);
        return json({ error: "Payment cleanup failed" }, 500);
      }
      return json({ verified: false, activated: false, expired: true });
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const paystackBody = await paystackResponse.json().catch(() => null);
    const transaction = paystackBody?.data;
    if (!paystackResponse.ok || !transaction) {
      console.error("Paystack verification failed:", paystackBody);
      return json({ error: "Payment verification is temporarily unavailable" }, 502);
    }

    const paidAmount = Number(transaction?.amount ?? 0) / 100;
    const expectedAmount = Number(account.payment_amount_local ?? 0);
    const paidInFull = expectedAmount > 0 && paidAmount >= expectedAmount * 0.98;
    const successful = transaction.status === "success" && paidInFull;

    if (successful) {
      if (account.status === "pending_payment") {
        const { error: activateError } = await admin
          .from("accounts")
          .update({
            status: account.challenge_type === "instant" ? "funded" : "active",
            current_phase: account.challenge_type === "instant" ? null : 1,
          })
          .eq("id", account.id)
          .eq("status", "pending_payment");
        if (activateError) {
          console.error("Failed to activate account:", activateError.message);
          return json({ error: "Activation failed" }, 500);
        }
      }
      return json({ verified: true, activated: true });
    }

    if (account.status === "pending_payment") {
      const { error: failureError } = await admin
        .from("accounts")
        .update({ status: "failed" })
        .eq("id", account.id)
        .eq("status", "pending_payment");
      if (failureError) {
        console.error("Failed to mark unsuccessful payment:", failureError.message);
        return json({ error: "Payment cleanup failed" }, 500);
      }
    }

    return json({ verified: false, activated: false });
  } catch (error) {
    console.error("verify-paystack-payment error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
