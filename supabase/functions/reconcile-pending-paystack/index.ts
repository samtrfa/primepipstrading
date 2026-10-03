import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const CRON_SECRET = Deno.env.get("PAYSTACK_RECONCILIATION_CRON_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!CRON_SECRET || req.headers.get("Authorization") !== `Bearer ${CRON_SECRET}`) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!PAYSTACK_SECRET_KEY) {
    console.error("PAYSTACK_SECRET_KEY is not configured");
    return json({ error: "Not configured" }, 500);
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: payments, error: claimError } = await admin.rpc(
    "claim_pending_paystack_payments",
    { p_limit: BATCH_SIZE },
  );
  if (claimError) {
    console.error("Failed to claim pending Paystack payments:", claimError.message);
    return json({ error: "Could not claim pending payments" }, 500);
  }

  const results = {
    checked: 0,
    success: 0,
    failed: 0,
    pending: 0,
    unmatched: 0,
    errors: [] as string[],
  };

  for (const payment of payments ?? []) {
    results.checked += 1;

    try {
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(payment.provider_reference)}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
      );
      const body = await response.json().catch(() => null);
      const transaction = body?.data;
      if (!response.ok || !transaction || typeof transaction.status !== "string") {
        console.error("Paystack verification failed for pending payment:", payment.provider_reference, body);
        results.errors.push(payment.provider_reference);
        continue;
      }

      const providerStatus = transaction.status.toLowerCase();
      const reconciliationStatus = providerStatus === "success"
        ? "success"
        : ["failed", "abandoned", "cancelled", "expired"].includes(providerStatus)
          ? "failed"
          : "pending";
      const providerUserId =
        typeof transaction.metadata?.user_id === "string" &&
          /^[0-9a-f-]{36}$/i.test(transaction.metadata.user_id)
          ? transaction.metadata.user_id
          : null;

      const { data: reconciliation, error: reconciliationError } = await admin.rpc(
        "reconcile_paystack_payment",
        {
          p_reference: payment.provider_reference,
          p_status: reconciliationStatus,
          p_amount: Number(transaction.amount ?? 0) / 100,
          p_currency: transaction.currency || null,
          p_provider_user_id: providerUserId,
          p_metadata: {
            status: providerStatus,
            gateway_response: transaction.gateway_response,
            channel: transaction.channel,
            transaction_id: transaction.id,
          },
          p_source: "verification",
        },
      );

      if (reconciliationError) {
        console.error("Could not reconcile Paystack payment:", payment.provider_reference, reconciliationError.message);
        results.errors.push(payment.provider_reference);
        continue;
      }

      const status = reconciliation?.status;
      if (status === "success" || status === "failed" || status === "pending" || status === "unmatched") {
        results[status] += 1;
      } else {
        console.error("Unexpected Paystack reconciliation result:", payment.provider_reference, reconciliation);
        results.errors.push(payment.provider_reference);
      }
    } catch (error) {
      console.error("Unexpected error verifying Paystack payment:", payment.provider_reference, error);
      results.errors.push(payment.provider_reference);
    }
  }

  return json(results, results.errors.length > 0 ? 502 : 200);
});
