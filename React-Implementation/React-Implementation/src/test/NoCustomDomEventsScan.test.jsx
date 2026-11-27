import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Empty in Phase 13: zero files in src/ may dispatch or listen for teamforge:* DOM events
export const CUSTOM_DOM_EVENTS_ALLOWLIST = [];

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

describe('Phase 0 Architectural Scan: No teamforge:* Custom DOM Events (Decision D9)', () => {
  const srcDir = path.resolve(__dirname, '..');
  const files = collectSourceFiles(srcDir);

  it('prevents new files from dispatching or listening for teamforge:* custom DOM events', () => {
    const offendingFiles = [];
    for (const filePath of files) {
      const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');
      if (content.includes('teamforge:')) {
        offendingFiles.push(rel);
      }
    }

    const unexpected = offendingFiles.filter(
      (f) => !CUSTOM_DOM_EVENTS_ALLOWLIST.includes(f),
    );
    expect(unexpected).toEqual([]);
    expect(offendingFiles.sort()).toEqual(
      [...CUSTOM_DOM_EVENTS_ALLOWLIST].sort(),
    );
  });
});
