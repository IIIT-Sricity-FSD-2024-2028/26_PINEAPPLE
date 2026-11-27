import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Empty in Phase 13: zero components, pages, routes, or hooks may import *Api / apiClient / tokenManager directly
export const DIRECT_API_IMPORT_ALLOWLIST = [];

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['test', '__tests__', 'node_modules'].includes(entry)) {
        collectSourceFiles(fullPath, out);
      }
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
      out.push(fullPath);
    }
  }
  return out;
}

describe('Phase 0 Architectural Scan: No Direct *Api / apiClient Imports in UI Files', () => {
  const srcDir = path.resolve(__dirname, '..');
  const files = collectSourceFiles(srcDir);
  const apiImportRx =
    /from\s+['"][^'"]*services\/(?:[a-zA-Z0-9_]+Api|apiClient|tokenManager)(?:\.js)?['"]/;

  it('prevents components/pages/routes/hooks/contexts outside the allowlist from importing API modules directly', () => {
    const offendingFiles = [];
    for (const filePath of files) {
      const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
      const isUiLayer =
        rel === 'App.jsx' ||
        rel.startsWith('components/') ||
        rel.startsWith('pages/') ||
        rel.startsWith('routes/') ||
        rel.startsWith('hooks/') ||
        rel.startsWith('context/');
      if (!isUiLayer) continue;

      const content = fs.readFileSync(filePath, 'utf-8');
      if (apiImportRx.test(content)) {
        offendingFiles.push(rel);
      }
    }

    const unexpected = offendingFiles.filter(
      (f) => !DIRECT_API_IMPORT_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
    expect(offendingFiles.sort()).toEqual(
      [...DIRECT_API_IMPORT_ALLOWLIST].sort(),
    );
  });

  it('prevents any React create context data providers from existing in src/', () => {
    const contextProviders = [];
    const createCtxRx = new RegExp(`\\b${'create' + 'Context'}\\b`);
    for (const filePath of files) {
      const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');
      if (createCtxRx.test(content)) {
        contextProviders.push(rel);
      }
    }
    expect(contextProviders).toEqual([]);
  });
});
