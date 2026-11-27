import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Ignore generated build outputs, coverage reports, uploads, logs, and data artifacts
  globalIgnores(['dist', 'build', 'coverage', 'uploads', 'data', 'logs']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Vite, Vitest, and ESLint config files execute in Node rather than the browser
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Test files run under Vitest/Node (using Node globals like __dirname, process, Buffer)
    // and never participate in Vite HMR Fast Refresh
    files: ['src/test/**/*.{js,jsx}', 'src/**/*.test.{js,jsx}', 'src/**/__tests__/**/*.{js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
])
