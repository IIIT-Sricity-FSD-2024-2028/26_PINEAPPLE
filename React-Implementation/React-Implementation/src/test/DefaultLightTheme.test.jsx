import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useEffect } from 'react';
import { Provider, useDispatch, useSelector } from 'react-redux';
import { MemoryRouter, Routes, Route, Link } from 'react-router-dom';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import AdminLayout from '../pages/admin/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminLogin from '../pages/admin/AdminLogin';
import { createAppStore } from '../store';
import { getInitialTheme, toggleTheme } from '../store/slices/uiSlice';
import { selectTheme } from '../store/selectors/uiSelectors';
import { applyThemeTokens } from '../store/utils/themeTokens';
import RouteResetListener from '../store/components/RouteResetListener';
import { renderWithStore } from './test-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const srcDir = path.resolve(__dirname, '..');

vi.mock('../services/authApi', () => ({
  default: {
    getBootInfo: vi.fn().mockResolvedValue({ bootId: 'test-boot' }),
    refresh: vi.fn().mockResolvedValue(null),
    getMe: vi.fn().mockResolvedValue(null),
  },
  authApi: {
    getBootInfo: vi.fn().mockResolvedValue({ bootId: 'test-boot' }),
    refresh: vi.fn().mockResolvedValue(null),
    getMe: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../services/platformConfigApi', () => ({
  default: {
    getPublicConfig: vi.fn().mockResolvedValue({ maintenanceMode: false }),
  },
  platformConfigApi: {
    getPublicConfig: vi.fn().mockResolvedValue({ maintenanceMode: false }),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getStats: vi.fn().mockResolvedValue({ users: 1, mentors: 0, openReports: 0 }),
    getAuditLog: vi.fn().mockResolvedValue([]),
    login: vi.fn(),
  },
  adminApi: {
    getStats: vi.fn().mockResolvedValue({ users: 1, mentors: 0, openReports: 0 }),
    getAuditLog: vi.fn().mockResolvedValue([]),
    login: vi.fn(),
  },
}));

vi.mock('../services/reportsApi', () => ({
  default: {
    getOpenCount: vi.fn().mockResolvedValue({ count: 0 }),
  },
  reportsApi: {
    getOpenCount: vi.fn().mockResolvedValue({ count: 0 }),
  },
}));

function collectSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['test', '__tests__', 'node_modules', 'dist'].includes(entry)) {
        collectSourceFiles(fullPath, out);
      }
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx') || entry.endsWith('.css')) {
      out.push(fullPath);
    }
  }
  return out;
}

describe('Default Light Theme Policy & Regression Suite', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it('1. Initial theme is light even when matchMedia prefers dark, and <App /> first render sets data-theme="light"', () => {
    expect(window.matchMedia('(prefers-color-scheme: dark)').matches).toBe(true);
    expect(getInitialTheme()).toBe('light');

    const store = createAppStore();
    expect(selectTheme(store.getState())).toBe('light');

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/login']}>
          <App />
        </MemoryRouter>
      </Provider>,
    );

    expect(selectTheme(store.getState())).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('2. Theme toggle switches to dark and back, survives navigation, uses no browser storage, and resets to light on reload', () => {
    function ThemeNavHarness() {
      const dispatch = useDispatch();
      const theme = useSelector(selectTheme);
      useEffect(() => {
        applyThemeTokens(theme);
      }, [theme]);

      return (
        <div>
          <span data-testid="theme-readout">{theme}</span>
          <button type="button" onClick={() => dispatch(toggleTheme())}>
            Toggle Theme
          </button>
          <Link to="/dashboard">Dashboard</Link>
        </div>
      );
    }

    const store = createAppStore();
    renderWithStore(
      <>
        <RouteResetListener />
        <Routes>
          <Route path="/" element={<ThemeNavHarness />} />
          <Route path="/dashboard" element={<ThemeNavHarness />} />
        </Routes>
      </>,
      { store, route: '/' },
    );

    expect(screen.getByTestId('theme-readout').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    fireEvent.click(screen.getByRole('button', { name: 'Toggle Theme' }));
    expect(screen.getByTestId('theme-readout').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Survives in-app navigation
    fireEvent.click(screen.getByRole('link', { name: 'Dashboard' }));
    expect(screen.getByTestId('theme-readout').textContent).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');

    // Toggle back to light
    fireEvent.click(screen.getByRole('button', { name: 'Toggle Theme' }));
    expect(screen.getByTestId('theme-readout').textContent).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    // No browser storage used (Redux conversion case)
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);

    // Reload -> fresh store defaults back to light even when OS prefers dark
    const reloadedStore = createAppStore();
    expect(selectTheme(reloadedStore.getState())).toBe('light');
  });

  it('3. Admin shell and /admin/login start in light mode without hardcoded dark GitHub fallbacks', async () => {
    const store = createAppStore({
      session: {
        portalRole: 'SuperUser',
        isSuperUser: true,
        permissions: ['*'],
        isAuthenticated: true,
        initialized: true,
      },
    });

    function AdminHarness() {
      const theme = useSelector(selectTheme);
      useEffect(() => {
        applyThemeTokens(theme);
      }, [theme]);
      return <AdminLayout />;
    }

    renderWithStore(
      <Routes>
        <Route path="/admin" element={<AdminHarness />}>
          <Route index element={<AdminDashboard />} />
        </Route>
        <Route path="/admin/login" element={<AdminLogin />} />
      </Routes>,
      { store, route: '/admin' },
    );

    await waitFor(() => {
      expect(selectTheme(store.getState())).toBe('light');
      expect(document.documentElement.getAttribute('data-theme')).toBe('light');
      expect(screen.getByText(/Exit Portal/i)).toBeDefined();
    });

    const adminLoginCss = fs.readFileSync(
      path.join(srcDir, 'pages/admin/AdminLogin.css'),
      'utf-8',
    );
    expect(adminLoginCss).not.toMatch(/#0d1117/i);
    expect(adminLoginCss).not.toMatch(/#161b22/i);
    expect(adminLoginCss).not.toMatch(/color:\s*#ffffff\s*!important/i);
  });

  it('4. index.html sets pre-paint data-theme="light" and color-scheme="light" without localStorage', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf-8');
    expect(html).toMatch(/<html[^>]*\bdata-theme=["']light["']/i);
    expect(html).toMatch(/<meta[^>]*name=["']color-scheme["'][^>]*content=["']light["']/i);
    expect(html).not.toMatch(/localStorage/);
    expect(html).not.toMatch(/prefers-color-scheme/);
  });

  it('5. Scan: zero prefers-color-scheme occurrences exist in source JS/JSX/CSS/HTML files', () => {
    const files = collectSourceFiles(srcDir);
    files.push(path.join(projectRoot, 'index.html'));
    const offenders = files
      .filter((f) => /prefers-color-scheme/i.test(fs.readFileSync(f, 'utf-8')))
      .map((f) => path.relative(projectRoot, f).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});
