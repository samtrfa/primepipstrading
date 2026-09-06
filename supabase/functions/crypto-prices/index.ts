import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();
    if (!Array.isArray(symbols)) {
      return new Response(JSON.stringify({ error: "symbols array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prices: Record<string, { price: number }> = {};
    await Promise.all(symbols.map(async (symbol: unknown) => {
      if (typeof symbol !== "string") return;
      const response = await fetch(`https://www.bitstamp.net/api/v2/ticker/${symbol.toLowerCase()}/`);
      if (!response.ok) return;
      const data = await response.json();
      const price = Number(data.last);
      if (Number.isFinite(price) && price > 0) prices[symbol] = { price };
    }));

    return new Response(JSON.stringify({ prices, timestamp: Date.now() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});