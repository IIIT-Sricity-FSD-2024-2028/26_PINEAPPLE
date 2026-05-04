import { ValidationPipe } from '@nestjs/common';

/**
 * Global Validation Pipe Configuration
 * Automatically validates DTOs using class-validator and class-transformer
 */
export function getValidationPipeConfig(): ValidationPipe {
  return new ValidationPipe({
    // Automatically remove non-whitelisted properties from the request
    whitelist: true,

    // Throw error if non-whitelisted properties are present
    forbidNonWhitelisted: true,

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
