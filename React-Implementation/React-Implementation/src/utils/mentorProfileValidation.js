export const PRICE_MIN = 1;
export const PRICE_MAX = 100000;
export const INVALID_PRICE_MESSAGE = 'Enter a whole number between 1 and 100,000';

export function validatePriceInput(val) {
  if (val === '' || val === null || val === undefined) {
    return INVALID_PRICE_MESSAGE;
  }
  const str = String(val).trim();
  if (!/^\d+$/.test(str)) {
    return INVALID_PRICE_MESSAGE;
  }
  const num = Number(str);
  if (!Number.isInteger(num) || num < PRICE_MIN || num > PRICE_MAX) {
    return INVALID_PRICE_MESSAGE;
  }
  return '';
}
