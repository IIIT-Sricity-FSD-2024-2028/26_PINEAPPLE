import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MentorsDirectory from '../pages/owner/MentorsDirectory';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationProvider } from '../context/NotificationContext';

const { mockMentorApi, mockProjectsApi } = vi.hoisted(() => ({
  mockMentorApi: {
    listMentors: vi.fn(),
    mySessions: vi.fn(),
    bookSession: vi.fn(),
    confirmPayment: vi.fn(),
    cancelPayment: vi.fn(),
    allSessions: vi.fn(),
    adminStats: vi.fn(),
    mentorSessions: vi.fn(),
    reconcileEscrow: vi.fn(),
  },
  mockProjectsApi: {
    list: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../services/mentorMarketplaceApi', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    default: mockMentorApi,
    mentorMarketApi: mockMentorApi,
  };
});

vi.mock('../services/projectsApi', () => ({
  default: mockProjectsApi,
  projectsApi: mockProjectsApi,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
  };
});

describe('Phase 25 Frontend Tests: Mentor Booking Integrity', () => {
  const ownerUser = { id: 'owner-1', name: 'Priya Owner', role: 'Project Owner' };

  const mentorOther = {
    id: 'm-other',
    userId: '7',
    name: 'Neha Gupta',
    title: 'Data Scientist Mentor',
    bio: 'Experienced ML mentor.',
    sessionPrice: 1500,
    skills: ['ML', 'Python'],
    isAvailable: true,
    maxActiveMentees: 3,
    activeMenteesCount: 0,
    isFull: false,
  };

  const mentorSelf = {
    id: 'm-self',
    userId: 'owner-1',
    name: 'Priya Self Profile',
    title: 'Self Architect Mentor',
    bio: 'Should be hidden from own directory booking view.',
    sessionPrice: 1800,
    skills: ['Architecture'],
    isAvailable: true,
    maxActiveMentees: 3,
    activeMenteesCount: 0,
    isFull: false,
  };

  const renderDirectory = (user = ownerUser, role = 'Project Owner') =>
    render(
      <MemoryRouter>
        <AuthContext.Provider value={{ user, role, isAuthenticated: true }}>
          <RoleContext.Provider value={{ currentRole: role, switchRole: vi.fn() }}>
            <UIProvider>
              <NotificationProvider>
                <MentorsDirectory />
              </NotificationProvider>
            </UIProvider>
          </RoleContext.Provider>
        </AuthContext.Provider>
      </MemoryRouter>,
    );

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem('teamforge.portalRole', 'Project Owner');
    localStorage.setItem('teamforge.currentUser', JSON.stringify(ownerUser));
  });

  it('hides the owner own mentor profile so they cannot try to book themselves', async () => {
    mockMentorApi.listMentors.mockResolvedValue([mentorSelf, mentorOther]);
    mockProjectsApi.list.mockResolvedValue([
      { id: 'proj-live', ownerId: 'owner-1', title: 'Live Project', status: 'Open', isCompleted: false },
    ]);
    mockMentorApi.mySessions.mockResolvedValue([]);

    renderDirectory();

    await waitFor(() => {
      expect(screen.getByText('Neha Gupta')).toBeDefined();
    });
    expect(screen.queryByText('Priya Self Profile')).toBeNull();
  });

  it('disables Book button with reason for Closed, Completed, and soft-deleted projects', async () => {
    mockMentorApi.listMentors.mockResolvedValue([mentorOther]);
    mockMentorApi.mySessions.mockResolvedValue([]);

    const nonBookableProjects = [
      { id: 'p-closed', ownerId: 'owner-1', title: 'Closed App', status: 'Closed', isCompleted: false },
      { id: 'p-comp', ownerId: 'owner-1', title: 'Completed App', status: 'Completed', isCompleted: true },
      {
        id: 'p-del',
        ownerId: 'owner-1',
        title: 'Deleted App',
        status: 'Open',
        isCompleted: false,
        deletedAt: '2026-06-01T10:00:00.000Z',
      },
    ];

    mockProjectsApi.list.mockResolvedValue(nonBookableProjects);

    renderDirectory();

    await waitFor(() => {
      expect(screen.getByText('Neha Gupta')).toBeDefined();
    });

    const select = document.getElementById('directory-project-select');
    expect(select).toBeTruthy();

    // Check Closed (initially selected)
    let bookBtn = screen.getByRole('button', { name: /Book with Escrow/i });
    expect(bookBtn.disabled).toBe(true);
    expect(screen.getByTestId('project-not-bookable-banner').textContent).toMatch(/Closed/i);

    // Switch to Completed
    fireEvent.change(select, { target: { value: 'p-comp' } });
    expect(bookBtn.disabled).toBe(true);
    expect(screen.getByTestId('project-not-bookable-banner').textContent).toMatch(/Completed/i);

    // Switch to Deleted
    fireEvent.change(select, { target: { value: 'p-del' } });
    expect(bookBtn.disabled).toBe(true);
    expect(screen.getByTestId('project-not-bookable-banner').textContent).toMatch(/deleted/i);
  });
});
