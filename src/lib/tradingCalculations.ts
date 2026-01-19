/**
 * Trading P/L and Pip Calculation Utilities
 * 
 * Standard Lot Sizes:
 * - Forex: 1 lot = 100,000 units of base currency
 * - Gold (XAUUSD): 1 lot = 100 oz
 * - Silver (XAGUSD): 1 lot = 5,000 oz
 * - Crypto: 1 lot = 1 unit (BTC/ETH)
 * - Indices: 1 lot = $1 per point movement
 */

interface Asset {
  symbol: string;
  pip_value: number;
  asset_type: string;
  quote_currency?: string | null;
  lot_size?: number;
}

interface PipCalculationResult {
  pips: number;
  pipValue: number;
  profitLoss: number;
}

/**
 * Get pip value based on asset type
 * Returns the smallest price increment for the asset
 */
export function getPipSize(asset: Asset): number {
  const symbol = asset.symbol;
  
  // JPY pairs - pip is 0.01
  if (symbol.includes('JPY')) {
    return 0.01;
  }
  
  // Gold - pip is 0.01 ($0.01 move)
  if (symbol === 'XAUUSD') {
    return 0.01;
  }
  
  // Silver - pip is 0.001
  if (symbol === 'XAGUSD') {
    return 0.001;
  }
  
  // Crypto - pip is 0.01 for BTC/ETH (we count $0.01 as a pip)
  if (symbol === 'BTCUSD' || symbol === 'ETHUSD') {
    return 0.01;
  }
  
  // Indices
  if (symbol === 'US30' || symbol === 'US100') {
    return 1; // 1 point
  }
  if (symbol === 'US500') {
    return 0.1; // 0.1 point
  }
  
  // Standard forex pairs - pip is 0.0001
  return 0.0001;
}

/**
 * Calculate the monetary value of 1 pip for a given lot size
 * This is what you gain/lose per pip movement
 * 
 * Standard values per 1.0 lot:
 * - Forex (XXX/USD): $10 per pip
 * - Forex (XXX/JPY): ~$6.50-7.50 per pip (depends on USD/JPY rate)
 * - Gold: $1 per pip (0.01 move × 100 oz)
 * - Silver: $5 per pip (0.001 move × 5000 oz)
 * - Crypto: Varies based on contract size
 * - Indices: $1 per point for 1 lot
 */
export function getPipValuePerLot(asset: Asset, currentPrice?: number): number {
  const symbol = asset.symbol;
  
  // USD quote pairs (EURUSD, GBPUSD, etc.) - $10 per pip per standard lot
  if (asset.quote_currency === 'USD' && asset.asset_type === 'forex') {
    return 10; // $10 per pip for 1.0 lot
  }
  
  // JPY pairs - approximately $6.67 per pip (assuming USDJPY ~150)
  // Formula: (0.01 / USDJPY) × 100,000 = pip value
  if (symbol.includes('JPY')) {
    const usdJpyRate = currentPrice || 150; // Fallback if no rate available
    if (symbol === 'USDJPY') {
      return (0.01 / usdJpyRate) * 100000;
    }
    // For cross JPY pairs, we use an approximation
    return 6.67; // Approximate value
  }
  
  // Non-USD quote forex (USDCAD, USDCHF, etc.)
  // Pip value varies with exchange rate
  if (asset.asset_type === 'forex') {
    // For simplicity, we'll use $10 (would need current rate for exact calculation)
    return 10;
  }
  
  // Gold (XAUUSD) - 1 lot = 100 oz, pip = $0.01
  // Pip value = 0.01 × 100 = $1 per pip per lot
  if (symbol === 'XAUUSD') {
    return 1; // $1 per pip (0.01 move) per 1.0 lot
  }
  
  // Silver (XAGUSD) - 1 lot = 5,000 oz, pip = $0.001
  // Pip value = 0.001 × 5000 = $5 per pip per lot
  if (symbol === 'XAGUSD') {
    return 5; // $5 per pip (0.001 move) per 1.0 lot
  }
  
  // Crypto (BTCUSD, ETHUSD) - 1 lot = 1 unit
  // Pip value = $0.01 per pip per lot (1 BTC or 1 ETH)
  if (symbol === 'BTCUSD' || symbol === 'ETHUSD') {
    return 0.01; // $0.01 per pip per 1.0 lot (1 contract)
  }
  
  // Indices - 1 lot = $1 per point
  if (symbol === 'US30' || symbol === 'US100') {
    return 1; // $1 per point per lot
  }
  if (symbol === 'US500') {
    return 1; // $1 per 0.1 point (pip) per lot
  }
  
  // Default fallback
  return 10;
}

/**
 * Calculate pips and P/L for a position
 */
export function calculatePositionPL(
  asset: Asset,
  positionType: 'buy' | 'sell',
  entryPrice: number,
  currentPrice: number,
  lotSize: number
): PipCalculationResult {
  // Calculate price difference based on position type
  const priceDiff = positionType === 'buy' 
    ? currentPrice - entryPrice 
    : entryPrice - currentPrice;
  
  // Get pip size for this asset
  const pipSize = getPipSize(asset);
  
  // Calculate number of pips
  const pips = priceDiff / pipSize;
  
  // Get pip value per standard lot
  const pipValuePerLot = getPipValuePerLot(asset, currentPrice);
  
  // Calculate P/L: pips × pip_value_per_lot × lot_size
  const profitLoss = pips * pipValuePerLot * lotSize;
  
  return {
    pips: Math.round(pips * 10) / 10, // Round to 1 decimal
    pipValue: pipValuePerLot * lotSize,
    profitLoss: Math.round(profitLoss * 100) / 100, // Round to cents
  };
}

/**
 * Format pip display based on asset type
 */
export function formatPips(pips: number, asset: Asset): string {
  // Indices show as points
  if (asset.asset_type === 'index') {
    return `${pips >= 0 ? '+' : ''}${pips.toFixed(1)} pts`;
  }
  
  // Crypto shows with more precision
  if (asset.asset_type === 'crypto') {
    return `${pips >= 0 ? '+' : ''}${pips.toFixed(0)} pips`;
  }
  
  // Standard forex/commodity
  return `${pips >= 0 ? '+' : ''}${pips.toFixed(1)} pips`;
}

/**
 * Get minimum lot size for an asset
 */
export function getMinLotSize(asset: Asset): number {
  // Crypto can trade smaller sizes
  if (asset.asset_type === 'crypto') {
    return 0.01;
  }
  
  // Standard forex/commodity/indices
  return 0.01;
}

/**
 * Get lot size step (increment) for an asset
 */
export function getLotSizeStep(asset: Asset): number {
  return 0.01;
}

/**
 * Validate lot size for an asset
 */
export function isValidLotSize(lotSize: number, asset: Asset): boolean {
  const minLot = getMinLotSize(asset);
  const step = getLotSizeStep(asset);
  
  if (lotSize < minLot) return false;
  if (lotSize > 100) return false; // Max 100 lots
  
  // Check if it's a valid increment
  const remainder = (lotSize - minLot) % step;
  return Math.abs(remainder) < 0.0001;
}
