import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import fs from 'fs';
import path from 'path';

import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import MyProjects from '../pages/owner/MyProjects';
import CreateProject from '../pages/owner/CreateProject';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import { renderWithStore } from './test-utils';

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    getByOwner: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    delete: vi.fn(),
    getTaskTemplatesByCategory: vi.fn().mockResolvedValue({ items: [] }),
    listInvites: vi.fn().mockResolvedValue([]),
    sendInvite: vi.fn(),
    cancelInvite: vi.fn().mockResolvedValue({}),
    getMatch: vi.fn().mockResolvedValue({ percent: 100, shared: [], missing: [] }),
  },
  isProjectLocked: vi.fn((p) => {
    if (!p) return false;
    const st = String(p.status || '').toLowerCase();
    return p.isCompleted === true || st === 'completed' || st === 'closed';
  }),
  isProjectActive: vi.fn((p) => {
    if (!p) return false;
    const st = String(p.status || '').toLowerCase();
    return st !== 'completed' && st !== 'closed';
  }),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    getByProject: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    respond: vi.fn(),
    getMyRequests: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn().mockResolvedValue([]),
    sendMessage: vi.fn(),
    getUnread: vi.fn().mockResolvedValue([]),
    markProjectRead: vi.fn(() => Promise.resolve({ ok: true })),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    searchUsers: vi.fn().mockResolvedValue([]),
    getResponseTime: vi.fn(() => Promise.resolve(null)),
    getPublicProfile: vi.fn(() => Promise.resolve(null)),
    updateProfile: vi.fn(),
  },
}));

vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    getProjectAbandonmentReview: vi.fn(() => Promise.resolve(null)),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getPublicConfig: vi.fn().mockResolvedValue({ maxCollaboratorsPerProject: 20 }),
    getMyWarnings: vi.fn(() => Promise.resolve([])),
  },
}));

const mockUser = {
  id: '1',
  name: 'Priya Patel',
  role: 'Project Owner',
  email: 'priya.patel@teamforge.io',
};

const renderWithProviders = (ui, initialRoute = '/owner/workspace/p-open-1') => {
  return renderWithStore(
    <Routes>
      <Route path="/owner/workspace/:projectId" element={ui} />
      <Route path="*" element={ui} />
    </Routes>,
    {
      route: initialRoute,
      preloadedState: {
        session: {
          user: mockUser,
          isAuthenticated: true,
          status: 'authenticated',
          activeRole: 'Project Owner',
          allowedRoles: ['Project Owner'],
        },
      },
    },
  );
};

