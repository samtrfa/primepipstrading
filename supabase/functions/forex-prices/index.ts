import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Map internal symbols to Twelve Data format
const symbolMap: Record<string, string> = {
  EURUSD: "EUR/USD",
  GBPUSD: "GBP/USD",
  USDJPY: "USD/JPY",
  AUDUSD: "AUD/USD",
  USDCAD: "USD/CAD",
  USDCHF: "USD/CHF",
  NZDUSD: "NZD/USD",
  EURJPY: "EUR/JPY",
  GBPJPY: "GBP/JPY",
  XAUUSD: "XAU/USD",
  XAGUSD: "XAG/USD",
  USOIL: "WTI/USD",
};

// Indices use different endpoint
const indexSymbols: Record<string, string> = {
  US30: "DJI",
  US100: "NDX",
  US500: "SPX",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWELVE_DATA_API_KEY = Deno.env.get('TWELVE_DATA_API_KEY');
    if (!TWELVE_DATA_API_KEY) {
      throw new Error("TWELVE_DATA_API_KEY not configured");
    }

    const { symbols } = await req.json();
    
    if (!symbols || !Array.isArray(symbols)) {
      return new Response(
        JSON.stringify({ error: "symbols array required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const prices: Record<string, { bid: number; ask: number; price: number }> = {};

    // Filter out crypto (handled by Bitstamp WebSocket on client)
    const forexSymbols = symbols.filter((s: string) => s !== "BTCUSD" && s !== "ETHUSD");
    
    // Map symbols to Twelve Data format
    const twelveDataSymbols: string[] = [];
    const symbolMapping: Record<string, string> = {};
    
    for (const symbol of forexSymbols) {
      if (symbolMap[symbol]) {
        twelveDataSymbols.push(symbolMap[symbol]);
        symbolMapping[symbolMap[symbol]] = symbol;
      } else if (indexSymbols[symbol]) {
        twelveDataSymbols.push(indexSymbols[symbol]);
        symbolMapping[indexSymbols[symbol]] = symbol;
      }
    }

    if (twelveDataSymbols.length === 0) {
      return new Response(
        JSON.stringify({ prices: {} }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Batch request to Twelve Data price endpoint
    const symbolsParam = twelveDataSymbols.join(",");
    console.log(`Fetching prices for: ${symbolsParam}`);
    
    const response = await fetch(
      `https://api.twelvedata.com/price?symbol=${encodeURIComponent(symbolsParam)}&apikey=${TWELVE_DATA_API_KEY}`
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twelve Data API error:", response.status, errorText);
      throw new Error(`Twelve Data API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("Twelve Data response:", JSON.stringify(data));

    // Parse response - can be single object or keyed by symbol
    if (twelveDataSymbols.length === 1) {
      // Single symbol returns direct object
      const tdSymbol = twelveDataSymbols[0];
      const internalSymbol = symbolMapping[tdSymbol];
      if (data.price && internalSymbol) {
        const price = parseFloat(data.price);
        const spread = getSpread(internalSymbol, price);
        prices[internalSymbol] = {
          bid: price,
          ask: price + spread,
          price: price
        };
      }
    } else {
      // Multiple symbols returns keyed object
      for (const [tdSymbol, priceData] of Object.entries(data)) {
        const internalSymbol = symbolMapping[tdSymbol];
        if (internalSymbol && priceData && typeof priceData === 'object' && 'price' in priceData) {
          const price = parseFloat((priceData as { price: string }).price);
          const spread = getSpread(internalSymbol, price);
          prices[internalSymbol] = {
            bid: price,
            ask: price + spread,
            price: price
          };
        }
      }
    }

    console.log("Processed prices:", JSON.stringify(prices));

    return new Response(
      JSON.stringify({ prices, timestamp: Date.now() }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('forex-prices error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Realistic broker spreads
function getSpread(symbol: string, price: number): number {
  if (symbol.includes("XAU")) return 0.30;
  if (symbol.includes("XAG")) return 0.02;
  if (symbol.includes("JPY")) return 0.012;
  if (symbol.includes("US30")) return 2.0;
  if (symbol.includes("US100")) return 1.5;
  if (symbol.includes("US500")) return 0.5;
  if (symbol.includes("OIL")) return 0.03;
  return price * 0.00015; // ~1.5 pips for forex
}
