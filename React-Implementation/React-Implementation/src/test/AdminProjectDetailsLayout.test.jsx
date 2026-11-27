import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithStore } from './test-utils';
import AdminProjectDetails from '../pages/admin/AdminProjectDetails';
import projectsApi from '../services/projectsApi';
import tasksApi from '../services/tasksApi';
import adminApi from '../services/adminApi';

vi.mock('../services/projectsApi', async () => {
  const actual = await vi.importActual('../services/projectsApi');
  return {
    ...actual,
    default: {
      get: vi.fn(),
      list: vi.fn(),
      close: vi.fn(),
      restore: vi.fn(),
      cancelDeletion: vi.fn(),
      softDelete: vi.fn(),
      checkDeletion: vi.fn().mockResolvedValue({ allowed: true, reasons: [] }),
    },
    isProjectLocked: vi.fn((p) =>
      Boolean(p && (p.isCompleted || String(p.status).toLowerCase() === 'closed')),
    ),
  };
});

vi.mock('../services/tasksApi', () => ({
  default: { list: vi.fn() },
}));

vi.mock('../services/adminApi', () => ({
  default: { getProjectEscrow: vi.fn() },
}));

const sampleProject = {
  id: 'proj-layout-1',
  title: 'Fitness Tracker Platform',
  description: 'A'.repeat(240),
  status: 'Open',
  difficulty: 'Medium',
  dueDate: '2027-06-01T00:00:00.000Z',
  requiredSkills: ['React', 'NestJS', 'CSS Grid'],
  ownerId: '1',
  owner: { id: '1', name: 'Priya Patel' },
  mentorId: '3',
  mentor: 'Kiran Bose',
  members: [
    { id: '1', name: 'Priya Patel', role: 'Owner' },
    { id: '3', name: 'Kiran Bose', role: 'Mentor' },
    { id: '2', name: 'Arjun Sharma', role: 'Collaborator' },
  ],
};

function renderPage(projectId = 'proj-layout-1') {
  return renderWithStore(
    <Routes>
      <Route path="/admin/projects/:id" element={<AdminProjectDetails />} />
    </Routes>,
    { route: `/admin/projects/${projectId}` },
  );
}

describe('AdminProjectDetailsLayout — Header, Role Badges, Show More, Empty States & CSS Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders header title, status badge, segmented tabs, and Delete Project button without <header> fixed-height collision', async () => {
    projectsApi.get.mockResolvedValue(sampleProject);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderPage();

    const heading = await screen.findByRole('heading', { level: 1, name: /Fitness Tracker Platform/i });
    const headerWrapper = heading.closest('.admin-project-header-wrapper');
    expect(headerWrapper).toBeTruthy();
    expect(headerWrapper.tagName.toLowerCase()).not.toBe('header');

    expect(screen.getByRole('tab', { name: /Overview & Tasks/i })).toBeTruthy();
    expect(screen.getByTestId('admin-project-escrow-tab')).toBeTruthy();
    const deleteBtn = screen.getByTestId('admin-delete-project-btn');
    expect(deleteBtn.disabled).toBe(false);

    fireEvent.click(deleteBtn);
    expect(await screen.findByTestId('delete-project-modal')).toBeTruthy();
  });

  it('hides Delete Project button for already soft-deleted projects while retaining header controls', async () => {
    projectsApi.get.mockResolvedValue({
      ...sampleProject,
      deletedAt: '2026-11-10T00:00:00.000Z',
    });
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderPage();

    await screen.findByRole('heading', { level: 1, name: /Fitness Tracker Platform/i });
    expect(screen.queryByTestId('admin-delete-project-btn')).toBeNull();
    expect(screen.getByTestId('admin-restore-project-btn')).toBeTruthy();
  });

  it('renders every member role (Owner, Mentor, Collaborator) with the shared .tf-badge component and defined variant CSS rules', async () => {
    projectsApi.get.mockResolvedValue(sampleProject);
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderPage();

    const ownerBadge = await screen.findByText('Owner');
    const mentorBadge = screen.getByText('Mentor');
    const collabBadge = screen.getByText('Collaborator');

    expect(ownerBadge.className).toContain('tf-badge');
    expect(mentorBadge.className).toContain('tf-badge');
    expect(collabBadge.className).toContain('tf-badge');

    const badgeCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/Badge.css'),
      'utf8',
    );
    expect(badgeCss).toMatch(/\.tf-badge--warning\b/);
    expect(badgeCss).toMatch(/\.tf-badge--purple\b/);
    expect(badgeCss).toMatch(/\.tf-badge--info\b/);
  });

  it('toggles long unbroken description with Show more / Show less and renders empty states', async () => {
    projectsApi.get.mockResolvedValue({
      ...sampleProject,
      members: [],
      collaborators: [],
    });
    tasksApi.list.mockResolvedValue([]);
    adminApi.getProjectEscrow.mockResolvedValue(null);

    renderPage();

    const descEl = await screen.findByText(sampleProject.description);
    expect(descEl.className).toContain('is-clamped');
    fireEvent.click(screen.getByRole('button', { name: /Show more/i }));
    await waitFor(() => {
      expect(descEl.className).toContain('is-expanded');
    });
    fireEvent.click(screen.getByRole('button', { name: /Show less/i }));
    await waitFor(() => {
      expect(descEl.className).toContain('is-clamped');
    });

    expect(screen.getByText('No team members yet')).toBeTruthy();
    expect(screen.getByText('No tasks yet')).toBeTruthy();
  });

  it('defines responsive layout, wrapping, fixed task table layout, and mobile admin shell CSS rules', () => {
    const detailsCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/admin/AdminProjectDetails.css'),
      'utf8',
    );
    const layoutCss = fs.readFileSync(
      path.resolve(process.cwd(), 'src/pages/admin/AdminLayout.css'),
      'utf8',
    );

    expect(detailsCss).toMatch(/minmax\(0,\s*1fr\)\s+300px/);
    expect(detailsCss).toMatch(/@media\s*\(max-width:\s*1100px\)/);
    expect(detailsCss).toMatch(/@media\s*\(max-width:\s*700px\)/);
    expect(detailsCss).toMatch(/\.admin-notice-body[\s\S]*overflow-wrap:\s*anywhere/);
    expect(detailsCss).toMatch(/table-layout:\s*fixed/);
    expect(layoutCss).toMatch(/\.admin-main-content[\s\S]*min-width:\s*0/);
  });
});
