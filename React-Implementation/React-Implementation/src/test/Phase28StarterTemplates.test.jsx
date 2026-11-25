import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { renderWithProviders } from './test-utils';
import CreateProject from '../pages/owner/CreateProject';
import OwnedWorkspace from '../pages/owner/OwnedWorkspace';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import adminApi from '../services/adminApi';
import joinRequestsApi from '../services/joinRequestsApi';
import communicationApi from '../services/communicationApi';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ projectId: 'proj-28' }),
    useNavigate: () => vi.fn(),
  };
});

vi.mock('../services/adminApi', () => ({
  default: {
    getPublicConfig: vi.fn(),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    get: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    listInvites: vi.fn(),
    getTaskTemplatesByCategory: vi.fn(),
    getProjectTaskTemplates: vi.fn(),
    applyProjectTaskTemplates: vi.fn(),
  },
  isProjectLocked: vi.fn(() => false),
}));

vi.mock('../services/tasksApi', () => ({
  default: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateStatus: vi.fn(),
    review: vi.fn(),
  },
}));

vi.mock('../services/joinRequestsApi', () => ({
  default: {
    list: vi.fn(),
    getMyRequests: vi.fn(),
  },
}));

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
  },
}));

const WEB_TEMPLATES = {
  category: 'Web App',
  items: [
    {
      key: 'web-repo-readme',
      title: 'Set up repository and README',
      description: 'Initialize repo layout, branch conventions, and setup guide in README.md.',
      effort: 'small',
    },
    {
      key: 'web-main-screens',
      title: 'Design the main screens and routes',
      description: 'Create component architecture for primary landing and dashboard pages.',
      effort: 'medium',
    },
    {
      key: 'web-first-tests',
      title: 'Write core unit and integration tests',
      description: 'Add automated smoke and regression checks for critical user paths.',
      effort: 'medium',
    },
  ],
};

