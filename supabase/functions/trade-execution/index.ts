import { createClient } from "npm:@supabase/supabase-js@2";
import { getPositionExitAction, getTradingQuotes, isTradingQuoteFresh } from "../_shared/trading-prices.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

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
      action?: "place" | "close" | "check-sltp";
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
        .select("id, user_id, risk_monitoring_degraded")
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
      if (account.risk_monitoring_degraded) {
        return json({
          error: "Risk monitoring is temporarily unavailable; new trades are paused",
        }, 423);
      }

      const quote = (await getTradingQuotes(
        supabaseUrl,
        serviceRoleKey,
        [asset.symbol],
      ))[asset.symbol];
      if (!quote || !isTradingQuoteFresh(quote)) return json({ error: "Market price unavailable" }, 503);
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

    if (body.action === "check-sltp") {
      if (!body.accountId) return json({ error: "Invalid account" }, 400);
      const { data: account } = await admin
        .from("accounts")
        .select("id, user_id")
        .eq("id", body.accountId)
        .maybeSingle();
      if (!account || (!isAdmin && account.user_id !== userData.user.id)) {
        return json({ error: "Account is not available" }, 403);
      }

      const { data: positions, error: positionsError } = await admin
        .from("positions")
        .select("id, account_id, position_type, stop_loss, take_profit, assets(symbol)")
        .eq("account_id", account.id)
        .eq("status", "open");
      if (positionsError) throw positionsError;

      const openPositions = (positions ?? []).filter((position) => position.assets?.symbol);
      const symbols = [...new Set(openPositions.map((position) => position.assets!.symbol))];
      const quotes = await getTradingQuotes(supabaseUrl, serviceRoleKey, symbols);
      const results: Array<{
        positionId: string;
        symbol: string;
        action: "sl_hit" | "tp_hit";
        exitPrice: number;
        profitLoss: number;
      }> = [];
      const unavailableSymbols = new Set<string>(
        (positions ?? [])
          .filter((position) => !position.assets?.symbol)
          .map(() => "<unknown asset>"),
      );
      const closeFailures: Array<{ positionId: string; symbol: string; message: string }> = [];
      let riskPauseError: string | null = null;

      for (const position of openPositions) {
        const symbol = position.assets!.symbol;
        const quote = quotes[symbol];
        if (!quote || !isTradingQuoteFresh(quote)) {
          unavailableSymbols.add(symbol);
          continue;
        }

        const exitPrice = position.position_type === "buy" ? quote.bid : quote.ask;
        const action = getPositionExitAction(
          position.position_type,
          exitPrice,
          position.stop_loss,
          position.take_profit,
        );
        if (!action) continue;
        const { data, error } = await admin.rpc("close_trade", {
          p_account_id: account.id,
          p_position_id: position.id,
          p_exit_price: exitPrice,
          p_action: action,
          p_request_id: crypto.randomUUID(),
        });
        if (error) {
          console.error("user SL/TP close failed", {
            positionId: position.id,
            action,
            message: error.message,
          });
          closeFailures.push({ positionId: position.id, symbol, message: error.message });
          continue;
        }
        results.push({
          positionId: position.id,
          symbol,
          action,
          exitPrice,
          profitLoss: Number(data?.position?.profit_loss ?? 0),
        });
      }

      if (unavailableSymbols.size > 0) {
        const { error: pauseError } = await admin
          .from("accounts")
          .update({ risk_monitoring_degraded: true })
          .eq("id", account.id);
        if (pauseError) {
          riskPauseError = pauseError.message;
          console.error("Failed to pause trading while risk quotes are unavailable", {
            accountId: account.id,
            message: pauseError.message,
          });
        }
      }

      return json({
        checked: openPositions.length,
        closed: results.length,
        results,
        unavailableSymbols: [...unavailableSymbols],
        closeFailures,
        riskPauseError,
        riskPaused: unavailableSymbols.size > 0 && !riskPauseError,
      });
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
      if (!quote || !isTradingQuoteFresh(quote)) {
        const { error: pauseError } = await admin
          .from("accounts")
          .update({ risk_monitoring_degraded: true })
          .eq("id", account.id);
        if (pauseError) {
          console.error("Failed to pause trading after close quote became unavailable", {
            accountId: account.id,
            positionId: position.id,
            message: pauseError.message,
          });
        }
        return json({
          error: "Market price unavailable",
          riskPauseError: pauseError?.message,
        }, 503);
      }
      const exitPrice = position.position_type === "buy" ? quote.bid : quote.ask;
      const requestedAction = body.triggerAction ?? "close";
      let action = requestedAction;
      if (requestedAction === "sl_hit" || requestedAction === "tp_hit") {
        const actualAction = getPositionExitAction(
          position.position_type,
          exitPrice,
          position.stop_loss,
          position.take_profit,
        );
        if (!actualAction) {
          return json({ error: "SL/TP trigger is no longer valid at the current market price" }, 409);
        }
        action = actualAction;
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
