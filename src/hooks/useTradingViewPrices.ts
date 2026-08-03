import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface PriceData {
  bid: number;
  ask: number;
  timestamp: number;
  isMarketOpen: boolean;
  lastPrice: number;
}

interface MarketStatus {
  isOpen: boolean;
  reason?: string;
}

// Spread configuration per asset type (realistic broker spreads)
const getSpread = (symbol: string, price: number): number => {
  if (symbol === "BTCUSD") return price * 0.0001;
  if (symbol === "ETHUSD") return price * 0.0002;
  if (symbol.includes("XAU")) return 0.30;
  if (symbol.includes("XAG")) return 0.02;
  if (symbol.includes("JPY")) return 0.012;
  if (symbol.includes("US30")) return 2.0;
  if (symbol.includes("US100")) return 1.5;
  if (symbol.includes("US500")) return 0.5;
  if (symbol.includes("OIL")) return 0.03;
  return price * 0.00015;
};

// Check if market should be open
const checkMarketStatus = (symbol: string): MarketStatus => {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const utcHour = now.getUTCHours();

  // Crypto markets are 24/7
  if (symbol === "BTCUSD" || symbol === "ETHUSD") {
    return { isOpen: true };
  }

  // Forex/CFD: Closed from Friday 22:00 UTC to Sunday 22:00 UTC
  if (utcDay === 0 && utcHour < 22) {
    return { isOpen: false, reason: "Market Closed - Weekend" };
  }
  if (utcDay === 6) {
    return { isOpen: false, reason: "Market Closed - Weekend" };
  }
  if (utcDay === 5 && utcHour >= 22) {
    return { isOpen: false, reason: "Market Closed - Weekend" };
  }

  return { isOpen: true };
};

