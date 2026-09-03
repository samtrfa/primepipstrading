import { useState, useEffect, useCallback, useRef } from "react";

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

// Supported markets are available 24/7.
const SPREAD_PERCENT = 0.0005; // 0.05% total spread

const toPair = (symbol: string) => symbol.toLowerCase();

export function useTradingViewPrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const livePricesRef = useRef<Record<string, number>>({});
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const symbolsKey = symbols.join(",");

  // Initial + periodic REST snapshot from Bitstamp
  useEffect(() => {
    if (symbols.length === 0) return;
    let cancelled = false;

    const fetchSnapshot = async () => {
      await Promise.all(
        symbols.map(async (symbol) => {
          try {
            const res = await fetch(`https://www.bitstamp.net/api/v2/ticker/${toPair(symbol)}/`);
            if (!res.ok) return;
            const data = await res.json();
            const last = parseFloat(data.last);
            if (!cancelled && Number.isFinite(last) && last > 0) {
              livePricesRef.current[symbol] = last;
            }
          } catch {
            // ignore network errors, WebSocket will fill in
          }
        })
      );
      if (!cancelled && Object.keys(livePricesRef.current).length > 0) {
        setIsConnected(true);
      }
    };

    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 30000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbolsKey]);

  // Live trades via Bitstamp WebSocket
  useEffect(() => {
    if (symbols.length === 0) return;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket("wss://ws.bitstamp.net");
        wsRef.current = ws;

        ws.onopen = () => {
          setIsConnected(true);
          symbols.forEach((symbol) => {
            ws.send(
              JSON.stringify({
                event: "bts:subscribe",
                data: { channel: `live_trades_${toPair(symbol)}` },
              })
            );
          });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.event === "trade" && typeof data.channel === "string") {
              const pair = data.channel.replace("live_trades_", "").toUpperCase();
              const price = parseFloat(data.data.price);
              if (Number.isFinite(price) && price > 0) {
                livePricesRef.current[pair] = price;
              }
            }
          } catch {
            // ignore parse errors
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
        };
      } catch {
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 5000);
      }
    };

    connectWebSocket();

    return () => {
      wsRef.current?.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [symbolsKey]);

  // Publish prices to state
  useEffect(() => {
    if (symbols.length === 0) return;

    const updatePrices = () => {
      const timestamp = Date.now();
      const next: Record<string, PriceData> = {};

      for (const symbol of symbols) {
        const last = livePricesRef.current[symbol];
        if (!last) continue;
        const half = last * (SPREAD_PERCENT / 2);
        next[symbol] = {
          bid: last - half,
          ask: last + half,
          lastPrice: last,
          timestamp,
          isMarketOpen: true,
        };
      }

      setPrices(next);
    };

    updatePrices();
    const interval = setInterval(updatePrices, 500);
    return () => clearInterval(interval);
  }, [symbolsKey]);

  const getPrice = useCallback((symbol: string): PriceData | null => prices[symbol] || null, [prices]);

  const getMarketStatus = useCallback((): MarketStatus => ({ isOpen: true }), []);

  return { prices, isConnected, getPrice, marketStatus: {} as Record<string, MarketStatus>, getMarketStatus };
}
