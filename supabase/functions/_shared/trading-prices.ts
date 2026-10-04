import { getPositionExitAction, isTradingQuoteFresh } from "./trading-risk-policy.js";

export { getPositionExitAction, isTradingQuoteFresh };

export interface TradingQuote {
  bid: number;
  ask: number;
  observedAt: number;
}

const MAX_QUOTE_AGE_MS = 5000;

const FOREX_SYMBOLS = new Set([
  "EURUSD", "GBPUSD", "USDJPY", "AUDUSD", "USDCAD", "USDCHF", "NZDUSD",
  "EURJPY", "GBPJPY", "XAUUSD", "XAGUSD", "USOIL", "US30", "US100", "US500",
]);

const fetchWithTimeout = (input: string | URL, init?: RequestInit) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(MAX_QUOTE_AGE_MS) });

const fetchCryptoQuote = async (symbol: string): Promise<TradingQuote | null> => {
  try {
    const response = await fetchWithTimeout(
      `https://www.bitstamp.net/api/v2/order_book/${symbol.toLowerCase()}/`,
    );
    if (!response.ok) {
      console.error("Bitstamp quote request failed", { symbol, status: response.status });
      return null;
    }

    const data = await response.json() as {
      bids?: Array<[string, string]>;
      asks?: Array<[string, string]>;
    };
    const bid = Number(data.bids?.[0]?.[0]);
    const ask = Number(data.asks?.[0]?.[0]);
    if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask < bid) {
      console.error("Bitstamp returned an invalid order book", { symbol });
      return null;
    }

    return { bid, ask, observedAt: Date.now() };
  } catch (error) {
    console.error("Bitstamp quote request failed", {
      symbol,
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
};

const fetchForexQuotes = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  symbols: string[],
): Promise<Record<string, TradingQuote>> => {
  if (symbols.length === 0) return {};

  try {
    const response = await fetchWithTimeout(`${supabaseUrl}/functions/v1/forex-prices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ symbols }),
    });
    if (!response.ok) {
      console.error("Forex quote request failed", { status: response.status, symbols });
      return {};
    }

    const data = await response.json() as {
      prices?: Record<string, { bid: number; ask: number }>;
    };
    const quotes: Record<string, TradingQuote> = {};
    const observedAt = Date.now();
    for (const symbol of symbols) {
      const quote = data.prices?.[symbol];
      if (
        quote &&
        Number.isFinite(quote.bid) &&
        Number.isFinite(quote.ask) &&
        quote.bid > 0 &&
        quote.ask >= quote.bid
      ) {
        quotes[symbol] = { ...quote, observedAt };
      } else {
        console.error("Forex provider returned no valid quote", { symbol });
      }
    }
    return quotes;
  } catch (error) {
    console.error("Forex quote request failed", {
      symbols,
      message: error instanceof Error ? error.message : String(error),
    });
    return {};
  }
};

export const getTradingQuotes = async (
  supabaseUrl: string,
  serviceRoleKey: string,
  symbols: string[],
): Promise<Record<string, TradingQuote>> => {
  const cryptoSymbols = symbols.filter((symbol) => !FOREX_SYMBOLS.has(symbol));
  const forexSymbols = symbols.filter((symbol) => FOREX_SYMBOLS.has(symbol));
  const [cryptoQuotes, forexQuotes] = await Promise.all([
    Promise.all(cryptoSymbols.map(async (symbol) => [symbol, await fetchCryptoQuote(symbol)] as const)),
    fetchForexQuotes(supabaseUrl, serviceRoleKey, forexSymbols),
  ]);

  const quotes: Record<string, TradingQuote> = forexQuotes;
  for (const [symbol, quote] of cryptoQuotes) {
    if (quote) quotes[symbol] = quote;
  }
  return quotes;
};
