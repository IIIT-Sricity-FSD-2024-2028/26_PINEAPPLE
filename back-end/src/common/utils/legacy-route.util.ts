import { GoneException } from '@nestjs/common';

/** Throws a standardized 410 LEGACY_ENDPOINT_REMOVED response naming the canonical replacement. */
export function throwLegacyEndpointRemoved(endpoint: string, replacement: string): never {
  throw new GoneException({
    statusCode: 410,
    error: 'Gone',
    code: 'LEGACY_ENDPOINT_REMOVED',
    message: `Legacy endpoint ${endpoint} has been retired. Use ${replacement} instead.`,
  });
}
