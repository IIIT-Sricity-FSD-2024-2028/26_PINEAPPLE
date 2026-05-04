import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

/**
 * Exports the Swagger/OpenAPI document to a JSON file.
 * Used for API documentation and external tooling integration.
 */
export function exportSwaggerToFile(document: Record<string, any>): void {
  try {
    const docsDir = join(process.cwd(), 'docs');
    mkdirSync(docsDir, { recursive: true });

    const filePath = join(docsDir, 'swagger.json');
    writeFileSync(filePath, JSON.stringify(document, null, 2), 'utf-8');

    console.log(`✅ Swagger spec exported to: ${filePath}`);
  } catch (error) {
    console.error('❌ Failed to export Swagger spec:', error);
    // Continue app startup even if export fails
  }
}
