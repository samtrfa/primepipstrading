import { useEffect, useRef, memo } from "react";

interface TradingViewChartProps {
  symbol: string;
}

function TradingViewChartComponent({ symbol }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    // Map internal symbols to TradingView symbols
    const symbolMap: Record<string, string> = {
      EURUSD: "FX:EURUSD",
      GBPUSD: "FX:GBPUSD",
      USDJPY: "FX:USDJPY",
      AUDUSD: "FX:AUDUSD",
      USDCAD: "FX:USDCAD",
      XAUUSD: "TVC:GOLD",
      BTCUSD: "BITSTAMP:BTCUSD",
      ETHUSD: "BITSTAMP:ETHUSD",
      US30: "TVC:DJI",
      US100: "NASDAQ:NDX",
      US500: "FOREXCOM:SPXUSD",
      USDCHF: "FX:USDCHF",
      NZDUSD: "FX:NZDUSD",
      EURJPY: "FX:EURJPY",
      GBPJPY: "FX:GBPJPY",
      XAGUSD: "TVC:SILVER",
      USOIL: "TVC:USOIL",
    };

    const tvSymbol = symbolMap[symbol] || `FX:${symbol}`;

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "15",
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      allow_symbol_change: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol]);

  return (
    <div className="tradingview-widget-container h-full w-full" ref={containerRef}>
      <div className="tradingview-widget-container__widget h-full w-full"></div>
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