describe('Phase 3 Frontend: Draft Removal, Instant Go-Live & Completion Finality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Owner Workspace & Filters have NO Draft and NO Go-Live Publish', () => {
    it('workspace renders NO draft badge and NO publish-draft button', async () => {
      projectsApi.get.mockResolvedValue({
        id: 'p-open-1',
        title: 'Open Robotics Platform',
        description: 'Building autonomous robot navigation.',
        status: 'Open',
        dueDate: '2027-03-01T00:00:00.000Z',
        ownerId: '1',
        owner: 'Priya Patel',
        collaborators: [],
      });
      tasksApi.list.mockResolvedValue([]);

      renderWithProviders(<OwnedWorkspace />, '/owner/workspace/p-open-1');

      await waitFor(() => {
        expect(screen.getByText('Open Robotics Platform')).toBeDefined();
      });

      // No draft badge and no publish to marketplace button
      expect(screen.queryByTestId('draft-status-badge')).toBeNull();
      expect(screen.queryByTestId('publish-draft-btn')).toBeNull();
      expect(screen.queryByText(/Publish to Marketplace/i)).toBeNull();
    });

    it('MyProjects filter tabs have NO Drafts tab and NO Drafts section', async () => {
      projectsApi.list.mockResolvedValue([
        {
          id: 'p-1',
          title: 'Active Sensor Network',
          description: 'Deploying IoT nodes on campus.',
          status: 'Open',
          dueDate: '2027-02-15T00:00:00.000Z',
          ownerId: '1',
          owner: 'Priya Patel',
          collaborators: [],
        },
        {
          id: 'p-2',
          title: 'Finished Clean Energy App',
          description: 'Solar energy analytics tool.',
          status: 'Completed',
          isCompleted: true,
          dueDate: '2026-11-01T00:00:00.000Z',
          ownerId: '1',
          owner: 'Priya Patel',
          collaborators: [],
        },
      ]);

      renderWithProviders(<MyProjects />, '/my-projects');

      await waitFor(() => {
        expect(screen.getByText('Active Sensor Network')).toBeDefined();
      });

      // Assert no "Drafts" tab
      expect(screen.queryByRole('tab', { name: /draft/i })).toBeNull();
      expect(screen.queryByTestId('myprojects-drafts-section')).toBeNull();
    });

    it('Create Project button is labeled "Create Project"', async () => {
      renderWithProviders(<CreateProject />, '/projects/create');

      const submitBtn = screen.getByRole('button', { name: 'Create Project' });
      expect(submitBtn).toBeDefined();
      expect(submitBtn.textContent).toBe('Create Project');
      expect(screen.queryByText(/Save as Draft/i)).toBeNull();
    });
  });

  describe('2. "Publish Project" Completion Action & Hint Constraints', () => {
    it('completion "Publish Project" button is disabled with hint when 0 tasks exist', async () => {
      projectsApi.get.mockResolvedValue({
        id: 'p-no-tasks',
        title: 'Zero Tasks Project',
        description: 'New project with no tasks created yet.',
        status: 'Open',
        dueDate: '2027-03-01T00:00:00.000Z',
        ownerId: '1',
        owner: 'Priya Patel',
        collaborators: [],
      });
      tasksApi.list.mockResolvedValue([]);

      renderWithProviders(<OwnedWorkspace />, '/owner/workspace/p-no-tasks');

      const publishBtn = await screen.findByTestId('publish-project-toolbar-btn');
      expect(publishBtn.disabled).toBe(true);
      expect(publishBtn.getAttribute('title')).toMatch(/Add at least one task to complete this project/i);
    });

    it('completion button is disabled with hint when unapproved tasks exist', async () => {
      projectsApi.get.mockResolvedValue({
        id: 'p-unapproved',
        title: 'In-Progress Tasks Project',
        description: 'Project with unapproved work.',
        status: 'Open',
        dueDate: '2027-03-01T00:00:00.000Z',
        ownerId: '1',
        owner: 'Priya Patel',
        collaborators: [{ id: '2', name: 'Arjun Sharma' }],
      });
      tasksApi.list.mockResolvedValue([
        { id: 't1', title: 'Task in development', status: 'In Progress' },
      ]);

      renderWithProviders(<OwnedWorkspace />, '/owner/workspace/p-unapproved');

      const publishBtn = await screen.findByTestId('publish-project-toolbar-btn');
      expect(publishBtn.disabled).toBe(true);
      expect(publishBtn.getAttribute('title')).toMatch(/All tasks must be approved before completing this project/i);
    });

    it('opens publish modal and completes project when tasks are approved', async () => {
      projectsApi.get.mockResolvedValue({
        id: 'p-ready',
        title: 'Ready Project',
        description: 'All tasks approved and deliverables ready.',
        status: 'Open',
        dueDate: '2027-03-01T00:00:00.000Z',
        ownerId: '1',
        owner: 'Priya Patel',
        collaborators: [{ id: '2', name: 'Arjun Sharma' }],
      });
      tasksApi.list.mockResolvedValue([
        { id: 't1', title: 'Completed and verified task', status: 'Completed' },
      ]);
      projectsApi.complete.mockResolvedValue({
        id: 'p-ready',
        status: 'Completed',
        isCompleted: true,
        finalLink: 'https://github.com/teamforge/verified-deliverable',
      });

      renderWithProviders(<OwnedWorkspace />, '/owner/workspace/p-ready');

      const publishBtn = await screen.findByTestId('publish-project-toolbar-btn');
      expect(publishBtn.disabled).toBe(false);
      fireEvent.click(publishBtn);

      // Modal appears
      await waitFor(() => {
        expect(screen.getByText('Publish Finished Project')).toBeDefined();
      });

      const urlInput = screen.getByLabelText(/Live Project Link/i);
      fireEvent.change(urlInput, { target: { value: 'https://github.com/teamforge/verified-deliverable' } });

      const submitModalBtn = screen.getByRole('button', { name: /Publish & Complete/i });
      fireEvent.click(submitModalBtn);

      await waitFor(() => {
        expect(projectsApi.complete).toHaveBeenCalledWith(
          'p-ready',
          {
            finalLink: 'https://github.com/teamforge/verified-deliverable',
            finishedLink: 'https://github.com/teamforge/verified-deliverable',
          },
        );
      });
    });
  });

  describe('3. Completion Finality ("Done Means Done")', () => {
    it('workspace shows read-only banner after completion and NO clone, export, or reopen buttons', async () => {
      projectsApi.get.mockResolvedValue({
        id: 'p-completed',
        title: 'Immutable Completed Project',
        description: 'Deliverables published and locked.',
        status: 'Completed',
        isCompleted: true,
        completedAt: '2026-11-13T12:00:00.000Z',
        finalLink: 'https://github.com/teamforge/finished',
        ownerId: '1',
        owner: 'Priya Patel',
        collaborators: [],
      });
      tasksApi.list.mockResolvedValue([
        { id: 't1', title: 'Approved milestone', status: 'Completed' },
      ]);

      renderWithProviders(<OwnedWorkspace />, '/owner/workspace/p-completed');

      // Shows read-only banner
      expect(await screen.findByText(/🔒 Completed \(Read-only\)/i)).toBeDefined();

      // Ensure no clone, export, reopen, or go-live buttons
      expect(screen.queryByTestId('clone-draft-btn')).toBeNull();
      expect(screen.queryByTestId('export-markdown-btn')).toBeNull();
      expect(screen.queryByTestId('publish-draft-btn')).toBeNull();
      expect(screen.queryByText(/Clone as draft/i)).toBeNull();
      expect(screen.queryByText(/Export Markdown/i)).toBeNull();
      expect(screen.queryByText(/Reopen/i)).toBeNull();
      expect(screen.queryByText(/Restart/i)).toBeNull();
    });
  });

  describe('4. Static Code Scan Assertions', () => {
    it('finds no Draft status string or publishedAt in src and back-end/src, and no clone/export/reopen handlers', () => {
      const feSrcDir = path.resolve(__dirname, '..');
      const beSrcDir = path.resolve(__dirname, '../../../../back-end/src');

      const scanDirectory = (dir, extFilter, skipDirNames = ['node_modules', 'dist', 'build', 'test']) => {
        let results = [];
        if (!fs.existsSync(dir)) return results;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (!skipDirNames.includes(entry.name)) {
              results = results.concat(scanDirectory(fullPath, extFilter, skipDirNames));
            }
          } else if (extFilter.some((ext) => entry.name.endsWith(ext))) {
            results.push(fullPath);
          }
        }
        return results;
      };

      const feFiles = scanDirectory(feSrcDir, ['.jsx', '.js']);
      const beFiles = scanDirectory(beSrcDir, ['.ts'], ['node_modules', 'dist', 'build']);

      // Check frontend files (production code)
      for (const file of feFiles) {
        const content = fs.readFileSync(file, 'utf8');

        // No go-live publish route or handler
        expect(content).not.toContain(':id/publish');
        expect(content).not.toContain('publish-draft-btn');
        expect(content).not.toContain('handlePublishDraft');

        // No clone or export handlers
        expect(content).not.toContain('cloneAsDraft');
        expect(content).not.toContain('handleCloneAsDraft');
        expect(content).not.toContain('handleExportMarkdown');
        expect(content).not.toContain('exportRequirements');

        // No Draft status enum value assignments
        expect(content).not.toMatch(/status\s*[:=]\s*['"]Draft['"]/i);
        expect(content).not.toContain('publishedAt');
      }

      // Check backend files
      for (const file of beFiles) {
        // Skip test spec files in backend for source scan
        if (file.endsWith('.spec.ts')) continue;
        const content = fs.readFileSync(file, 'utf8');

        // No export.md or clone routes
        expect(content).not.toContain(':id/export.md');
        expect(content).not.toContain(':id/clone');
        expect(content).not.toContain('cloneProjectAsDraft');
        expect(content).not.toContain('exportRequirementsMarkdown');

        // ProjectStatus enum must not have Draft
        if (file.endsWith('create-project.dto.ts')) {
          expect(content).not.toContain('Draft =');
        }
      }
    });
  });
});
