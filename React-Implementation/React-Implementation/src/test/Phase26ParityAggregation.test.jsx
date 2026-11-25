import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { useState } from 'react';
import Modal from '../components/common/Modal';
import ConfirmModal from '../components/common/ConfirmModal';
import ProjectCard from '../components/features/ProjectCard';
import AdminMentorApps from '../pages/admin/AdminMentorApps';
import Notifications from '../pages/notifications';
import { NotificationContext } from '../context/NotificationContext';
import { renderWithProviders } from './test-utils';

const { mockMentorAppsApi, mockAdminApi, mockAppealsApi } = vi.hoisted(() => ({
  mockMentorAppsApi: {
    list: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
  },
  mockAdminApi: {
    getPublicConfig: vi.fn(),
    getMyWarnings: vi.fn(),
  },
  mockAppealsApi: {
    getMyAppeals: vi.fn(),
    submitAppeal: vi.fn(),
  },
}));

vi.mock('../services/mentorApplicationsApi', () => ({
  default: mockMentorAppsApi,
  mentorApplicationsApi: mockMentorAppsApi,
}));

vi.mock('../services/adminApi', () => ({
  default: mockAdminApi,
  adminApi: mockAdminApi,
}));

vi.mock('../services/appealsApi', () => ({
  default: mockAppealsApi,
  appealsApi: mockAppealsApi,
}));

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.resolve(__dirname, '..');

function collectSourceFiles(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'test' || entry.name === 'node_modules') continue;
      results.push(...collectSourceFiles(full));
    } else if (/\.(js|jsx|ts|tsx)$/i.test(entry.name)) {
      results.push(full);
    }
  }
  return results;
}

const USER_URL_EXPR_RE =
  /\b(link|url|href|proof|website|linkedin|portfolio|github|cv|resume|previewUrl|finishedLink|finalLink)\b/i;

function scanRawAnchorsInSource(code, filePath = 'sample.jsx') {
  if (path.basename(filePath) === 'SafeLink.jsx') {
    return [];
  }
  const findings = [];
  const anchorTagRe = /<a\b([\s\S]*?)>/gi;
  let match;
  while ((match = anchorTagRe.exec(code)) !== null) {
    const attrs = match[1];
    const hrefMatch = /\bhref\s*=\s*\{([^}]+)\}/.exec(attrs);
    if (hrefMatch) {
      const expr = hrefMatch[1].trim();
      // Device UPI intent deep link (upi://) in MentorsDirectory demo payment dialog is not a user-supplied URL
      if (/upiUri/i.test(expr)) {
        continue;
      }
      if (USER_URL_EXPR_RE.test(expr) || /\.[a-zA-Z0-9_]+/.test(expr)) {
        findings.push({
          filePath,
          expr,
          snippet: match[0].replace(/\s+/g, ' ').slice(0, 120),
        });
      }
    }
  }
  return findings;
}

