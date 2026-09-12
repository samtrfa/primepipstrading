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

async function supabaseRest<T>(path: string, method: string, token: string, body?: unknown, query = ""): Promise<T> {
  const url = new URL(`${supabaseUrl}/rest/v1/${path}`);
  if (query) url.search = query;

  const response = await fetch(url.toString(), {
    method,
    headers: {
      apikey: token,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.message ?? json?.error ?? `Request failed with status ${response.status}`;
    throw new Error(String(message));
  }

  return json as T;
}

async function getVerifiedUser(token: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.message ?? "Invalid session";
    throw new Error(String(message));
  }

  return json;
}

async function getUserById(userId: string) {
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: "application/json",
    },
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.message ?? "User not found";
    throw new Error(String(message));
  }

  return json;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const token = authorization.replace("Bearer ", "");
    const sessionUser = await getVerifiedUser(token);
    if (sessionUser?.app_metadata?.role !== "admin") return json({ error: "Forbidden" }, 403);

    const body = await req.json();
    const action = typeof body?.action === "string" ? body.action : null;
    if (!action) return json({ error: "Action required" }, 400);

    const hasUserId = typeof body.userId === "string" && body.userId.length > 0;

    if (action !== "delete-archived" && !hasUserId) return json({ error: "Invalid user details" }, 400);
    if (hasUserId) {
      const target = await getUserById(body.userId);
      const targetUser = target?.user ?? target;
      if (!targetUser) return json({ error: "User not found" }, 404);
      if (targetUser.app_metadata?.role === "admin") return json({ error: "Accounts cannot be granted to admins" }, 400);
    }

    if (body.action === "delete-user") {
      const accountsToDelete = await supabaseRest<Array<{ id: string }>>("accounts", "GET", serviceRoleKey, undefined, `select=id&user_id=eq.${encodeURIComponent(body.userId)}&archived_at=is.null`);
      const accountIds = (accountsToDelete ?? []).map((account) => account.id);
      if (accountIds.length) {
        const archiveExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseRest("accounts", "PATCH", serviceRoleKey, {
          archived_at: new Date().toISOString(),
          archive_expires_at: archiveExpiresAt,
        }, `user_id=eq.${encodeURIComponent(body.userId)}&archived_at=is.null`);
      }
      return json({ archived: true, userId: body.userId });
    }

    if (body.action === "delete") {
      if (typeof body.accountId !== "string" || typeof body.userId !== "string") return json({ error: "Invalid account details" }, 400);

      const archiveExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabaseRest("accounts", "PATCH", serviceRoleKey, {
        archived_at: new Date().toISOString(),
        archive_expires_at: archiveExpiresAt,
      }, `id=eq.${encodeURIComponent(body.accountId)}&user_id=eq.${encodeURIComponent(body.userId)}&archived_at=is.null`);
      return json({ deleted: true, archived: true, archiveExpiresAt, accountId: body.accountId });
    }

    if (body.action === "delete-archived") {
      if (typeof body.accountId !== "string") return json({ error: "Invalid account details" }, 400);

      let query = `id=eq.${encodeURIComponent(body.accountId)}&archived_at=is.not.null`;
      if (typeof body.userId === "string" && body.userId.length > 0) {
        query += `&user_id=eq.${encodeURIComponent(body.userId)}`;
      }

      const deletedRows = await supabaseRest<Array<{ id: string }>>("accounts", "DELETE", serviceRoleKey, undefined, query);
      const account = deletedRows?.[0] ?? null;

      if (!account) return json({ error: "Archived account not found or it is not eligible for permanent deletion" }, 404);

      return json({ deleted: true, accountId: body.accountId });
    }

    if (body.action === "restore") {
      if (typeof body.accountId !== "string" || typeof body.userId !== "string") return json({ error: "Invalid account details" }, 400);

      const account = await supabaseRest<Array<Record<string, unknown>>>("accounts", "PATCH", serviceRoleKey, {
        archived_at: null,
        archive_expires_at: null,
      }, `id=eq.${encodeURIComponent(body.accountId)}&user_id=eq.${encodeURIComponent(body.userId)}&archived_at=is.not.null&archive_expires_at=gt.${encodeURIComponent(new Date().toISOString())}&select=id,user_id,account_size,challenge_type,status,current_balance,profit_loss,current_phase,archived_at,archive_expires_at,updated_at,created_at`);
      const restored = Array.isArray(account) ? account[0] : null;
      if (!restored) return json({ error: "The archive has expired or the account was not found" }, 404);
      return json({ account: restored, restored: true });
    }

    if (body.action === "reset") {
      if (typeof body.accountId !== "string" || typeof body.userId !== "string") return json({ error: "Invalid account details" }, 400);

      const rpcQuery = new URLSearchParams({ p_account_id: body.accountId, p_user_id: body.userId });
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_reset_account?${rpcQuery.toString()}`, {
        method: "POST",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      });
      const text = await response.text();
      const jsonBody = text ? JSON.parse(text) : null;
      if (!response.ok) {
        const message = jsonBody?.message ?? jsonBody?.error ?? "Could not reset account";
        return json({ error: message === "Account not found" ? message : "Could not reset account" }, message === "Account not found" ? 404 : 500);
      }
      return json({ account: jsonBody });
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

      const account = await supabaseRest<Array<Record<string, unknown>>>("accounts", "PATCH", serviceRoleKey, {
        user_id: body.userId,
        challenge_type: body.challengeType,
        account_size: body.accountSize,
        status: body.status,
        current_phase: body.currentPhase,
        current_balance: body.currentBalance,
        profit_loss: body.profitLoss,
      }, `id=eq.${encodeURIComponent(body.accountId)}&select=id,user_id,account_size,challenge_type,status,current_balance,profit_loss,current_phase,updated_at,created_at`);
      const updated = Array.isArray(account) ? account[0] : null;
      if (!updated) return json({ error: "Could not update account" }, 500);
      return json({ account: updated });
    }

    if (typeof body.userId !== "string" || !challengeTypes.includes(body.challengeType as ChallengeType) || !accountSizes.includes(body.accountSize)) {
      return json({ error: "Invalid account details" }, 400);
    }

    const account = await supabaseRest<Array<Record<string, unknown>>>("accounts", "POST", serviceRoleKey, {
      user_id: body.userId,
      challenge_type: body.challengeType,
      account_size: body.accountSize,
      price: 0,
      status: body.challengeType === "instant" ? "funded" : "active",
      current_balance: body.accountSize,
      current_phase: body.challengeType === "instant" ? null : 1,
    }, "select=id,user_id,account_size,challenge_type,status,current_balance,profit_loss,current_phase,updated_at,created_at");
    const inserted = Array.isArray(account) ? account[0] : null;
    if (!inserted) return json({ error: "Could not grant account" }, 500);

    const ledgerResult = await supabaseRest("payment_orders", "POST", serviceRoleKey, {
      user_id: body.userId,
      account_id: inserted.id,
      provider: "admin",
      provider_reference: `grant-${inserted.id}`,
      amount: 0,
      currency: "USD",
      status: "granted",
      verified_at: new Date().toISOString(),
      provider_metadata: { granted_by_admin: true },
    });

    if (!ledgerResult) {
      await supabaseRest("accounts", "DELETE", serviceRoleKey, undefined, `id=eq.${encodeURIComponent(String(inserted.id))}`);
      return json({ error: "Could not record granted account" }, 500);
    }

    return json({ account: inserted });
  } catch (error) {
    console.error("admin-account error:", error);
    return json({ error: "Unexpected error" }, 500);
  }
});
