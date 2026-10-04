const MAX_QUOTE_AGE_MS = 5000;

/**
 * @typedef {Object} TradingQuote
 * @property {number} bid
 * @property {number} ask
 * @property {number} observedAt
 */

/**
 * @param {TradingQuote} quote
 * @param {number} [now]
 */
export const isTradingQuoteFresh = (quote, now = Date.now()) =>
  Number.isFinite(quote.observedAt) &&
  quote.observedAt <= now &&
  now - quote.observedAt <= MAX_QUOTE_AGE_MS;

/**
 * @param {string} positionType
 * @param {number} marketPrice
 * @param {number | null} stopLoss
 * @param {number | null} takeProfit
 * @returns {"sl_hit" | "tp_hit" | null}
 */
export const getPositionExitAction = (positionType, marketPrice, stopLoss, takeProfit) => {
  if (positionType !== "buy" && positionType !== "sell") return null;

  const stopTriggered = stopLoss !== null && (
    positionType === "buy" ? marketPrice <= stopLoss : marketPrice >= stopLoss
  );
  const targetTriggered = takeProfit !== null && (
    positionType === "buy" ? marketPrice >= takeProfit : marketPrice <= takeProfit
  );
  return stopTriggered ? "sl_hit" : targetTriggered ? "tp_hit" : null;
};
