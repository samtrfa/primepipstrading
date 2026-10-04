import { createClient } from "npm:@supabase/supabase-js@2";
import { getTradingQuotes } from "../_shared/trading-prices.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const spreadPercent = 0.0005;
const forexSymbols = new Set([
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD", "USOIL", "US30", "US100", "US500",
]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

const getQuote = async (symbol: string) => {
  if (forexSymbols.has(symbol)) {
    const response = await fetch(`${supabaseUrl}/functions/v1/forex-prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ symbols: [symbol] }),
    });
    if (!response.ok) return null;
    const data = await response.json() as { prices?: Record<string, { bid: number; ask: number }> };
    const quote = data.prices?.[symbol];
    return quote && Number.isFinite(quote.bid) && Number.isFinite(quote.ask) ? quote : null;
  }

  const response = await fetch(`https://www.bitstamp.net/api/v2/ticker/${symbol.toLowerCase()}/`);
  if (!response.ok) return null;
  const data = await response.json();
  const last = Number(data.last);
  if (!Number.isFinite(last) || last <= 0) return null;
  const halfSpread = last * (spreadPercent / 2);
  return { bid: last - halfSpread, ask: last + halfSpread };
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
  const userToken = authorization.slice("Bearer ".length);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const admin = createClient(supabaseUrl, serviceRoleKey);

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser(userToken);
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);
    const isAdmin = userData.user.app_metadata?.role === "admin";

    const body = await req.json() as {
      action?: "place" | "close";
      accountId?: string;
      positionId?: string;
      assetId?: string;
      positionType?: "buy" | "sell";
      lotSize?: number;
      stopLoss?: number | null;
      takeProfit?: number | null;
      triggerAction?: "close" | "sl_hit" | "tp_hit";
      requestId?: string;
    };
    const requestId = body.requestId ?? crypto.randomUUID();
    if (body.action === "close" && body.triggerAction && !["close", "sl_hit", "tp_hit"].includes(body.triggerAction)) {
      return json({ error: "Invalid close action" }, 400);
    }

    if (body.action === "place") {
      if (!body.accountId || !body.assetId || !body.positionType || !Number.isFinite(body.lotSize) || body.lotSize <= 0) {
        return json({ error: "Invalid order" }, 400);
      }

      const { data: account } = await admin
        .from("accounts")
        .select("id, user_id")
        .eq("id", body.accountId)
        .maybeSingle();
      const { data: asset } = await admin
        .from("assets")
        .select("id, symbol, is_active")
        .eq("id", body.assetId)
        .maybeSingle();
      if (!account || account.user_id !== userData.user.id || !asset?.is_active) {
        return json({ error: "Account or asset is not available" }, 403);
      }

      const quote = await getQuote(asset.symbol);
      if (!quote) return json({ error: "Market price unavailable" }, 503);
      const entryPrice = body.positionType === "buy" ? quote.ask : quote.bid;
      const { data, error } = await admin.rpc("place_trade", {
        p_account_id: body.accountId,
        p_asset_id: body.assetId,
        p_position_type: body.positionType,
        p_lot_size: body.lotSize,
        p_entry_price: entryPrice,
        p_stop_loss: body.stopLoss ?? null,
        p_take_profit: body.takeProfit ?? null,
        p_request_id: requestId,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ position: data, entryPrice });
    }

    if (body.action === "close") {
      if (!body.accountId || !body.positionId) return json({ error: "Invalid position" }, 400);

      const { data: account } = await admin
        .from("accounts")
        .select("id, user_id")
        .eq("id", body.accountId)
        .maybeSingle();
      const { data: position } = await admin
        .from("positions")
        .select("id, account_id, position_type, stop_loss, take_profit, assets(symbol)")
        .eq("id", body.positionId)
        .eq("account_id", body.accountId)
        .maybeSingle();
      if (!account || (!isAdmin && account.user_id !== userData.user.id) || !position?.assets?.symbol) {
        return json({ error: "Position is not available" }, 403);
      }

      const quote = (await getTradingQuotes(
        supabaseUrl,
        serviceRoleKey,
        [position.assets.symbol],
      ))[position.assets.symbol];
      if (!quote) return json({ error: "Market price unavailable" }, 503);
      const exitPrice = position.position_type === "buy" ? quote.bid : quote.ask;
      const requestedAction = body.triggerAction ?? "close";
      let action = requestedAction;
      if (requestedAction === "sl_hit" || requestedAction === "tp_hit") {
        const stopTriggered = position.stop_loss !== null && (
          position.position_type === "buy"
            ? exitPrice <= position.stop_loss
            : exitPrice >= position.stop_loss
        );
        const targetTriggered = position.take_profit !== null && (
          position.position_type === "buy"
            ? exitPrice >= position.take_profit
            : exitPrice <= position.take_profit
        );
        if (!stopTriggered && !targetTriggered) {
          return json({ error: "SL/TP trigger is no longer valid at the current market price" }, 409);
        }
        action = stopTriggered ? "sl_hit" : "tp_hit";
      }

      const { data, error } = await admin.rpc("close_trade", {
        p_account_id: body.accountId,
        p_position_id: body.positionId,
        p_exit_price: exitPrice,
        p_action: action,
        p_request_id: requestId,
      });
      if (error) return json({ error: error.message }, 400);
      return json({ ...data, exitPrice, action });
    }

    return json({ error: "Unsupported action" }, 400);
  } catch (error) {
    console.error("trade-execution error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
