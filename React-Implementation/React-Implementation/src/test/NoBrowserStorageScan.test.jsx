import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Empty in Phase 13: zero files in src/ may touch browser storage or utils/storage.js
export const BROWSER_STORAGE_ALLOWLIST = [];

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

describe('Phase 0 Architectural Scan: No Browser Storage (Decision D4)', () => {
  const srcDir = path.resolve(__dirname, '..');
  const files = collectSourceFiles(srcDir);
  const forbiddenPatterns = [
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bdocument\.cookie\b/,
    /\bindexedDB\b/,
    /from\s+['"][^'"]*storage(?:\.js)?['"]/,
    /\bstorage\.(?:get|set|clear|consume)/,
  ];

  it('prevents any new file from using localStorage, sessionStorage, cookies, indexedDB, or storage.js', () => {
    const offendingFiles = [];
    for (const filePath of files) {
      const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');
      if (forbiddenPatterns.some((rx) => rx.test(content))) {
        offendingFiles.push(rel);
      }
    }

    const unexpected = offendingFiles.filter(
      (f) => !BROWSER_STORAGE_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
    expect(offendingFiles.sort()).toEqual([...BROWSER_STORAGE_ALLOWLIST].sort());
  });
});
