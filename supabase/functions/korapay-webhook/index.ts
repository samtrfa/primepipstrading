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

    const { data: account, error: fetchError } = await admin
      .from("accounts")
      .select("id, status, challenge_type, price, payment_amount_local, created_at")
      .eq("payment_reference", reference)
      .maybeSingle();

    if (fetchError) {
      console.error("Failed to look up account:", fetchError.message);
      return json({ error: "Lookup failed" }, 500);
    }
    if (!account) {
      console.warn(`No account found for reference ${reference}`);
      return json({ received: true });
    }

    if (
      account.status === "pending_payment" &&
      Date.now() - new Date(account.created_at).getTime() > 30 * 60 * 1000
    ) {
      const { error: deleteError } = await admin
        .from("accounts")
        .delete()
        .eq("id", account.id)
        .eq("status", "pending_payment");
      if (deleteError) {
        console.error("Failed to remove expired payment:", deleteError.message);
        return json({ error: "Payment cleanup failed" }, 500);
      }
      return json({ received: true, activated: false, expired: true });
    }

    if (event === "charge.success") {
      const paidAmount = Number(payload?.data?.amount ?? 0) / 100;
      const expectedAmount = Number(account.payment_amount_local ?? 0);
      // Allow a small rounding tolerance on the collected amount
      if (expectedAmount > 0 && paidAmount < expectedAmount * 0.98) {
        console.error(`Underpayment for ${reference}: paid ${paidAmount}, expected ${expectedAmount}`);
        await admin.from("accounts").delete().eq("id", account.id).eq("status", "pending_payment");
        return json({ received: true, activated: false });
      }

      if (account.status === "pending_payment") {
        const { error: updateError } = await admin
          .from("accounts")
          .update({
            status: account.challenge_type === "instant" ? "funded" : "active",
            current_phase: account.challenge_type === "instant" ? null : 1,
          })
          .eq("id", account.id);
        if (updateError) {
          console.error("Failed to activate account:", updateError.message);
          return json({ error: "Activation failed" }, 500);
        }
        console.log(`Activated account ${account.id} via Paystack reference ${reference}`);
      }
      return json({ received: true, activated: true });
    }

    if (event === "charge.failed") {
      if (account.status === "pending_payment") {
        await admin.from("accounts").delete().eq("id", account.id);
      }
      return json({ received: true, activated: false });
    }

    console.log(`Ignoring Paystack event: ${event}`);
    return json({ received: true });
  } catch (error) {
    console.error("paystack-webhook error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});