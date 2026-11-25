import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import ProjectCard from '../components/features/ProjectCard';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import ProjectsMarketplace from '../pages/collaborator/ProjectsMarketplace';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';
import usersApi from '../services/usersApi';
import { renderWithProviders } from './test-utils';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-11' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn(),
    update: vi.fn(),
    changeDeadline: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    updateStatus: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(),
    getMyRequests: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    getResponseTime: vi.fn(),
    getPublicProfile: vi.fn(),
  },
}));

describe('Phase 1 Removal & Integrity Tests: Project Health Removed Completely', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Owner Workspace Tabs & Kept Controls', () => {
    const sampleProject = {
      id: 'proj-11',
      title: 'Distributed Compute Engine',
      description: 'A robust distributed compute cluster engine with fault tolerance.',
      ownerId: 'u-owner',
      teamSize: 4,
      maxCollaborators: 4,
      collaborators: [
        { id: 'u-owner', name: 'Owner User', role: 'Owner' },
        { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
      ],
      dueDate: '2028-06-01T00:00:00.000Z',
      status: 'Open',
    };

    const sampleTasks = [
      {
        id: 'task-1',
        title: 'Initial RPC Protocol',
        dueDate: '2028-05-20T00:00:00.000Z',
        status: 'To Do',
      },
    ];

    beforeEach(() => {
      projectsApi.get.mockResolvedValue(sampleProject);
      tasksApi.list.mockResolvedValue(sampleTasks);
      joinRequestsApi.list.mockResolvedValue([]);
      communicationApi.getMessages.mockResolvedValue([]);
    });

    it('renders tabs Overview, Tasks, Members, Chat only (no Project Health tab or telemetry panel)', async () => {
      renderWithProviders(<OwnedWorkspace />);

      await waitFor(() => {
        expect(screen.getByText('Distributed Compute Engine')).toBeDefined();
      });

      // Verify the 4 exact tabs exist
      expect(screen.getByRole('tab', { name: /Overview/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Tasks/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Members/i })).toBeDefined();
      expect(screen.getByRole('tab', { name: /Chat/i })).toBeDefined();

      // Verify Project Health tab and telemetry panel do NOT exist
      expect(screen.queryByRole('tab', { name: /Project Health/i })).toBeNull();
      expect(screen.queryByRole('tab', { name: /Health/i })).toBeNull();
      expect(screen.queryByText('Project Health Telemetry')).toBeNull();
      expect(screen.queryByText('Project Health')).toBeNull();
    });

    it('change deadline modal displays "Shift open tasks by N days" and sends shiftTasks: true', async () => {
      projectsApi.changeDeadline.mockResolvedValue({
        ...sampleProject,
        dueDate: '2028-06-11T00:00:00.000Z',
      });

      renderWithProviders(<OwnedWorkspace />);

      await waitFor(() => {
        expect(screen.getByText('📅 Change Deadline')).toBeDefined();
      });

      // Open Change Deadline modal
      fireEvent.click(screen.getByText('📅 Change Deadline'));

      // Change date to +10 days: 2028-06-11
      const dateInput = screen.getByLabelText(/New Project Deadline/i);
      fireEvent.change(dateInput, { target: { value: '2028-06-11' } });

      // Checkbox "Shift open tasks by 10 days" should appear
      const checkbox = await screen.findByTestId('shift-tasks-checkbox');
      expect(checkbox).toBeDefined();
      expect(checkbox.parentElement.textContent).toContain('Shift open tasks by 10 days');

      // Check the checkbox
      fireEvent.click(checkbox);
      expect(checkbox.checked).toBe(true);

      // Provide valid reason
      const reasonInput = screen.getByLabelText(/Reason for changing deadline/i);
      fireEvent.change(reasonInput, { target: { value: 'Extending deadline due to additional research requirements.' } });

      // Click Update Deadline
      const updateBtn = screen.getByRole('button', { name: /Update Deadline/i });
      fireEvent.click(updateBtn);

      await waitFor(() => {
        expect(projectsApi.changeDeadline).toHaveBeenCalledWith('proj-11', expect.objectContaining({
          shiftTasks: true,
          dueDate: expect.any(String),
          reason: 'Extending deadline due to additional research requirements.',
        }));
      });
    });

    it('edit settings modal displays TEAM_SIZE_BELOW_MEMBERS error when capacity is reduced below active members', async () => {
      projectsApi.update.mockRejectedValue({
        code: 'TEAM_SIZE_BELOW_MEMBERS',
        message: 'Team size cannot be set below the number of active members (2).',
      });

      renderWithProviders(<OwnedWorkspace />);

      const editBtn = await screen.findByTestId('edit-project-settings-btn');
      fireEvent.click(editBtn);

      // Verify modal is open
      expect(screen.getByText('Edit Project Settings')).toBeDefined();

      // Change teamSize to 1 (below active members 2)
      const teamSizeInput = screen.getByLabelText(/Team Size/i);
      fireEvent.change(teamSizeInput, { target: { value: '1' } });

      // Click Save Changes
      const saveBtn = screen.getByRole('button', { name: /Save Changes/i });
      fireEvent.click(saveBtn);

      // Verify error banner displays TEAM_SIZE_BELOW_MEMBERS
      const errBanner = await screen.findByTestId('team-size-error');
      expect(errBanner.textContent).toMatch(/TEAM_SIZE_BELOW_MEMBERS/i);
      expect(errBanner.textContent).toMatch(/Team size cannot be set below the number of active members/i);
    });
  });

  describe('2. ProjectCard Owner Response Time (Kept Feature)', () => {
    const testProject = {
      id: 'proj-card-1',
      title: 'Neural Network Optimizer',
      description: 'Distributed optimization kernels for deep neural network training.',
      owner: 'Ananya Sharma',
      status: 'Open',
    };

    it('displays "Usually replies in N days" when ownerResponseTime is provided', () => {
      render(
        <ProjectCard
          project={testProject}
          ownerResponseTime="usually replies in 2 days"
        />
      );

      const badge = screen.getByText(/usually replies in 2 days/i);
      expect(badge).toBeDefined();
    });

    it('omits response time when ownerResponseTime is not provided', () => {
      render(<ProjectCard project={testProject} />);
      expect(screen.queryByText(/usually replies/i)).toBeNull();
    });
  });

  describe('3. ProjectsMarketplace Renders Without Observers', () => {
    const marketProjects = [
      {
        id: 'proj-market-1',
        title: 'Rust WebAssembly Engine',
        description: 'Blazing fast browser compiler and engine.',
        owner: 'Vikram Nair',
        ownerId: 'u-vikram',
        difficulty: 'Hard',
        status: 'Open',
        skills: ['Rust', 'WebAssembly'],
      },
    ];

    beforeEach(() => {
      projectsApi.list.mockResolvedValue(marketProjects);
      joinRequestsApi.getMyRequests.mockResolvedValue([]);
      usersApi.getResponseTime.mockResolvedValue({ medianHours: 24, sample: 4 });
    });

    it('marketplace cards render cleanly without IntersectionObserver attributes or preview telemetry calls', async () => {
      const { container } = renderWithProviders(<ProjectsMarketplace />);

      await waitFor(() => {
        expect(screen.getByText('Rust WebAssembly Engine')).toBeDefined();
      });

      // No data-project-id observer attribute
      const observerCard = container.querySelector('[data-project-id="proj-market-1"]');
      expect(observerCard).toBeNull();

      // Clicking project title opens preview modal without invoking any preview telemetry API
      fireEvent.click(screen.getByText('Rust WebAssembly Engine'));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Apply to Project/i })).toBeDefined();
      });

      expect(projectsApi.recordPreview).toBeUndefined();
    });
  });

  describe('4. Static Source Scan: Zero Project Health / Telemetry / View Tracking in src', () => {
    function walkDir(dir) {
      let results = [];
      const list = fs.readdirSync(dir);
      for (const item of list) {
        if (item === 'node_modules' || item === 'test' || item === 'dist') continue;
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          results = results.concat(walkDir(fullPath));
        } else if (/\.(jsx?|tsx?|css)$/.test(item)) {
          results.push(fullPath);
        }
      }
      return results;
    }

    it('finds no imports or references to ProjectHealthPanel, ProjectHealthSummary, useProjectHealth, or project health routes in src', () => {
      const srcDir = path.resolve(__dirname, '..');
      const files = walkDir(srcDir);
      const violations = [];

      const forbiddenPatterns = [
        { name: 'ProjectHealthPanel import/usage', regex: /\bProjectHealthPanel\b/ },
        { name: 'ProjectHealthSummary import/usage', regex: /\bProjectHealthSummary\b/ },
        { name: 'useProjectHealth hook import/usage', regex: /\buseProjectHealth\b/ },
        { name: 'GET /projects/:id/health route', regex: /\/projects\/[^'"]*\/health\b/ },
        { name: 'POST /projects/:id/impression route', regex: /\/projects\/[^'"]*\/impression\b/ },
        { name: 'POST /projects/:id/preview route', regex: /\/projects\/[^'"]*\/preview\b/ },
        { name: 'recordImpression method', regex: /\brecordImpression\b/ },
        { name: 'recordPreview method', regex: /\brecordPreview\b/ },
        { name: 'Project Health Tab label', regex: /['"`]Project Health['"`]/ },
        { name: 'Health Telemetry label', regex: /Health Telemetry/i },
      ];

      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        for (const { name, regex } of forbiddenPatterns) {
          if (regex.test(content)) {
            violations.push(`${path.relative(srcDir, file)} violates ${name}`);
          }
        }
      }

      expect(violations).toEqual([]);
    });
  });
});
