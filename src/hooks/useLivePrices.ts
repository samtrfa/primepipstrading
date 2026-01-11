import { useState, useEffect, useCallback, useRef } from "react";

interface PriceData {
  bid: number;
  ask: number;
  timestamp?: number;
}

// Base prices as fallback
const basePrices: Record<string, number> = {
  EURUSD: 1.0875,
  GBPUSD: 1.2650,
  USDJPY: 149.50,
  AUDUSD: 0.6580,
  USDCAD: 1.3520,
  USDCHF: 0.8820,
  NZDUSD: 0.6120,
  EURJPY: 162.50,
  GBPJPY: 189.20,
  XAUUSD: 2650.50,
  XAGUSD: 31.50,
  BTCUSD: 94500,
  ETHUSD: 3450,
  US30: 42800,
  US100: 21200,
  US500: 5950,
  USOIL: 72.50,
};

// Spread configuration per asset type
const getSpread = (symbol: string): number => {
  if (symbol.includes("JPY")) return 0.02;
  if (symbol === "XAUUSD") return 0.50;
  if (symbol === "XAGUSD") return 0.03;
  if (symbol.includes("BTC")) return 50;
  if (symbol.includes("ETH")) return 5;
  if (symbol.includes("US30")) return 3;
  if (symbol.includes("US100")) return 2;
  if (symbol.includes("US500")) return 0.5;
  if (symbol.includes("OIL")) return 0.05;
  return 0.00015;
};

// Simulate realistic price movements
const generatePriceMovement = (currentPrice: number, symbol: string): number => {
  const volatility = symbol.includes("BTC")
    ? 0.0008
    : symbol.includes("ETH")
    ? 0.001
    : symbol.includes("XAU")
    ? 0.0003
    : symbol.includes("US")
    ? 0.0002
    : 0.0001;

  const change = (Math.random() - 0.5) * 2 * volatility;
  return currentPrice * (1 + change);
};

export function useLivePrices(symbols: string[]) {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [isConnected, setIsConnected] = useState(false);
  const pricesRef = useRef<Record<string, PriceData>>({});

  // Initialize prices
  useEffect(() => {
    const initialPrices: Record<string, PriceData> = {};
    symbols.forEach((symbol) => {
      const basePrice = basePrices[symbol] || 1;
      const spread = getSpread(symbol);
      initialPrices[symbol] = {
        bid: basePrice,
        ask: basePrice + spread,
        timestamp: Date.now(),
      };
    });
    setPrices(initialPrices);
    pricesRef.current = initialPrices;
    setIsConnected(true);
  }, [symbols.join(",")]);

  // Simulate live price updates
  useEffect(() => {
    if (symbols.length === 0) return;

    const updatePrices = () => {
      setPrices((prev) => {
        const updated = { ...prev };
        symbols.forEach((symbol) => {
          const current = updated[symbol] || {
            bid: basePrices[symbol] || 1,
            ask: (basePrices[symbol] || 1) + getSpread(symbol),
          };
          const newBid = generatePriceMovement(current.bid, symbol);
          const spread = getSpread(symbol);
          updated[symbol] = {
            bid: newBid,
            ask: newBid + spread,
            timestamp: Date.now(),
          };
        });
        pricesRef.current = updated;
        return updated;
      });
    };

    // Update prices every 500ms for more realistic feel
    const interval = setInterval(updatePrices, 500);

    return () => clearInterval(interval);
  }, [symbols.join(",")]);

  const getPrice = useCallback((symbol: string): PriceData | null => {
    return pricesRef.current[symbol] || null;
  }, []);

  return { prices, isConnected, getPrice };
}
