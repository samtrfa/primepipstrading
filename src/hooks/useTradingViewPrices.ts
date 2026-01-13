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

// TradingView uses these exchanges - we'll connect to the same sources
// BITSTAMP: BTC, ETH (WebSocket available)
// For other assets, we'll use realistic simulation synced with typical market patterns

// Spread configuration per asset type (realistic broker spreads)
const getSpread = (symbol: string, price: number): number => {
  if (symbol === "BTCUSD") return price * 0.0001; // ~$9 spread on BTC
  if (symbol === "ETHUSD") return price * 0.0002; // ~$0.70 spread on ETH
  if (symbol.includes("XAU")) return 0.30; // 30 cents on gold
  if (symbol.includes("XAG")) return 0.02; // 2 cents on silver
  if (symbol.includes("JPY")) return 0.01; // 1 pip on JPY pairs
  if (symbol.includes("US30")) return 2.0; // 2 points on Dow
  if (symbol.includes("US100")) return 1.5; // 1.5 points on Nasdaq
  if (symbol.includes("US500")) return 0.5; // 0.5 points on S&P
  if (symbol.includes("OIL")) return 0.03; // 3 cents on oil
  return 0.00015; // 1.5 pips on forex
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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Connect to Bitstamp WebSocket for crypto prices (same source as TradingView)
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

          // Subscribe to BTC and ETH live trades
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
            
            // Handle trade events
            if (data.event === "trade") {
              const symbol = data.channel.includes("btc") ? "BTCUSD" : "ETHUSD";
              const price = parseFloat(data.data.price);
              
              if (!bitstampPricesRef.current[symbol]) {
                bitstampPricesRef.current[symbol] = { bid: price, ask: price, last: price };
              }
              bitstampPricesRef.current[symbol].last = price;
            }
            
            // Handle order book for bid/ask
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
          // Reconnect after 3 seconds
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

  // Update prices state
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

        // If market is closed, hold the last price
        if (!status.isOpen && lastFetchRef.current[symbol]) {
          newPrices[symbol] = {
            ...lastFetchRef.current[symbol],
            timestamp,
            isMarketOpen: false,
          };
          continue;
        }

        // For other assets, use base prices (these match TradingView's typical values)
        // In production, you'd connect to a proper forex/CFD data provider
        const basePrice = getBasePrice(symbol);
        const lastPrice = lastFetchRef.current[symbol]?.lastPrice || basePrice;
        
        // Add minimal price movement when market is open
        const volatility = getVolatility(symbol);
        const change = status.isOpen ? (Math.random() - 0.5) * 2 * volatility : 0;
        const newPrice = lastPrice * (1 + change);
        const spread = getSpread(symbol, newPrice);

        newPrices[symbol] = {
          bid: newPrice,
          ask: newPrice + spread,
          lastPrice: newPrice,
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

    // Update every 500ms to match TradingView's refresh rate
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

// Base prices matching TradingView's typical values
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

// Realistic volatility per tick
function getVolatility(symbol: string): number {
  if (symbol === "BTCUSD") return 0.00015;
  if (symbol === "ETHUSD") return 0.0002;
  if (symbol.includes("XAU")) return 0.00008;
  if (symbol.includes("XAG")) return 0.00012;
  if (symbol.includes("US30") || symbol.includes("US100") || symbol.includes("US500")) return 0.00005;
  if (symbol.includes("OIL")) return 0.0001;
  if (symbol.includes("JPY")) return 0.00004;
  return 0.00002; // Forex pairs - very small movements per tick
}
