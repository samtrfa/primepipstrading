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
    const { data: payment, error: accountError } = await admin
      .from("payment_orders")
      .select("id, user_id, account_id, provider_reference, amount, currency")
      .eq("provider", "paystack")
      .eq("provider_reference", reference)
      .maybeSingle();

    if (accountError) {
      console.error("Failed to look up payment account:", accountError.message);
      return json({ error: "Lookup failed" }, 500);
    }
    if (!payment || payment.user_id !== userId) {
      return json({ error: "Payment not found" }, 404);
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
    const providerUserId = typeof transaction?.metadata?.user_id === "string" && /^[0-9a-f-]{36}$/i.test(transaction.metadata.user_id) ? transaction.metadata.user_id : null;
    const { data: result, error: reconcileError } = await admin.rpc("reconcile_paystack_payment", {
      p_reference: reference,
      p_status: transaction.status === "success" ? "success" : transaction.status === "failed" ? "failed" : "pending",
      p_amount: paidAmount,
      p_currency: transaction.currency || null,
      p_provider_user_id: providerUserId,
      p_metadata: { status: transaction.status, gateway_response: transaction.gateway_response, channel: transaction.channel, transaction_id: transaction.id },
      p_source: "verification",
    });
    if (reconcileError) throw reconcileError;
    return json({ verified: result?.status === "success", ...result });
  } catch (error) {
    console.error("verify-paystack-payment error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
