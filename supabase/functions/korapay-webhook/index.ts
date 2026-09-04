import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createHmac } from "node:crypto";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
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
      console.error("PAYSTACK_SECRET_KEY is not configured");
      return json({ error: "Not configured" }, 500);
    }

    const raw = await req.text();
    const signature = req.headers.get("x-paystack-signature");
    if (!signature) {
      return json({ error: "Missing signature" }, 401);
    }

    const payload = JSON.parse(raw);
    const expected = createHmac("sha512", PAYSTACK_SECRET_KEY)
      .update(raw)
      .digest("hex");

    if (expected !== signature) {
      console.error("Invalid Paystack webhook signature");
      return json({ error: "Invalid signature" }, 401);
    }

    const event = payload.event as string;
    const reference = payload?.data?.reference as string | undefined;
    if (!reference) {
      return json({ error: "Missing reference" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const eventStatus = event === "charge.success" ? "success" : event === "charge.failed" ? "failed" : event === "refund.processed" ? "refunded" : "pending";
    const providerUserId = typeof payload?.data?.metadata?.user_id === "string" && /^[0-9a-f-]{36}$/i.test(payload.data.metadata.user_id)
      ? payload.data.metadata.user_id
      : null;
    const { data: result, error: reconcileError } = await admin.rpc("reconcile_paystack_payment", {
      p_reference: reference,
      p_status: eventStatus,
      p_amount: event === "refund.processed" ? null : Number(payload?.data?.amount ?? 0) / 100,
      p_currency: payload?.data?.currency || null,
      p_provider_user_id: providerUserId,
      p_metadata: { event, status: payload?.data?.status, gateway_response: payload?.data?.gateway_response, customer_code: payload?.data?.customer?.customer_code },
      p_source: "webhook",
      p_refund_amount: event === "refund.processed" ? Number(payload?.data?.amount ?? 0) / 100 : null,
      p_refund_reference: event === "refund.processed" ? String(payload?.data?.id || "") : null,
    });
    if (reconcileError) throw reconcileError;
    return json({ received: true, ...result });
  } catch (error) {
    console.error("paystack-webhook error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});