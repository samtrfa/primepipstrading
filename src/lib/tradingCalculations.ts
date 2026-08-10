/**
 * Crypto Trading P/L, Pip and Lot Calculations
 *
 * The platform trades crypto CFDs quoted in USD only.
 * 1 lot = CONTRACT_SIZE units of the base coin (chosen so 1 lot is a
 * comparable notional across coins, the way brokers scale low-priced coins).
 *
 *   P/L (USD) = priceDiff * contractSize * lots
 *   pips      = priceDiff / pipSize
 *   pip value = pipSize * contractSize * lots
 */

interface Asset {
  symbol: string;
  pip_value?: number | null;
  asset_type: string;
  quote_currency?: string | null;
  lot_size?: number | null;
}

interface PipCalculationResult {
  pips: number;
  pipValue: number;
  profitLoss: number;
}

const base = (symbol: string) => symbol.replace(/USD[TC]?$/i, "").toUpperCase();

/** Units of the base coin per 1.0 lot */
const CONTRACT_SIZE: Record<string, number> = {
  BTC: 1,
  ETH: 1,
  BCH: 10,
  LTC: 10,
  SOL: 10,
  AAVE: 10,
  ETC: 100,
  LINK: 100,
  AVAX: 100,
  DOT: 100,
  UNI: 100,
  NEAR: 100,
  ATOM: 100,
  XTZ: 1000,
  ADA: 1000,
  XRP: 1000,
  ALGO: 1000,
  SAND: 1000,
  DOGE: 10000,
  XLM: 10000,
};

/** Price increment counted as 1 pip */
const PIP_SIZE: Record<string, number> = {
  BTC: 0.01,
  ETH: 0.01,
  BCH: 0.01,
  LTC: 0.01,
  SOL: 0.01,
  AAVE: 0.01,
  ETC: 0.001,
  LINK: 0.001,
  AVAX: 0.001,
  DOT: 0.001,
  UNI: 0.001,
  NEAR: 0.001,
  ATOM: 0.001,
  XTZ: 0.0001,
  ADA: 0.0001,
  XRP: 0.0001,
  ALGO: 0.0001,
  SAND: 0.0001,
  DOGE: 0.00001,
  XLM: 0.00001,
};

export function getContractSize(asset: Asset): number {
  return CONTRACT_SIZE[base(asset.symbol)] ?? 1;
}

export function getPipSize(asset: Asset): number {
  const known = PIP_SIZE[base(asset.symbol)];
  if (known) return known;
  const fromDb = asset.pip_value ?? 0;
  return fromDb > 0 ? fromDb : 0.01;
}

/** USD value of 1 pip for 1.0 lot */
export function getPipValuePerLot(asset: Asset): number {
  return getPipSize(asset) * getContractSize(asset);
}

/** Notional exposure in USD */
export function getNotionalValue(asset: Asset, lots: number, price: number): number {
  return getContractSize(asset) * lots * price;
}

/** Required margin in USD (default 1:20 crypto leverage) */
export function getRequiredMargin(
  asset: Asset,
  lots: number,
  price: number,
  leverage = 20
): number {
  return getNotionalValue(asset, lots, price) / leverage;
}

export function calculatePositionPL(
  asset: Asset,
  positionType: 'buy' | 'sell',
  entryPrice: number,
  currentPrice: number,
  lotSize: number
): PipCalculationResult {
  const priceDiff =
    positionType === 'buy' ? currentPrice - entryPrice : entryPrice - currentPrice;

  const pipSize = getPipSize(asset);
  const contractSize = getContractSize(asset);

  const pips = priceDiff / pipSize;
  const profitLoss = priceDiff * contractSize * lotSize;

  return {
    pips: Math.round(pips * 10) / 10,
    pipValue: Math.round(pipSize * contractSize * lotSize * 100) / 100,
    profitLoss: Math.round(profitLoss * 100) / 100,
  };
}

export function formatPips(pips: number, _asset: Asset): string {
  const abs = Math.abs(pips);
  const decimals = abs >= 100 ? 0 : 1;
  return `${pips >= 0 ? '+' : ''}${pips.toFixed(decimals)} pips`;
}

export function getMinLotSize(_asset: Asset): number {
  return 0.01;
}

export function getLotSizeStep(_asset: Asset): number {
  return 0.01;
}

export function isValidLotSize(lotSize: number, asset: Asset): boolean {
  const minLot = getMinLotSize(asset);
  if (!Number.isFinite(lotSize)) return false;
  if (lotSize < minLot) return false;
  if (lotSize > 100) return false;
  const steps = lotSize / getLotSizeStep(asset);
  return Math.abs(steps - Math.round(steps)) < 1e-6;
}
