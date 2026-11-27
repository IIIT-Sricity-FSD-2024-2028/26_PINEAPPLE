import { describe, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FRONTEND_ROOT = path.resolve(__dirname, '../..');
const REPO_ROOT = path.resolve(FRONTEND_ROOT, '../..');
const BACKEND_ROOT = path.join(REPO_ROOT, 'back-end');
const MAX_ALLOWED_DISABLES = 0;

function collectCodeFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'build' || entry === 'coverage') {
      continue;
    }
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      collectCodeFiles(full, out);
    } else if (/\.(js|jsx|ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe('Lint & Disable-Directive Guard Scan', () => {
  it('passes ESLint on src with --max-warnings 0', () => {
    const eslintEntry = path.join(FRONTEND_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');
    const output = execFileSync(
      process.execPath,
      [eslintEntry, 'src', '--max-warnings', '0'],
      { cwd: FRONTEND_ROOT, encoding: 'utf8' },
    );
    expect(output).toBeDefined();
  }, 120000);

  it('allows zero eslint-disable directives (and requires a written reason if any ever exist)', () => {
    const files = [
      ...collectCodeFiles(path.join(FRONTEND_ROOT, 'src')),
      ...collectCodeFiles(path.join(BACKEND_ROOT, 'src')),
      ...collectCodeFiles(path.join(BACKEND_ROOT, 'test')),
    ].filter((f) => path.resolve(f) !== path.resolve(__filename));

    const directiveRe = /\beslint-disable(?:-next-line|-line)?\b/;
    const found = [];
    const withoutReason = [];

    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      lines.forEach((line, idx) => {
        if (!directiveRe.test(line)) return;
        const rel = path.relative(REPO_ROOT, file).replace(/\\/g, '/');
        found.push(`${rel}:${idx + 1}`);
        // Require either a `-- reason` on the directive line or an explanatory comment right above
        const hasInlineReason = /--\s*\S+/.test(line);
        const prevLine = idx > 0 ? lines[idx - 1].trim() : '';
        const hasPrevComment = prevLine.startsWith('//') || prevLine.startsWith('/*') || prevLine.startsWith('*');
        if (!hasInlineReason && !hasPrevComment) {
          withoutReason.push(`${rel}:${idx + 1}`);
        }
      });
    }

    expect(withoutReason).toEqual([]);
    expect(found.length).toBeLessThanOrEqual(MAX_ALLOWED_DISABLES);
  });
});