describe('Phase 26 Frontend Tests: SafeLink Parity, Accessible Modal & Grouped Notifications', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
    vi.clearAllMocks();
    mockMentorAppsApi.list.mockResolvedValue([]);
    mockAdminApi.getPublicConfig.mockResolvedValue({ mentorMinYearsExperience: 4 });
    mockAdminApi.getMyWarnings.mockResolvedValue([]);
    mockAppealsApi.getMyAppeals.mockResolvedValue([]);
  });

  describe('1. Static Source Scan for User-Supplied Raw Anchors', () => {
    it('passes cleanly across src/ with zero raw <a href={...}> for user-supplied links', () => {
      const files = collectSourceFiles(SRC_ROOT);
      const violations = [];
      for (const file of files) {
        const code = fs.readFileSync(file, 'utf8');
        violations.push(...scanRawAnchorsInSource(code, file));
      }
      expect(violations).toEqual([]);
    });

    it('fails / catches a planted raw <a href={user.portfolioLink}> outside SafeLink', () => {
      const plantedSource = `
        export function BadCard({ user }) {
          return <a href={user.portfolioLink} target="_blank" rel="noopener noreferrer">View</a>;
        }
      `;
      const findings = scanRawAnchorsInSource(plantedSource, 'src/components/BadCard.jsx');
      expect(findings).toHaveLength(1);
      expect(findings[0].expr).toContain('portfolioLink');
    });
  });

  describe('2. SafeLink Conversion in ProjectCard & AdminMentorApps', () => {
    it('renders ProjectCard javascript: finishedLink as plain text without executing or rendering <a>', () => {
      const alertSpy = vi.fn();
      const origAlert = window.alert;
      window.alert = alertSpy;

      try {
        const { container } = render(
          <ProjectCard
            variant="mywork"
            project={{
              id: 'proj-xss',
              title: 'Unsafe Project Link',
              description: 'Testing SafeLink defense.',
              status: 'Completed',
              isCompleted: true,
              owner: 'Owner Test',
              difficulty: 'Easy',
              skills: ['React'],
              finishedLink: 'javascript:alert(1)',
            }}
          />,
        );

        expect(screen.queryByTestId('safelink-anchor')).toBeNull();
        const plain = screen.getByTestId('safelink-plain');
        expect(plain.textContent).toContain('Finished Project');
        expect(container.querySelectorAll('a')).toHaveLength(0);

        fireEvent.click(plain);
        expect(alertSpy).not.toHaveBeenCalled();
      } finally {
        window.alert = origAlert;
      }
    });

    it('opens accessible Leaving TeamForge dialog for external ProjectCard finishedLink', () => {
      render(
        <ProjectCard
          variant="mywork"
          project={{
            id: 'proj-ext',
            title: 'Live Project',
            description: 'External link test.',
            status: 'Completed',
            isCompleted: true,
            owner: 'Owner Test',
            difficulty: 'Medium',
            skills: ['React'],
            finishedLink: 'https://github.com/teamforge/demo-repo',
          }}
        />,
      );

      const link = screen.getByTestId('safelink-anchor');
      fireEvent.click(link);

      const dialog = screen.getByRole('dialog', { name: /leaving teamforge/i });
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(screen.getByTestId('safelink-domain').textContent).toBe('github.com');
    });

    it('renders AdminMentorApps applicant linkedin through SafeLink (blocks javascript: and confirms https://)', async () => {
      mockMentorAppsApi.list.mockResolvedValue([
        {
          id: 'app-unsafe',
          name: 'Alpha Malicious',
          email: 'alpha@example.com',
          status: 'pending',
          yearsOfExperience: 5,
          skills: ['React'],
          bio: 'Experienced mentor applicant bio.',
          linkedin: 'javascript:alert(1)',
        },
        {
          id: 'app-safe',
          name: 'Beta Verified',
          email: 'beta@example.com',
          status: 'pending',
          yearsOfExperience: 6,
          skills: ['Node.js'],
          bio: 'Experienced backend mentor.',
          linkedin: 'https://www.linkedin.com/in/safe-mentor',
        },
      ]);

      renderWithProviders(<AdminMentorApps />);

      await waitFor(() => {
        expect(screen.getByText('Alpha Malicious')).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: /alpha malicious/i }));
      fireEvent.click(screen.getByRole('button', { name: /beta verified/i }));

      expect(screen.getByTestId('safelink-plain')).toBeDefined();
      const safeAnchor = screen.getByTestId('safelink-anchor');
      expect(safeAnchor.getAttribute('href')).toBe('https://www.linkedin.com/in/safe-mentor');

      fireEvent.click(safeAnchor);
      expect(screen.getByRole('dialog', { name: /leaving teamforge/i })).toBeDefined();
      expect(screen.getByTestId('safelink-domain').textContent).toBe('www.linkedin.com');
    });
  });

  describe('3. Accessible Modal Component Behavior', () => {
    it('moves focus inside, traps Tab & Shift+Tab, closes on Escape, locks body scroll, and restores focus to opener', async () => {
      function ModalHarness() {
        const [open, setOpen] = useState(false);
        return (
          <div>
            <button type="button" data-testid="modal-opener" onClick={() => setOpen(true)}>
              Open Accessible Dialog
            </button>
            <Modal
              isOpen={open}
              title="Accessible Dialog Title"
              onClose={() => setOpen(false)}
              footer={
                <button type="button" data-testid="modal-last-btn" onClick={() => setOpen(false)}>
                  Done
                </button>
              }
            >
              <input type="text" data-testid="modal-first-input" aria-label="Dialog input" />
            </Modal>
          </div>
        );
      }

      render(<ModalHarness />);
      const opener = screen.getByTestId('modal-opener');
      opener.focus();
      expect(document.activeElement).toBe(opener);

      fireEvent.click(opener);

      const dialog = screen.getByRole('dialog', { name: 'Accessible Dialog Title' });
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      const titleEl = screen.getByText('Accessible Dialog Title');
      expect(dialog.getAttribute('aria-labelledby')).toBe(titleEl.id);
      expect(document.body.style.overflow).toBe('hidden');

      await waitFor(() => {
        expect(dialog.contains(document.activeElement)).toBe(true);
      });

      // Trap Tab from last focusable -> wraps to first focusable inside dialog
      const closeBtn = screen.getByRole('button', { name: /close modal/i });
      const lastBtn = screen.getByTestId('modal-last-btn');
      lastBtn.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: false });
      expect(document.activeElement).toBe(closeBtn);

      // Trap Shift+Tab from first focusable -> wraps to last focusable inside dialog
      closeBtn.focus();
      fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
      expect(document.activeElement).toBe(lastBtn);

      // Escape closes modal, unlocks scroll, and returns focus to opener button
      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(document.body.style.overflow).toBe('');
      expect(document.activeElement).toBe(opener);
    });

    it('keeps dialog open on Escape and backdrop click while closeDisabled (e.g. money action in progress) is true', () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <ConfirmModal
          isOpen={true}
          title="Confirm Escrow Payment"
          message="Processing ₹1755..."
          loading={true}
          onConfirm={vi.fn()}
          onClose={onClose}
        />,
      );

      expect(screen.getByRole('dialog', { name: 'Confirm Escrow Payment' })).toBeDefined();
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();

      rerender(
        <ConfirmModal
          isOpen={true}
          title="Confirm Escrow Payment"
          message="Ready"
          loading={false}
          onConfirm={vi.fn()}
          onClose={onClose}
        />,
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders Notifications appeal dialog using shared Modal (role=dialog, aria-modal, Escape close)', async () => {
      renderWithProviders(
        <NotificationContext.Provider
          value={{
            notifications: [
              {
                id: 'n-warn-1',
                type: 'warning',
                title: 'Warning Issued',
                message: 'Please review policy.',
                isRead: false,
                createdAt: new Date().toISOString(),
                metadata: { warningId: 'w-1' },
              },
            ],
            unreadCount: 1,
            markAsRead: vi.fn(),
            markAllAsRead: vi.fn(),
          }}
        >
          <Notifications />
        </NotificationContext.Provider>,
      );

      const appealBtn = screen.getByTestId('appeal-btn-w-1');
      fireEvent.click(appealBtn);

      const dialog = screen.getByRole('dialog', { name: 'Appeal Account Warning' });
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(document.body.style.overflow).toBe('hidden');

      fireEvent.keyDown(document, { key: 'Escape' });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull();
      });
      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('4. Grouped Notifications Rendering in notifications.jsx', () => {
    it('renders one grouped feed item with count in title and expandable 8-item list', () => {
      const groupedItems = Array.from({ length: 8 }, (_, idx) => ({
        label: `Atlas Task ${idx + 1}`,
        link: '/owner/workspace/proj-atlas',
      }));

      renderWithProviders(
        <NotificationContext.Provider
          value={{
            notifications: [
              {
                id: 'notif-bulk-8',
                type: 'TASK_RELEASED',
                title: '8 tasks released in Project Atlas',
                message: '8 tasks released after Arjun left.',
                count: 8,
                items: groupedItems,
                isRead: false,
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 1,
            markAsRead: vi.fn(),
            markAllAsRead: vi.fn(),
          }}
        >
          <Notifications />
        </NotificationContext.Provider>,
      );

      expect(screen.getByTestId('notif-item-notif-bulk-8')).toBeDefined();
      expect(screen.getByTestId('notif-group-count-notif-bulk-8').textContent).toBe('(8)');

      const toggleBtn = screen.getByTestId('notif-group-toggle-notif-bulk-8');
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('false');
      expect(screen.queryByTestId('notif-group-list-notif-bulk-8')).toBeNull();

      fireEvent.click(toggleBtn);
      expect(toggleBtn.getAttribute('aria-expanded')).toBe('true');

      const list = screen.getByTestId('notif-group-list-notif-bulk-8');
      expect(list.querySelectorAll('li')).toHaveLength(8);
      expect(screen.getByText('Atlas Task 1')).toBeDefined();
      expect(screen.getByText('Atlas Task 8')).toBeDefined();
    });

    it('truncates grouped lists over 10 items to 10 visible items plus "and N more"', () => {
      const twelveItems = Array.from({ length: 12 }, (_, idx) => ({
        label: `Bulk Task ${idx + 1}`,
        link: idx === 0 ? 'javascript:alert(1)' : '/owner/workspace/proj-12',
      }));

      renderWithProviders(
        <NotificationContext.Provider
          value={{
            notifications: [
              {
                id: 'notif-bulk-12',
                type: 'TASK_RELEASED',
                title: '12 tasks released',
                message: '12 tasks released in batch.',
                count: 12,
                items: twelveItems,
                isRead: false,
                createdAt: new Date().toISOString(),
              },
            ],
            unreadCount: 1,
            markAsRead: vi.fn(),
            markAllAsRead: vi.fn(),
          }}
        >
          <Notifications />
        </NotificationContext.Provider>,
      );

      fireEvent.click(screen.getByTestId('notif-group-toggle-notif-bulk-12'));
      const list = screen.getByTestId('notif-group-list-notif-bulk-12');
      // 10 visible item rows + 1 overflow "and 2 more" row
      expect(list.querySelectorAll('li')).toHaveLength(11);
      expect(screen.getByTestId('notif-group-overflow-notif-bulk-12').textContent).toBe('and 2 more');
      expect(screen.queryByText('Bulk Task 11')).toBeNull();
      // Non-relative javascript: item link passes through SafeLink (renders plain text, never <a href="javascript:...">)
      expect(screen.queryByTestId('safelink-anchor')).toBeNull();
      expect(screen.getByTestId('safelink-plain')).toBeDefined();
    });
  });
});
