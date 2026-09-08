import { createClient } from "npm:@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const spreadPercent = 0.0005;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

type ServerPosition = {
  id: string;
  account_id: string;
  position_type: string;
  lot_size: number;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  assets: { symbol: string } | null;
};

type ServerAccount = {
  id: string;
  account_size: number;
  current_balance: number | null;
  high_water_mark: number | null;
  daily_start_balance: number | null;
  daily_start_date: string | null;
  funded_started_at: string | null;
  challenge_type: string;
  current_phase: number | null;
  status: string;
  drawdown_violated: boolean | null;
};

type ClosedPosition = {
  account_id: string;
  profit_loss: number | null;
  closed_at: string | null;
};

const getCryptoPrices = async (symbols: string[]) => {
  const prices: Record<string, number> = {};
  await Promise.all(symbols.map(async (symbol) => {
    const response = await fetch(`https://www.bitstamp.net/api/v2/ticker/${symbol.toLowerCase()}/`);
    if (!response.ok) return;
    const data = await response.json();
    const price = Number(data.last);
    if (Number.isFinite(price) && price > 0) prices[symbol] = price;
  }));
  return prices;
};

const getForexPrices = async (symbols: string[]) => {
  if (symbols.length === 0) return {};
  const response = await fetch(`${supabaseUrl}/functions/v1/forex-prices`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ symbols }),
  });
  if (!response.ok) return {};
  const data = await response.json() as {
    prices?: Record<string, { bid: number; ask: number }>;
  };
  return data.prices ?? {};
};

const getOpenPositions = async (admin: ReturnType<typeof createClient>) => {
  const pageSize = 1000;
  const openPositions: ServerPosition[] = [];

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await admin
      .from("positions")
      .select("id, account_id, position_type, lot_size, entry_price, stop_loss, take_profit, assets(symbol)")
      .eq("status", "open")
      .range(offset, offset + pageSize - 1);

    if (error) throw error;
    openPositions.push(...(data ?? []));
    if (!data || data.length < pageSize) return openPositions;
  }
};

const getRules = (challengeType: string, currentPhase: number | null) => {
  if (challengeType === "instant") return { daily: 5, max: 10 };
  if (challengeType === "one_step") return { daily: 4, max: 6 };
  return { daily: 5, max: 10 };
};

