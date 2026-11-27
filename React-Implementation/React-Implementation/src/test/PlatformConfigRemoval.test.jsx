import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import SuperuserConfig from '../pages/admin/SuperuserConfig';
import adminApi from '../services/adminApi';
import { renderWithStore } from './test-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const srcDir = path.resolve(__dirname, '..');

vi.mock('../services/adminApi', () => ({
  default: {
    getStats: vi.fn(),
    getConfig: vi.fn(),
    updateConfig: vi.fn(),
    getJobRuns: vi.fn(),
    recordAuditEntry: vi.fn(),
  },
  recordPortalAuditEntry: vi.fn(),
}));

vi.mock('../services/portalAdminsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
  },
}));

function collectNonTestSourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!['test', '__tests__', 'node_modules', 'dist'].includes(entry)) {
        collectNonTestSourceFiles(fullPath, out);
      }
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx') || entry.endsWith('.css')) {
      out.push(fullPath);
    }
  }
  return out;
}

describe('Platform Config: Removal of Demo Data Card & Standard XP Yield Input', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getStats.mockResolvedValue({ activeAdmins: 2, activeUsers: 12 });
    adminApi.getJobRuns.mockResolvedValue([]);
    adminApi.recordAuditEntry.mockResolvedValue({});
    adminApi.getConfig.mockResolvedValue({
      maxProjectsPerUser: 10,
      maxCollaboratorsPerProject: 20,
      mentorMinYearsExperience: 5,
      minimumTenure: 5,
      xpPerTaskCompletion: 50,
      maintenanceMode: false,
      platformVersion: '1.4.2',
    });
    adminApi.updateConfig.mockResolvedValue({
      maxProjectsPerUser: 15,
      maxCollaboratorsPerProject: 20,
      mentorMinYearsExperience: 5,
      minimumTenure: 5,
      xpPerTaskCompletion: 50,
      maintenanceMode: false,
      platformVersion: '1.4.2',
    });
  });

  it('1. Omits Demo data card & Standard XP Yield / Task while keeping Tenure and saving without XP field', async () => {
    renderWithStore(<SuperuserConfig />, {
      route: '/admin/su-config',
      preloadedState: {
        session: {
          portalRole: 'superuser',
          isSuperUser: true,
          adminToken: 'su-token',
          permissions: ['*'],
          isAuthenticated: true,
          status: 'authenticated',
          initialized: true,
        },
      },
    });

    await waitFor(() => {
      expect(adminApi.getConfig).toHaveBeenCalledTimes(1);
    });

    expect(screen.queryByTestId('demo-reset-card')).toBeNull();
    expect(screen.queryByTestId('demo-reset-modal')).toBeNull();
    expect(screen.queryByText(/Demo data/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /Reset to mock data/i })).toBeNull();

    expect(screen.queryByLabelText(/Standard XP Yield \/ Task/i)).toBeNull();
    expect(document.querySelector('input[name="xpPerTaskCompletion"]')).toBeNull();

    const tenureInput = document.querySelector('input[name="mentorMinYearsExperience"]');
    expect(tenureInput).not.toBeNull();
    expect(
      screen.getByText('Platform minimum tenure defaults to 5 and can only be raised (up to 40).'),
    ).toBeDefined();

    // Update a kept field and save
    const quotaInput = document.querySelector('input[name="maxProjectsPerUser"]');
    fireEvent.change(quotaInput, { target: { value: '15' } });
    fireEvent.click(screen.getByTestId('commit-config-btn'));

    await waitFor(() => {
      expect(adminApi.updateConfig).toHaveBeenCalledTimes(1);
    });

    const sentPayload = adminApi.updateConfig.mock.calls[0][0];
    expect(sentPayload.maxProjectsPerUser).toBe(15);
    expect('xpPerTaskCompletion' in sentPayload).toBe(false);
    expect(await screen.findByTestId('config-success-banner')).toBeDefined();
  });

  it('2. SuperuserConfig.jsx has no leftover demo-reset imports or modal markup, and src scan finds zero reset-demo/Reset to mock data', () => {
    const suConfigSrc = fs.readFileSync(
      path.join(srcDir, 'pages/admin/SuperuserConfig.jsx'),
      'utf-8',
    );
    expect(suConfigSrc).not.toMatch(/fetchDemoResetStatus|resetDemoData|setDemoResetModalOpen|selectDemoResetStatus|logoutAdminPortal|formatDateTime/);
    expect(suConfigSrc).not.toMatch(/demo-reset/);

    const files = collectNonTestSourceFiles(srcDir);
    files.push(path.join(projectRoot, 'index.html'));
    const offenders = files
      .filter((filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        return /reset-demo|demo-reset|Reset to mock data/i.test(content);
      })
      .map((f) => path.relative(projectRoot, f).replace(/\\/g, '/'));

    expect(offenders).toEqual([]);
  });
});
