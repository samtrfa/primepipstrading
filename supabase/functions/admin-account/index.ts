import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const challengeTypes = ["three_step", "two_step", "one_step", "instant"] as const;
const accountSizes = [5000, 10000, 25000, 50000, 100000, 200000] as const;
const accountStatuses = ["pending_payment", "active", "failed", "passed", "funded"] as const;

type ChallengeType = (typeof challengeTypes)[number];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const token = authorization.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || claimsData?.claims?.app_metadata?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: target, error: targetError } = await admin.auth.admin.getUserById(body.userId);
    if (targetError || !target.user) return json({ error: "User not found" }, 404);
    if (target.user.app_metadata?.role === "admin") return json({ error: "Accounts cannot be granted to admins" }, 400);

    if (body.action === "delete-user") {
      const { data: accountsToDelete, error: accountLookupError } = await admin.from("accounts").select("id").eq("user_id", body.userId);
      if (accountLookupError) return json({ error: "Could not verify trader accounts" }, 500);
      const accountIds = (accountsToDelete ?? []).map((account) => account.id);
      if (accountIds.length) {
        const { count, error: payoutError } = await admin.from("payout_requests").select("id", { count: "exact", head: true }).in("account_id", accountIds);
        if (payoutError) return json({ error: "Could not verify account payout history" }, 500);
        if ((count ?? 0) > 0) return json({ error: "This trader has an account with payout history and cannot be deleted" }, 409);
        const { error: accountDeleteError } = await admin.from("accounts").delete().eq("user_id", body.userId);
        if (accountDeleteError) return json({ error: "Could not delete trader accounts" }, 500);
      }
      const { error: deleteError } = await admin.auth.admin.deleteUser(body.userId);
      if (deleteError) {
        console.error("Could not delete trader:", deleteError.message);
        return json({ error: "Could not delete trader" }, 500);
      }
      return json({ deleted: true, userId: body.userId });
    }

    if (body.action === "delete") {
      if (typeof body.accountId !== "string" || typeof body.userId !== "string") return json({ error: "Invalid account details" }, 400);

      const { count, error: payoutError } = await admin.from("payout_requests").select("id", { count: "exact", head: true }).eq("account_id", body.accountId);
      if (payoutError) return json({ error: "Could not verify account payout history" }, 500);
      if ((count ?? 0) > 0) return json({ error: "Accounts with payout requests cannot be deleted" }, 409);

      const { error: accountError } = await admin.from("accounts").delete().eq("id", body.accountId).eq("user_id", body.userId);
      if (accountError) {
        console.error("Could not delete account:", accountError.message);
        return json({ error: "Could not delete account" }, 500);
      }
      return json({ deleted: true, accountId: body.accountId });
    }

    if (body.action === "update") {
      if (typeof body.accountId !== "string" || typeof body.userId !== "string" ||
        !challengeTypes.includes(body.challengeType as ChallengeType) ||
        !accountSizes.includes(body.accountSize) || !accountStatuses.includes(body.status) ||
        (body.currentPhase !== null && (!Number.isInteger(body.currentPhase) || body.currentPhase < 1 || body.currentPhase > 3)) ||
        typeof body.currentBalance !== "number" || !Number.isFinite(body.currentBalance) ||
        typeof body.profitLoss !== "number" || !Number.isFinite(body.profitLoss)) {
        return json({ error: "Invalid account details" }, 400);
      }

      const { data: account, error: accountError } = await admin.from("accounts").update({
        user_id: body.userId,
        challenge_type: body.challengeType,
        account_size: body.accountSize,
        status: body.status,
        current_phase: body.currentPhase,
        current_balance: body.currentBalance,
        profit_loss: body.profitLoss,
      }).eq("id", body.accountId).select("id, user_id, account_size, challenge_type, status, current_balance, profit_loss, current_phase, updated_at, created_at").single();

      if (accountError) {
        console.error("Could not update account:", accountError.message);
        return json({ error: "Could not update account" }, 500);
      }
      return json({ account });
    }

    if (typeof body.userId !== "string" || !challengeTypes.includes(body.challengeType as ChallengeType) || !accountSizes.includes(body.accountSize)) {
      return json({ error: "Invalid account details" }, 400);
    }

    const { data: account, error: accountError } = await admin.from("accounts").insert({
      user_id: body.userId,
      challenge_type: body.challengeType,
      account_size: body.accountSize,
      price: 0,
      status: body.challengeType === "instant" ? "funded" : "active",
      current_balance: body.accountSize,
      current_phase: body.challengeType === "instant" ? null : 1,
    }).select("id, user_id, account_size, challenge_type, status, current_balance, profit_loss, current_phase, updated_at, created_at").single();

    if (accountError) {
      console.error("Could not grant account:", accountError.message);
      return json({ error: "Could not grant account" }, 500);
    }

    const { error: ledgerError } = await admin.from("payment_orders").insert({
      user_id: body.userId,
      account_id: account.id,
      provider: "admin",
      provider_reference: `grant-${account.id}`,
      amount: 0,
      currency: "USD",
      status: "granted",
      verified_at: new Date().toISOString(),
      provider_metadata: { granted_by_admin: true },
    });

    if (ledgerError) {
      await admin.from("accounts").delete().eq("id", account.id);
      console.error("Could not record granted account in billing:", ledgerError.message);
      return json({ error: "Could not record granted account" }, 500);
    }

    return json({ account });
  } catch (error) {
    console.error("admin-account error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
