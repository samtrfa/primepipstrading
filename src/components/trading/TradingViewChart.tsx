import { useEffect, useRef, memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

interface Position {
  id: string;
  position_type: string;
  entry_price: number;
  stop_loss: number | null;
  take_profit: number | null;
  lot_size: number;
  profit_loss?: number;
}

interface TradingViewChartProps {
  symbol: string;
  positions?: Position[];
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onPriceUpdate?: (price: number) => void;
}

function TradingViewChartComponent({ symbol, positions = [], onFullscreenChange, onPriceUpdate }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
      save_image: true,
      calendar: false,
      hide_volume: false,
      support_host: "https://www.tradingview.com",
      withdateranges: true,
      details: true,
      hotlist: false,
      show_popup_button: false,
    });

    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
    };
  }, [symbol]);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNowFullscreen = document.fullscreenElement === wrapperRef.current;
      setIsFullscreen(isNowFullscreen);
      onFullscreenChange?.(isNowFullscreen);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onFullscreenChange]);

  const toggleFullscreen = async () => {
    if (!wrapperRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await wrapperRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  };

  const openPositions = positions.filter(p => p.position_type);

  return (
    <div 
      ref={wrapperRef} 
      className={`relative h-full w-full ${isFullscreen ? 'bg-background' : ''}`}
    >
      {/* Fullscreen Toggle Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={toggleFullscreen}
        className="absolute top-2 right-2 z-20 h-8 w-8 bg-background/80 backdrop-blur-sm hover:bg-background"
      >
        {isFullscreen ? (
          <Minimize2 className="h-4 w-4" />
        ) : (
          <Maximize2 className="h-4 w-4" />
        )}
      </Button>

      {/* Positions Overlay - Shows active positions on chart */}
      {openPositions.length > 0 && (
        <div className="absolute top-2 left-2 z-20 space-y-1 max-w-[200px]">
          {openPositions.slice(0, 5).map((position) => (
            <div
              key={position.id}
              className={`text-[10px] px-2 py-1 rounded backdrop-blur-sm border ${
                position.position_type === "buy"
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-red-500/20 border-red-500/40 text-red-400"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold uppercase">
                  {position.position_type} {position.lot_size}
                </span>
                <span>@ {position.entry_price.toFixed(5)}</span>
              </div>
              {(position.stop_loss || position.take_profit) && (
                <div className="flex gap-2 text-[9px] opacity-80">
                  {position.stop_loss && <span>SL: {position.stop_loss}</span>}
                  {position.take_profit && <span>TP: {position.take_profit}</span>}
                </div>
              )}
            </div>
          ))}
          {openPositions.length > 5 && (
            <div className="text-[10px] px-2 py-1 text-muted-foreground">
              +{openPositions.length - 5} more positions
            </div>
          )}
        </div>
      )}

      {/* TradingView Chart Container */}
      <div className="tradingview-widget-container h-full w-full" ref={containerRef}>
        <div className="tradingview-widget-container__widget h-full w-full"></div>
      </div>
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
