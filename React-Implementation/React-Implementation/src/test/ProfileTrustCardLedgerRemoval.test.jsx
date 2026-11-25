import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, render, waitFor } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import UserTrustCard from '../components/features/UserTrustCard';
import Profile from '../pages/profile';
import AdminUserDetails from '../pages/admin/AdminUserDetails';
import { AuthContext } from '../context/AuthContext';
import usersApi from '../services/usersApi';
import projectsApi from '../services/projectsApi';
import joinRequestsApi from '../services/joinRequestsApi';
import mentorshipApi from '../services/mentorshipApi';
import gamificationApi from '../services/gamificationApi';
import trustApi from '../services/trustApi';
import adminApi from '../services/adminApi';

describe('Removal: "View reputation ledger" Button on Profile Trust Card', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockTrustSummary = {
    userId: 'user-1',
    xp: 3200,
    label: 'Trusted contributor',
    band: 'Good standing',
    reputation: 100,
    ledgerLink: '/users/me/reputation',
    trackRecord: {
      tasksApproved: 15,
      projectsCompleted: 5,
      activeProjects: 2,
      onTimeRate: 95,
      firstPassRate: 90,
      sessionsCompleted: 4,
      activeThisWeek: true,
      memberSince: '2025-01-10T00:00:00.000Z',
    },
  };

  it('renders trust card on Profile page with score, tooltip, label, band, XP, stats, and NO "View reputation ledger" button', async () => {
    const mockUser = {
      id: 'user-1',
      uid: 'user-1',
      name: 'Jane Doe',
      username: 'janedoe',
      email: 'jane@example.com',
      role: 'Collaborator',
      stats: { xp: 3200, projects: 5, tasks: 15 },
    };

    vi.spyOn(usersApi, 'getMe').mockResolvedValue(mockUser);
    vi.spyOn(usersApi, 'getReputation').mockResolvedValue({ items: [], total: 0 });
    vi.spyOn(projectsApi, 'list').mockResolvedValue([]);
    vi.spyOn(joinRequestsApi, 'list').mockResolvedValue([]);
    vi.spyOn(mentorshipApi, 'getBadges').mockResolvedValue([]);
    vi.spyOn(gamificationApi, 'getUserLedger').mockResolvedValue([]);
    vi.spyOn(trustApi, 'getMyTrust').mockResolvedValue(mockTrustSummary);

    render(
      <AuthContext.Provider value={{ user: mockUser, isAuthenticated: true }}>
        <MemoryRouter initialEntries={['/profile']}>
          <Profile />
        </MemoryRouter>
      </AuthContext.Provider>
    );

    // 1. Label, Band, XP
    await waitFor(() => {
      expect(screen.getByText('Trusted contributor')).toBeDefined();
      expect(screen.getByText('Good standing')).toBeDefined();
      expect(screen.getByText('3,200 XP')).toBeDefined();
    });

    // 2. Conduct score line and "?" tooltip
    expect(screen.getByText(/Conduct Score:/i)).toBeDefined();
    expect(screen.getByText('100 / 100')).toBeDefined();
    const tooltipBtn = screen.getByRole('button', { name: /How does Conduct Score work\?/i });
    expect(tooltipBtn).toBeDefined();

    // Clicking tooltip reveals explanation
    fireEvent.click(tooltipBtn);
    expect(screen.getByText(/Starts at 100. Reduced only by conduct penalties/i)).toBeDefined();

    // 3. Track Record block and five labels are absent
    expect(screen.queryByText(/Track Record/i)).toBeNull();
    expect(screen.queryByText(/^Tasks Approved$/i)).toBeNull();
    expect(screen.queryByText(/^On-Time Rate$/i)).toBeNull();
    expect(screen.queryByText(/^First-Pass Rate$/i)).toBeNull();
    expect(screen.queryByText(/^Projects Completed$/i)).toBeNull();

    // 4. CRITICAL ASSERTION: "View reputation ledger" is strictly ABSENT
    expect(screen.queryByText(/View reputation ledger/i)).toBeNull();
  });

  it('renders peer view (isSelf=false) without private conduct score, ledger link, or Track Record block', () => {
    render(
      <BrowserRouter>
        <UserTrustCard
          summary={mockTrustSummary}
          variant="expanded"
          isSelf={false}
          isAdminViewer={false}
        />
      </BrowserRouter>
    );

    // Public badges and XP render
    expect(screen.getByText('Trusted contributor')).toBeDefined();
    expect(screen.getByText('Good standing')).toBeDefined();
    expect(screen.getByText('3,200 XP')).toBeDefined();

    // Private conduct score, ledger link, and Track Record block must not render
    expect(screen.queryByText(/Conduct Score:/i)).toBeNull();
    expect(screen.queryByText(/100 \/ 100/i)).toBeNull();
    expect(screen.queryByText(/View reputation ledger/i)).toBeNull();
    expect(screen.queryByText(/Track Record/i)).toBeNull();
  });

  it('admin screens displaying reputation ledger continue to function and render their section', async () => {
    const mockAdminUser = {
      id: 'target-user-1',
      name: 'Target User',
      email: 'target@example.com',
      role: 'Collaborator',
      rep: 80,
    };

    vi.spyOn(adminApi, 'getUserDetails').mockResolvedValue(mockAdminUser);
    vi.spyOn(adminApi, 'getUserReputation').mockResolvedValue({
      items: [
        {
          id: 'rep-1',
          type: 'seed',
          amount: 100,
          currentReputation: 100,
          reason: 'Initial onboarding score',
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
    });
    vi.spyOn(mentorshipApi, 'getBadges').mockResolvedValue([]);

    render(
      <MemoryRouter initialEntries={['/admin/users/target-user-1']}>
        <Routes>
          <Route path="/admin/users/:id" element={<AdminUserDetails />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('admin-reputation-card')).toBeDefined();
      expect(screen.getByText(/Reputation Ledger \(1\)/i)).toBeDefined();
      expect(screen.getByText('Starting reputation')).toBeDefined();
    });
  });
});
