import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface Asset {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  pip_value?: number;
}

interface AssetSelectorProps {
  assets: Asset[];
  selectedAsset: Asset | null;
  onAssetChange: (asset: Asset) => void;
  prices: Record<string, { bid: number; ask: number }>;
}

export function AssetSelector({
  assets,
  selectedAsset,
  onAssetChange,
  prices,
}: AssetSelectorProps) {
  // Group assets by type
  const groupedAssets = assets.reduce((acc, asset) => {
    if (!acc[asset.asset_type]) {
      acc[asset.asset_type] = [];
    }
    acc[asset.asset_type].push(asset);
    return acc;
  }, {} as Record<string, Asset[]>);

  const formatPrice = (symbol: string, price: number) => {
    if (symbol.includes("JPY")) return price.toFixed(3);
    if (symbol.includes("BTC") || symbol.includes("ETH")) return price.toFixed(2);
    if (symbol.includes("XAU") || symbol.includes("XAG")) return price.toFixed(2);
    if (symbol.includes("US30") || symbol.includes("US100") || symbol.includes("US500")) return price.toFixed(2);
    if (symbol.includes("OIL")) return price.toFixed(2);
    return price.toFixed(5);
  };

  const handleValueChange = (assetId: string) => {
    const asset = assets.find((a) => a.id === assetId);
    if (asset) {
      onAssetChange(asset);
    }
  };

  return (
    <Select
      value={selectedAsset?.id || ""}
      onValueChange={handleValueChange}
    >
      <SelectTrigger className="w-full bg-background border-border">
        <SelectValue placeholder="Select an asset">
          {selectedAsset && (
            <div className="flex items-center justify-between w-full gap-2">
              <span className="font-semibold">{selectedAsset.symbol}</span>
              {prices[selectedAsset.symbol] && (
                <span className="text-xs text-muted-foreground">
                  {formatPrice(selectedAsset.symbol, prices[selectedAsset.symbol].bid)}
                </span>
              )}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {Object.entries(groupedAssets).map(([type, typeAssets]) => (
          <SelectGroup key={type}>
            <SelectLabel className="text-xs uppercase text-muted-foreground tracking-wider">
              {type}
            </SelectLabel>
            {typeAssets.map((asset) => {
              const price = prices[asset.symbol];
              return (
                <SelectItem
                  key={asset.id}
                  value={asset.id}
                  className="cursor-pointer"
                >
                  <div className="flex items-center justify-between w-full gap-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{asset.symbol}</span>
                      <span className="text-xs text-muted-foreground hidden sm:inline">
                        {asset.name}
                      </span>
                    </div>
                    {price && (
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-red-500">
                          {formatPrice(asset.symbol, price.bid)}
                        </span>
                        <span className="text-muted-foreground">/</span>
                        <span className="text-green-500">
                          {formatPrice(asset.symbol, price.ask)}
                        </span>
                      </div>
                    )}
                  </div>
                </SelectItem>
              );
            })}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
