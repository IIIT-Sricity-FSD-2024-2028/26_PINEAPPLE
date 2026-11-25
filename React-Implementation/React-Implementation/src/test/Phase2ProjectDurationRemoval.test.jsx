import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import CreateProject from '../pages/owner/CreateProject';
import ProjectCard from '../components/features/ProjectCard';
import { formatProjectDueDate } from '../utils/dateFormatter';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/owner/create-project' }),
    useParams: () => ({ id: 'proj-1' }),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: 'proj-1', title: 'Test Project', dueDate: '2027-01-15T00:00:00.000Z' }),
    create: vi.fn(),
    update: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
  isProjectActive: vi.fn(() => true),
}));

vi.mock('../services/taskTemplatesApi', () => ({
  default: {
    getCategoryTemplates: vi.fn().mockResolvedValue({ items: [] }),
  },
}));

describe('Phase 2 Frontend Tests: Project Duration Removal & Due Date Format', () => {
  describe('1. Create Project Form has NO Duration input', () => {
    it('renders CreateProject with Project Due Date and WITHOUT Est. Duration', async () => {
      renderWithProviders(<CreateProject />);

      // Est. Duration label or input must NOT exist
      expect(screen.queryByText(/Est\. Duration/i)).toBeNull();

      // Project Due Date label MUST exist
      expect(screen.getByText(/Project Due Date/i)).toBeDefined();
    });
  });

  describe('2. ProjectCard & Overview display Project Due Date', () => {
    it('renders ProjectCard showing formatted due date with countdown', () => {
      // Fixed reference time for test repeatability: 2026-11-13
      const mockProject = {
        id: 'proj-1',
        title: 'Quantum Computing Simulator',
        description: 'Building quantum circuits in WebAssembly.',
        dueDate: '2026-11-29T12:00:00.000Z',
        skills: ['Rust', 'Wasm'],
        owner: 'Priya Patel',
      };

      const { container } = renderWithProviders(<ProjectCard project={mockProject} variant="marketplace" />);

      // Check due date element exists and contains 'Due'
      const dueDateElem = container.querySelector('.tf-project-card-duedate');
      expect(dueDateElem).not.toBeNull();
      expect(dueDateElem.textContent).toContain('Due');
      expect(dueDateElem.textContent).toContain('29 Nov 2026');

      // Must NOT contain duration
      expect(container.textContent).not.toContain('Duration:');
    });

    it('formatProjectDueDate formats future dates as "Due <date> (<n> days left)"', () => {
      const now = new Date('2026-11-13T10:00:00.000Z');
      const targetDate = '2026-11-29T10:00:00.000Z'; // exactly 16 days

      const formatted = formatProjectDueDate(targetDate, now);
      expect(formatted).toBe('Due 29 Nov 2026 (16 days left)');
    });

    it('formatProjectDueDate handles single day left correctly as "1 day left"', () => {
      const now = new Date('2026-11-13T10:00:00.000Z');
      const targetDate = '2026-11-14T10:00:00.000Z';

      const formatted = formatProjectDueDate(targetDate, now);
      expect(formatted).toBe('Due 14 Nov 2026 (1 day left)');
    });

    it('formatProjectDueDate marks overdue dates with (overdue)', () => {
      const now = new Date('2026-11-13T10:00:00.000Z');
      const targetDate = '2026-11-10T10:00:00.000Z';

      const formatted = formatProjectDueDate(targetDate, now);
      expect(formatted).toBe('Due 10 Nov 2026 (overdue)');
    });
  });

  describe('3. Static Codebase Scan: No project duration in src', () => {
    function getAllFiles(dirPath, arrayOfFiles = []) {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
          arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else if (/\.(jsx?|tsx?)$/.test(file)) {
          arrayOfFiles.push(fullPath);
        }
      }
      return arrayOfFiles;
    }

    it('finds NO occurrences of "Est. Duration" or project duration properties in src', () => {
      const srcDir = path.resolve(__dirname, '..');
      const allFiles = getAllFiles(srcDir);

      const violations = [];

      // Exemptions:
      // - Mentor booking sessionDuration (MyMentorProfile, Phase14MentorLifecycle.test)
      // - Scheduled jobs durationMs (ScheduledJobsPanel, jobFormatter, Phase23SnapshotHygiene.test)
      // - Login cooldown timer string
      const isExempt = (filePath) => {
        const normalized = filePath.replace(/\\/g, '/');
        return (
          normalized.includes('/mentor/') ||
          normalized.includes('jobFormatter') ||
          normalized.includes('ScheduledJobsPanel') ||
          normalized.includes('Phase14MentorLifecycle') ||
          normalized.includes('Phase23SnapshotHygiene') ||
          normalized.includes('Login.jsx') ||
          normalized.includes('Phase2ProjectDurationRemoval.test.jsx') // this test itself
        );
      };

      for (const file of allFiles) {
        if (isExempt(file)) continue;

        const content = fs.readFileSync(file, 'utf-8');

        // Check 1: "Est. Duration" label
        if (content.includes('Est. Duration')) {
          violations.push(`${file}: Contains "Est. Duration"`);
        }

        // Check 2: project duration references
        if (
          /project\.duration\b/.test(content) ||
          /project\?\.duration\b/.test(content) ||
          /previewProject\.duration\b/.test(content) ||
          /formData\.duration\b/.test(content) ||
          /duration:\s*formData\.duration/.test(content) ||
          /duration:\s*['"]\d+\s*months?['"]/i.test(content)
        ) {
          violations.push(`${file}: Contains project duration property`);
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