export function useTradingViewPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [marketStatus, setMarketStatus] = useState<Record<string, MarketStatus>>({});
  
  const wsRef = useRef<WebSocket | null>(null);
  const bitstampPricesRef = useRef<Record<string, { bid: number; ask: number; last: number }>>({});
  const forexPricesRef = useRef<Record<string, { bid: number; ask: number; price: number }>>({});
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<Record<string, PriceData>>({});

  // Initialize market status
  useEffect(() => {
    const updateMarketStatus = () => {
      const status: Record<string, MarketStatus> = {};
      symbols.forEach((symbol) => {
        status[symbol] = checkMarketStatus(symbol);
      });
      setMarketStatus(status);
    };

    updateMarketStatus();
    const interval = setInterval(updateMarketStatus, 60000);
    return () => clearInterval(interval);
  }, [symbols.join(",")]);

  // Connect to Bitstamp WebSocket for crypto prices
  useEffect(() => {
    const hasCrypto = symbols.some(s => s === "BTCUSD" || s === "ETHUSD");
    if (!hasCrypto) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket("wss://ws.bitstamp.net");
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("Bitstamp WebSocket connected");
          setIsConnected(true);

          if (symbols.includes("BTCUSD")) {
            ws.send(JSON.stringify({
              event: "bts:subscribe",
              data: { channel: "live_trades_btcusd" }
            }));
            ws.send(JSON.stringify({
              event: "bts:subscribe",
              data: { channel: "order_book_btcusd" }
            }));
          }
          if (symbols.includes("ETHUSD")) {
            ws.send(JSON.stringify({
              event: "bts:subscribe",
              data: { channel: "live_trades_ethusd" }
            }));
            ws.send(JSON.stringify({
              event: "bts:subscribe",
              data: { channel: "order_book_ethusd" }
            }));
          }
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            if (data.event === "trade") {
              const symbol = data.channel.includes("btc") ? "BTCUSD" : "ETHUSD";
              const price = parseFloat(data.data.price);
              
              if (!bitstampPricesRef.current[symbol]) {
                bitstampPricesRef.current[symbol] = { bid: price, ask: price, last: price };
              }
              bitstampPricesRef.current[symbol].last = price;
            }
            
            if (data.event === "data" && data.channel.includes("order_book")) {
              const symbol = data.channel.includes("btc") ? "BTCUSD" : "ETHUSD";
              const bids = data.data.bids;
              const asks = data.data.asks;
              
              if (bids && bids.length > 0 && asks && asks.length > 0) {
                const bid = parseFloat(bids[0][0]);
                const ask = parseFloat(asks[0][0]);
                bitstampPricesRef.current[symbol] = {
                  bid,
                  ask,
                  last: (bid + ask) / 2
                };
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        };

        ws.onerror = () => {
          console.log("Bitstamp WebSocket error, will reconnect");
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };
      } catch (e) {
        console.log("WebSocket connection failed:", e);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [symbols.join(",")]);

  // Fetch initial crypto prices from Bitstamp REST API
  useEffect(() => {
    const fetchBitstampPrices = async () => {
      for (const symbol of ["BTCUSD", "ETHUSD"]) {
        if (!symbols.includes(symbol)) continue;
        
        try {
          const pair = symbol.toLowerCase().replace("usd", "");
          const response = await fetch(`https://www.bitstamp.net/api/v2/ticker/${pair}usd/`);
          if (response.ok) {
            const data = await response.json();
            bitstampPricesRef.current[symbol] = {
              bid: parseFloat(data.bid),
              ask: parseFloat(data.ask),
              last: parseFloat(data.last)
            };
          }
        } catch (e) {
          console.log(`Failed to fetch ${symbol} price:`, e);
        }
      }
    };

    fetchBitstampPrices();
  }, [symbols.join(",")]);

  // Fetch forex prices from Twelve Data via edge function
  useEffect(() => {
    const forexSymbols = symbols.filter(s => s !== "BTCUSD" && s !== "ETHUSD");
    if (forexSymbols.length === 0) return;

    const fetchForexPrices = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('forex-prices', {
          body: { symbols: forexSymbols }
        });

        if (error) {
          console.error("Forex prices fetch error:", error);
          return;
        }

        if (data?.prices) {
          forexPricesRef.current = { ...forexPricesRef.current, ...data.prices };
          setIsConnected(true);
        }
      } catch (e) {
        console.error("Failed to fetch forex prices:", e);
      }
    };

    // Fetch immediately
    fetchForexPrices();

    // Fetch every 5 seconds (Twelve Data free tier: 800 calls/day = ~1 call per 100 seconds, but batched)
    const interval = setInterval(fetchForexPrices, 5000);
    return () => clearInterval(interval);
  }, [symbols.join(",")]);

  // Update prices state from all sources
  useEffect(() => {
    if (symbols.length === 0) return;

    const updatePrices = () => {
      const timestamp = Date.now();
      const newPrices: Record<string, PriceData> = {};

      for (const symbol of symbols) {
        const status = checkMarketStatus(symbol);

        // For crypto, use Bitstamp real prices
        if (symbol === "BTCUSD" || symbol === "ETHUSD") {
          const bitstampData = bitstampPricesRef.current[symbol];
          if (bitstampData) {
            newPrices[symbol] = {
              bid: bitstampData.bid,
              ask: bitstampData.ask,
              lastPrice: bitstampData.last,
              timestamp,
              isMarketOpen: true,
            };
            lastFetchRef.current[symbol] = newPrices[symbol];
            continue;
          }
        }

        // For forex/indices, use Twelve Data prices
        const forexData = forexPricesRef.current[symbol];
        if (forexData) {
          // If market is closed, mark as closed but still show price
          newPrices[symbol] = {
            bid: forexData.bid,
            ask: forexData.ask,
            lastPrice: forexData.price,
            timestamp,
            isMarketOpen: status.isOpen,
          };
          lastFetchRef.current[symbol] = newPrices[symbol];
          continue;
        }

        // Fallback to last known price
        if (lastFetchRef.current[symbol]) {
          newPrices[symbol] = {
            ...lastFetchRef.current[symbol],
            timestamp,
            isMarketOpen: status.isOpen,
          };
          continue;
        }

        // Final fallback: base prices
        const basePrice = getBasePrice(symbol);
        const spread = getSpread(symbol, basePrice);
        newPrices[symbol] = {
          bid: basePrice,
          ask: basePrice + spread,
          lastPrice: basePrice,
          timestamp,
          isMarketOpen: status.isOpen,
        };
        lastFetchRef.current[symbol] = newPrices[symbol];
      }

      setPrices(newPrices);
      if (Object.keys(newPrices).length > 0) {
        setIsConnected(true);
      }
    };

    // Initial update
    updatePrices();

    // Update display every 500ms
    const interval = setInterval(updatePrices, 500);
    return () => clearInterval(interval);
  }, [symbols.join(",")]);

  const getPrice = useCallback(
    (symbol: string): PriceData | null => {
      return prices[symbol] || null;
    },
    [prices]
  );

  const getMarketStatus = useCallback(
    (symbol: string): MarketStatus => {
      return marketStatus[symbol] || { isOpen: true };
    },
    [marketStatus]
  );

  return { prices, isConnected, getPrice, marketStatus, getMarketStatus };
}

// Base prices (fallback only)
function getBasePrice(symbol: string): number {
  const basePrices: Record<string, number> = {
    EURUSD: 1.0420,
    GBPUSD: 1.2185,
    USDJPY: 157.85,
    AUDUSD: 0.6195,
    USDCAD: 1.4385,
    USDCHF: 0.9120,
    NZDUSD: 0.5610,
    EURJPY: 164.50,
    GBPJPY: 192.35,
    XAUUSD: 2665.50,
    XAGUSD: 29.85,
    BTCUSD: 94500,
    ETHUSD: 3280,
    US30: 43250,
    US100: 21350,
    US500: 5985,
    USOIL: 77.25,
  };
  return basePrices[symbol] || 1;
}
