import { useEffect, useRef, memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";

interface TradingViewChartProps {
  symbol: string;
  onFullscreenChange?: (isFullscreen: boolean) => void;
  onPriceUpdate?: (price: number) => void;
}

function TradingViewChartComponent({ symbol, onFullscreenChange, onPriceUpdate }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    // Charts come from Bitstamp, matching the live price feed.
    const tvSymbol = `BITSTAMP:${symbol}`;

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

      {/* TradingView Chart Container */}
      <div className="tradingview-widget-container h-full w-full" ref={containerRef}>
        <div className="tradingview-widget-container__widget h-full w-full"></div>
      </div>
    </div>
  );
}

export const TradingViewChart = memo(TradingViewChartComponent);
