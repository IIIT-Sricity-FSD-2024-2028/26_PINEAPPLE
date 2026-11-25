import { BadRequestException } from '@nestjs/common';

export const PRICE_MIN = 1;
export const PRICE_MAX = 100000;
export const INVALID_PRICE_MESSAGE = 'Enter a whole number between 1 and 100,000';

/**
 * Validates that session price is a whole number of rupees between PRICE_MIN and PRICE_MAX.
 * Rejects decimals, negative values, 0, non-numeric strings, and out-of-range numbers.
 * Throws 400 BadRequestException with code: 'INVALID_PRICE'.
 */
export function validateMentorPrice(price: any): number {
  if (price === undefined || price === null || price === '') {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_PRICE',
      message: INVALID_PRICE_MESSAGE,
    });
  }

  // If string, reject if it has non-digit characters or decimals (e.g. "12.5", "abc")
  if (typeof price === 'string') {
    const trimmed = price.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'INVALID_PRICE',
        message: INVALID_PRICE_MESSAGE,
      });
    }
  }

  const num = typeof price === 'number' ? price : Number(price);

  if (
    typeof num !== 'number' ||
    isNaN(num) ||
    !Number.isInteger(num) ||
    num < PRICE_MIN ||
    num > PRICE_MAX
  ) {
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      code: 'INVALID_PRICE',
      message: INVALID_PRICE_MESSAGE,
    });
  }

  return num;
}