describe('Phase 28 Frontend Tests: Starter Task Templates Picker, CreateProject & Health Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminApi.getPublicConfig.mockResolvedValue({ maxCollaboratorsPerProject: 20 });
    projectsApi.getTaskTemplatesByCategory.mockResolvedValue(WEB_TEMPLATES);
    projectsApi.getProjectTaskTemplates.mockResolvedValue(WEB_TEMPLATES);
    projectsApi.listInvites.mockResolvedValue([]);
    joinRequestsApi.list.mockResolvedValue([]);
    communicationApi.getMessages.mockResolvedValue([]);
  });

  it('1. CreateProject shows pre-ticked starter tasks on category pick, allows edits/untick, and supports one-click skip', async () => {
    projectsApi.create.mockResolvedValue({
      id: 'proj-created-1',
      starterTasksCreated: [{ id: 't1', title: 'Custom Web Repo Title' }],
      starterTasksSkipped: [],
    });

    renderWithProviders(<CreateProject />, {
      user: { id: '1', name: 'Priya Patel', role: 'Project Owner', emailVerified: true },
    });

    // Pick category -> fetches Web App templates and renders pre-ticked list with count
    const catSelect = screen.getByLabelText(/Project Category/i);
    fireEvent.change(catSelect, { target: { value: 'Web App' } });

    await waitFor(() => {
      expect(projectsApi.getTaskTemplatesByCategory).toHaveBeenCalledWith('Web App');
      expect(screen.getByTestId('create-starter-tasks-section')).toBeTruthy();
      expect(screen.getByTestId('starter-selected-count').textContent).toContain('3 of 3 selected');
    });

    // Untick second template and edit first title
    fireEvent.click(screen.getByTestId('starter-checkbox-web-main-screens'));
    expect(screen.getByTestId('starter-selected-count').textContent).toContain('2 of 3 selected');

    fireEvent.change(screen.getByTestId('starter-title-web-repo-readme'), {
      target: { value: 'Custom Web Repo Title' },
    });

    // Fill required project fields and submit
    fireEvent.change(screen.getByPlaceholderText(/AI Campus Navigator/i), {
      target: { value: 'Starter Enabled Web Project' },
    });
    fireEvent.change(screen.getByPlaceholderText(/at least 100 characters/i), {
      target: { value: 'D'.repeat(110) },
    });
    const dueInput = document.querySelector('input[type="date"], input[placeholder="DD/MM/YYYY"]');
    if (dueInput) {
      fireEvent.change(dueInput, { target: { value: '2027-06-01' } });
    }

    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(projectsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'Web App',
          starterTaskKeys: ['web-repo-readme', 'web-first-tests'],
          starterTaskOverrides: expect.objectContaining({
            'web-repo-readme': expect.objectContaining({ title: 'Custom Web Repo Title' }),
          }),
        }),
        'Project Owner',
        undefined,
      );
    });

    // One-click Skip starter tasks clears selection and omits starterTaskKeys on submit
    fireEvent.click(screen.getByTestId('skip-starter-tasks-btn'));
    expect(screen.getByTestId('starter-tasks-skipped-note')).toBeTruthy();

    projectsApi.create.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));
    await waitFor(() => {
      expect(projectsApi.create).toHaveBeenCalled();
      const sentPayload = projectsApi.create.mock.calls[0][0];
      expect(sentPayload.starterTaskKeys).toBeUndefined();
    });
  });

  it('2. OwnedWorkspace "Add starter tasks" disables already-added items and displays TASK_LIMIT_REACHED / TEMPLATE_TASK_EXISTS errors', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-28',
      ownerId: '1',
      title: 'Existing Workspace',
      category: 'Web App',
      status: 'Open',
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    tasksApi.list.mockResolvedValue([
      {
        id: 'task-existing-1',
        projectId: 'proj-28',
        title: 'Set up repository and README',
        status: 'To Do',
      },
    ]);
    projectsApi.applyProjectTaskTemplates.mockResolvedValue({
      created: [],
      skipped: [{ key: 'web-main-screens', code: 'TASK_LIMIT_REACHED', reason: 'Max 30 tasks reached' }],
    });

    renderWithProviders(<OwnedWorkspace />, {
      route: '/owner/workspace/proj-28',
    });

    const tasksTabBtn = await screen.findByRole('tab', { name: /Tasks/i });
    fireEvent.click(tasksTabBtn);

    const addBtn = await screen.findByTestId('add-starter-tasks-btn');
    fireEvent.click(addBtn);

    await waitFor(() => {
      expect(projectsApi.getProjectTaskTemplates).toHaveBeenCalledWith('proj-28');
      expect(screen.getByTestId('starter-added-badge-web-repo-readme')).toBeTruthy();
      expect(screen.getByTestId('starter-checkbox-web-repo-readme').disabled).toBe(true);
      expect(screen.getByTestId('starter-checkbox-web-main-screens').disabled).toBe(false);
    });

    // Apply triggers error banner for TASK_LIMIT_REACHED
    fireEvent.click(screen.getByTestId('confirm-apply-starter-tasks-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('starter-picker-error').textContent).toMatch(/maximum 30 tasks/i);
      expect(screen.getByTestId('starter-skipped-banner')).toBeTruthy();
    });

    // Rejecting with TEMPLATE_TASK_EXISTS also maps cleanly
    projectsApi.applyProjectTaskTemplates.mockRejectedValueOnce({
      code: 'TEMPLATE_TASK_EXISTS',
      message: 'Already exists',
    });
    fireEvent.click(screen.getByTestId('confirm-apply-starter-tasks-btn'));
    await waitFor(() => {
      expect(screen.getByTestId('starter-picker-error').textContent).toMatch(/already exists/i);
    });
  });

  it('3. Tasks tab "Add starter tasks" button opens the starter template picker and applies starter tasks', async () => {
    projectsApi.get.mockResolvedValue({
      id: 'proj-28',
      ownerId: '1',
      title: 'Starter Guided Project',
      category: 'Web App',
      status: 'Open',
      dueDate: '2027-06-01T00:00:00.000Z',
    });
    tasksApi.list.mockResolvedValue([]);

    projectsApi.applyProjectTaskTemplates.mockResolvedValue({
      created: [
        { id: 't-new-1', projectId: 'proj-28', title: 'Set up repository and README', status: 'To Do' },
        { id: 't-new-2', projectId: 'proj-28', title: 'Design the main screens and routes', status: 'To Do' },
        { id: 't-new-3', projectId: 'proj-28', title: 'Write core unit and integration tests', status: 'To Do' },
      ],
      skipped: [],
    });

    renderWithProviders(<OwnedWorkspace />, {
      user: { id: '1', name: 'Priya Patel', role: 'Project Owner' },
      route: '/owner/workspace/proj-28',
    });

    const tasksTabBtn = await screen.findByRole('tab', { name: /Tasks/i });
    fireEvent.click(tasksTabBtn);

    const addStarterBtn = await screen.findByTestId('add-starter-tasks-btn');
    fireEvent.click(addStarterBtn);

    await waitFor(() => {
      expect(screen.getByTestId('starter-task-picker')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('confirm-apply-starter-tasks-btn'));

    await waitFor(() => {
      expect(projectsApi.applyProjectTaskTemplates).toHaveBeenCalled();
    });
  });
});
