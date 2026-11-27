import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '@testing-library/react';
import ToastViewport from '../components/common/ToastViewport';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Empty by design: zero files anywhere in src/ (including tests and test-utils) may use React Context APIs
export const CONTEXT_USAGE_ALLOWLIST = [];

function collectAllSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry !== 'node_modules' && entry !== 'dist') {
        collectAllSourceFiles(fullPath, out);
      }
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
      out.push(fullPath);
    }
  }
  return out.sort();
}

describe('Zero React Context Usage Scan & Fail-Loud Provider Guard', () => {
  const srcDir = path.resolve(__dirname, '..');
  const allFiles = collectAllSourceFiles(srcDir);

  // Build pattern tokens from pieces so this scan file never triggers its own rules
  const kUseContext = 'use' + 'Context';
  const kCreateContext = 'create' + 'Context';
  const kReactReduxCtx = 'ReactRedux' + 'Context';
  const kProviderProp = '.' + 'Provider';
  const kConsumerProp = '.' + 'Consumer';
  const kContextType = 'context' + 'Type';

  const checks = [
    { label: kUseContext, rx: new RegExp(`\\b${kUseContext}\\b`) },
    { label: `React.${kUseContext}`, rx: new RegExp(`\\bReact\\.${kUseContext}\\b`) },
    { label: `${kUseContext} alias`, rx: new RegExp(`\\b${kUseContext}\\s+as\\b`) },
    { label: kCreateContext, rx: new RegExp(`\\b${kCreateContext}\\b`) },
    { label: kReactReduxCtx, rx: new RegExp(`\\b${kReactReduxCtx}\\b`) },
    { label: kProviderProp, rx: new RegExp(`\\${kProviderProp}\\b`) },
    { label: kConsumerProp, rx: new RegExp(`\\${kConsumerProp}\\b`) },
    { label: kContextType, rx: new RegExp(`\\b${kContextType}\\b`) },
    {
      label: 'use imported from react',
      rx: new RegExp(`import\\s*\\{[^}]*\\buse\\b[^}]*\\}\\s*from\\s*['"]react['"]`),
    },
    {
      label: 'React.' + 'use(',
      rx: new RegExp('\\bReact\\.' + 'use\\s*\\('),
    },
    {
      label: 'Context object imported from react-redux or react-router',
      rx: new RegExp(
        `import\\s*\\{[^}]*\\b(?!use[A-Z])[A-Za-z0-9_]*${'Context'}[A-Za-z0-9_]*\\b[^}]*\\}\\s*from\\s*['"](react-redux|react-router(?:-dom)?)['"]`,
      ),
    },
  ];

  it('guarantees zero React context APIs or store context fallbacks anywhere in src/', () => {
    const violations = [];
    for (const filePath of allFiles) {
      const rel = path.relative(srcDir, filePath).replace(/\\/g, '/');
      const content = fs.readFileSync(filePath, 'utf-8');
      for (const { label, rx } of checks) {
        if (rx.test(content)) {
          violations.push(`${rel} [${label}]`);
        }
      }
    }

    const unexpected = violations.filter((v) => !CONTEXT_USAGE_ALLOWLIST.includes(v));
    expect(unexpected).toEqual([]);
    expect(violations).toEqual(CONTEXT_USAGE_ALLOWLIST);
  });

  it('ToastViewport throws react-redux Provider error loudly when rendered outside <Provider>', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => render(<ToastViewport />)).toThrow(/could not find react-redux context value/i);
    } finally {
      errSpy.mockRestore();
    }
  });
});
