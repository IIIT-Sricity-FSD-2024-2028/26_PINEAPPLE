import { ValidationPipe } from '@nestjs/common';

/**
 * Global Validation Pipe Configuration
 * Automatically validates DTOs using class-validator and class-transformer
 */
export function getValidationPipeConfig(): ValidationPipe {
  return new ValidationPipe({
    // Automatically remove non-whitelisted properties from the request
    whitelist: true,

    // Safely ignore and strip non-whitelisted properties without rejecting request
    forbidNonWhitelisted: false,

    // Automatically transform payloads to match DTO class definitions
    transform: true,

    // Additional transformation options
    transformOptions: {
      // Enable implicit type conversion (string to number, etc.)
      enableImplicitConversion: true,
    },

    // Disable detailed error messages in production if needed
    errorHttpStatusCode: 400,
  });
}