const getContractSize = (symbol: string) => {
  const base = symbol.replace(/USD[TC]?$/i, "").toUpperCase();
  return {
    BTC: 1, ETH: 1, BCH: 10, LTC: 10, SOL: 10, AAVE: 10,
    ETC: 100, LINK: 100, AVAX: 100, DOT: 100, UNI: 100, NEAR: 100, ATOM: 100,
    XTZ: 1000, ADA: 1000, XRP: 1000, ALGO: 1000, SAND: 1000,
    DOGE: 10000, XLM: 10000,
  }[base] ?? 1;
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  if (req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const positions = await getOpenPositions(admin);
    const openPositions = positions.filter((position) => position.assets?.symbol);
    const [{ data: accounts, error: accountsError }, { data: closedPositions, error: closedPositionsError }] = await Promise.all([
      admin
      .from("accounts")
      .select("id, account_size, current_balance, high_water_mark, daily_start_balance, daily_start_date, funded_started_at, challenge_type, current_phase, status, drawdown_violated")
      .in("status", ["active", "funded"]),
      admin
        .from("positions")
        .select("account_id, profit_loss, closed_at")
        .eq("status", "closed")
        .not("closed_at", "is", null),
    ]);
    if (accountsError) throw accountsError;
    if (closedPositionsError) throw closedPositionsError;
    const accountMap = new Map<string, ServerAccount>((accounts ?? []).map((account) => [account.id, account as ServerAccount]));
    const profitByAccountAndDay = new Map<string, Map<string, number>>();
    for (const position of (closedPositions ?? []) as ClosedPosition[]) {
      if (!position.closed_at || (position.profit_loss ?? 0) <= 0) continue;
      const account = accountMap.get(position.account_id);
      if (account?.status === "funded" && account.funded_started_at && position.closed_at < account.funded_started_at) continue;
      const day = position.closed_at.slice(0, 10);
      const dailyProfit = profitByAccountAndDay.get(position.account_id) ?? new Map<string, number>();
      dailyProfit.set(day, (dailyProfit.get(day) ?? 0) + (position.profit_loss ?? 0));
      profitByAccountAndDay.set(position.account_id, dailyProfit);
    }
    const symbols = [...new Set(openPositions.map((position) => position.assets.symbol))];
    const cryptoSymbols = symbols.filter((symbol) => !["EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD", "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD", "USOIL", "US30", "US100", "US500"].includes(symbol));
    const forexSymbols = symbols.filter((symbol) => !cryptoSymbols.includes(symbol));
    const [lastPrices, forexPrices] = await Promise.all([
      getCryptoPrices(cryptoSymbols),
      getForexPrices(forexSymbols),
    ]);
    const results: Array<{ positionId: string; action: "sl_hit" | "tp_hit"; closed: boolean }> = [];
    const sltpTriggers: Array<{ position: ServerPosition; exitPrice: number; action: "sl_hit" | "tp_hit" }> = [];
    const livePLByAccount = new Map<string, number>();
    const livePrices = new Map<string, number>();

    for (const position of openPositions) {
      const forexPrice = forexPrices[position.assets.symbol];
      const lastPrice = lastPrices[position.assets.symbol];
      if (!lastPrice && !forexPrice) continue;

      const halfSpread = lastPrice ? lastPrice * (spreadPercent / 2) : 0;
      const bid = forexPrice?.bid ?? lastPrice! - halfSpread;
      const ask = forexPrice?.ask ?? lastPrice! + halfSpread;
      const marketPrice = position.position_type === "buy" ? bid : ask;
      livePrices.set(position.id, marketPrice);
      const contractSize = getContractSize(position.assets.symbol);
      const floatingPL = (position.position_type === "buy" ? marketPrice - position.entry_price : position.entry_price - marketPrice) * contractSize * position.lot_size;
      livePLByAccount.set(position.account_id, (livePLByAccount.get(position.account_id) ?? 0) + floatingPL);
      const stopTriggered = position.stop_loss !== null && (
        position.position_type === "buy" ? marketPrice <= position.stop_loss : marketPrice >= position.stop_loss
      );
      const targetTriggered = position.take_profit !== null && (
        position.position_type === "buy" ? marketPrice >= position.take_profit : marketPrice <= position.take_profit
      );

      if (!stopTriggered && !targetTriggered) continue;
      const action = stopTriggered ? "sl_hit" : "tp_hit";
      sltpTriggers.push({ position, exitPrice: marketPrice, action });
    }

    const drawdownAccounts: string[] = [];
    for (const account of accountMap.values()) {
      const livePL = livePLByAccount.get(account.id) ?? 0;
      const balance = account.current_balance ?? account.account_size;
      const equity = balance + livePL;
      const highWaterMark = Math.max(account.high_water_mark ?? account.account_size, equity);
      const today = new Date().toISOString().slice(0, 10);
      const isNewDay = !account.daily_start_date || account.daily_start_date < today;
      const dailyStart = isNewDay
        ? balance
        : (account.daily_start_balance && account.daily_start_balance > 0 ? account.daily_start_balance : balance);
      const maxDrawdown = highWaterMark > 0 ? Math.max(0, ((highWaterMark - equity) / highWaterMark) * 100) : 0;
      const dailyDrawdown = dailyStart > 0 ? Math.max(0, ((dailyStart - equity) / dailyStart) * 100) : 0;
      const dailyProfits = [...(profitByAccountAndDay.get(account.id)?.values() ?? [])];
      const totalProfit = dailyProfits.reduce((sum, value) => sum + value, 0);
      const bestTradingDay = Math.max(0, ...dailyProfits);
      const consistencyScore = totalProfit > 0 ? (bestTradingDay / totalProfit) * 100 : 0;
      const rules = getRules(account.challenge_type, account.current_phase);
      const violation = maxDrawdown >= rules.max ? "max_drawdown" : dailyDrawdown >= rules.daily ? "daily_drawdown" : null;

      const { error: accountUpdateError } = await admin.from("accounts").update({
        high_water_mark: highWaterMark,
        daily_start_balance: dailyStart,
        daily_start_date: today,
        max_drawdown_percent: maxDrawdown,
        daily_drawdown_percent: dailyDrawdown,
        consistency_score: consistencyScore,
        best_trading_day_profit: bestTradingDay,
        closed_profit_total: totalProfit,
        ...(violation ? { drawdown_violated: true, violation_type: violation, status: "failed" } : {}),
      }).eq("id", account.id);
      if (accountUpdateError) console.error("server risk update failed", { accountId: account.id, message: accountUpdateError.message });

      if (violation) drawdownAccounts.push(account.id);
    }

    for (const accountId of drawdownAccounts) {
      for (const position of openPositions.filter((candidate) => candidate.account_id === accountId)) {
        const exitPrice = livePrices.get(position.id);
        if (!exitPrice) continue;
        const { error: closeError } = await admin.rpc("close_trade", {
          p_account_id: accountId,
          p_position_id: position.id,
          p_exit_price: exitPrice,
          p_action: "close",
          p_request_id: crypto.randomUUID(),
        });
        if (closeError) console.error("server drawdown close failed", { positionId: position.id, message: closeError.message });
      }
    }

    for (const trigger of sltpTriggers) {
      const { position, exitPrice, action } = trigger;
      const { error: closeError } = await admin.rpc("close_trade", {
        p_account_id: position.account_id,
        p_position_id: position.id,
        p_exit_price: exitPrice,
        p_action: action,
        p_request_id: crypto.randomUUID(),
      });
      if (closeError) {
        console.error("server SL/TP close failed", { positionId: position.id, action, message: closeError.message });
        continue;
      }
      results.push({ positionId: position.id, action, closed: true });
    }

    return json({ checked: openPositions.length, closed: results.length, drawdownAccounts: drawdownAccounts.length, results });
  } catch (error) {
    console.error("server-sltp error:", error);
    return json({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});
