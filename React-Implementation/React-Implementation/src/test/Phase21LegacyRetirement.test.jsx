import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import { NotificationContext } from '../context/NotificationContext';
import Help from '../pages/help';
import MentorApplication from '../pages/mentor/MentorApplication';
import mentorshipApi from '../services/mentorshipApi';
import reportsApi from '../services/reportsApi';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import uploadsApi from '../services/uploadsApi';
import usersApi from '../services/usersApi';
import tokenManager from '../services/tokenManager';
import storage from '../utils/storage';

vi.mock('../services/reportsApi', () => ({
  default: {
    getMyReports: vi.fn().mockResolvedValue([]),
    createReport: vi.fn().mockResolvedValue({ id: 'rep-21', status: 'Open' }),
  },
}));

vi.mock('../services/mentorApplicationsApi', () => ({
  default: {
    getMyStatus: vi.fn().mockResolvedValue({ status: 'none', mentorUnlocked: false, allApplications: [] }),
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    pullDigiLockerDocuments: vi.fn(),
    getDigiLockerStatus: vi.fn().mockResolvedValue({ mode: 'sandbox', isSimulated: true }),
  },
}));

vi.mock('../services/uploadsApi', () => ({
  default: {
    uploadCv: vi.fn(),
    downloadCv: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    getMe: vi.fn().mockResolvedValue({ id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io' }),
    searchUsers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getPublicConfig: vi.fn().mockResolvedValue({ mentorMinYearsExperience: 5, minimumTenure: 5 }),
  },
}));

function renderWithContexts(ui, { user = { id: '2', name: 'Arjun Sharma', email: 'arjun@teamforge.io', emailVerified: true } } = {}) {
  return render(
    <MemoryRouter>
      <UIProvider>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: true,
            login: vi.fn(),
            logout: vi.fn(),
            updateUser: vi.fn(),
            setUser: vi.fn(),
          }}
        >
          <RoleContext.Provider
            value={{
              currentRole: 'Collaborator',
              switchRole: vi.fn(),
              isMentorApproved: false,
              mentorAppStatus: 'none',
              refreshMentorStatus: vi.fn(),
            }}
          >
            <NotificationContext.Provider
              value={{
                notifications: [],
                unreadCount: 0,
                markAsRead: vi.fn(),
                markAllAsRead: vi.fn(),
              }}
            >
              {ui}
            </NotificationContext.Provider>
          </RoleContext.Provider>
        </AuthContext.Provider>
      </UIProvider>
    </MemoryRouter>,
  );
}

describe('Phase 21: Legacy Route Retirement & Canonical Caller Migration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.setBackendUserId('2');
    tokenManager.setTokens({
      accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjk5OTk5OTk5OTl9.signature',
      refreshToken: 'fake-refresh',
    });
    mentorApplicationsApi.getMyStatus.mockResolvedValue({
      status: 'none',
      mentorUnlocked: false,
      allApplications: [],
    });
    mentorApplicationsApi.list.mockResolvedValue([]);
    usersApi.searchUsers.mockResolvedValue([
      { id: '3', name: 'Kiran Bose', username: 'kiranb' },
    ]);
  });

  it('1. Removes retired mentor/governance wrappers from mentorshipApi and targets canonical routes in API clients', async () => {
    expect(mentorshipApi.apply).toBeUndefined();
    expect(mentorshipApi.getApplication).toBeUndefined();
    expect(mentorshipApi.reviewApplication).toBeUndefined();

    expect(typeof mentorshipApi.issueBadge).toBe('function');
    expect(typeof mentorshipApi.getBadges).toBe('function');
    expect(typeof mentorshipApi.getBadgesByProject).toBe('function');

    const actualReports = (await vi.importActual('../services/reportsApi.js')).default;
    const actualMentorApps = (await vi.importActual('../services/mentorApplicationsApi.js')).default;

    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      text: async () => JSON.stringify({ id: 'ok' }),
    });

    try {
      await actualReports.createReport({ reportedUserId: '3', reason: 'Spam', details: 'Testing canonical report endpoint.' });
      await actualMentorApps.getMyStatus();
      await actualMentorApps.create({ name: 'Arjun', yearsOfExperience: 6 });

      const urls = fetchSpy.mock.calls.map(([url]) => String(url));
      expect(urls.some((u) => u.includes('/governance'))).toBe(false);
      expect(urls.some((u) => u.includes('/mentorship/apply') || u.includes('/mentorship/application'))).toBe(false);
      expect(urls.some((u) => u.endsWith('/reports'))).toBe(true);
      expect(urls.some((u) => u.endsWith('/mentor-applications/me'))).toBe(true);
      expect(urls.some((u) => u.endsWith('/mentor-applications'))).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('2. Help report form submits through canonical reportsApi.createReport', async () => {
    renderWithContexts(<Help />);

    fireEvent.click(await screen.findByTestId('tab-report'));
    fireEvent.change(await screen.findByTestId('user-search-input'), { target: { value: 'kiran' } });
    fireEvent.click(await screen.findByTestId('search-result-3'));
    fireEvent.change(screen.getByTestId('reason-select'), { target: { value: 'Harassment' } });
    fireEvent.change(screen.getByLabelText(/Details & Context/i), {
      target: { value: 'Detailed report submitted through canonical Reports API endpoint.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Submit Report/i }));

    await waitFor(() => {
      expect(reportsApi.createReport).toHaveBeenCalledWith({
        reportedUserId: '3',
        reason: 'Harassment',
        details: 'Detailed report submitted through canonical Reports API endpoint.',
      });
    });
  });

  it('3. MentorApplication loads status and submits application through canonical mentorApplicationsApi', async () => {
    uploadsApi.uploadCv.mockResolvedValue({
      filename: 'cv-arjun.pdf',
      originalName: 'cv-arjun.pdf',
      size: 10240,
      url: '/uploads/cv/cv-arjun.pdf',
    });
    mentorApplicationsApi.pullDigiLockerDocuments.mockResolvedValue({
      documents: [
        {
          title: 'B.Tech Computer Science',
          issuer: 'IIT Delhi',
          holderName: 'Arjun Sharma',
          documentNumber: 'DL-2026-001',
          status: 'verified',
        },
      ],
    });
    mentorApplicationsApi.create.mockResolvedValue({
      id: 'app-21',
      userId: '2',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });

    renderWithContexts(<MentorApplication />);

    await waitFor(() => expect(mentorApplicationsApi.getMyStatus).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Arjun Sharma' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'arjun@teamforge.io' } });
    fireEvent.change(screen.getByLabelText(/Years of Professional Experience/i), { target: { value: '7' } });
    fireEvent.change(screen.getByLabelText(/Areas of Expertise/i), { target: { value: 'React, NestJS' } });
    fireEvent.change(screen.getByLabelText(/Motivation Statement/i), {
      target: { value: 'Mentoring student engineers on architecture and clean code.' },
    });

    const cvInput = document.getElementById('mentor-cv-file');
    const pdfFile = new File(['%PDF-1.4\n'], 'cv-arjun.pdf', { type: 'application/pdf' });
    fireEvent.change(cvInput, { target: { files: [pdfFile] } });
    await waitFor(() => expect(uploadsApi.uploadCv).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: /Connect DigiLocker/i }));
    await waitFor(() => expect(mentorApplicationsApi.pullDigiLockerDocuments).toHaveBeenCalled());

    const submitBtn = screen.getByRole('button', { name: /Submit Application/i });
    fireEvent.submit(submitBtn.closest('form'));

    await waitFor(() => {
      expect(mentorApplicationsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: '2',
          yearsOfExperience: 7,
          cvFileName: 'cv-arjun.pdf',
        }),
      );
    });
  });

  it('4. MentorApplication renders existing canonical status from getMyStatus', async () => {
    mentorApplicationsApi.getMyStatus.mockResolvedValue({
      status: 'pending',
      mentorUnlocked: false,
      application: {
        id: 'app-pending-21',
        userId: '2',
        status: 'pending',
        experienceYears: 8,
        skills: ['Architecture'],
        createdAt: new Date().toISOString(),
      },
      allApplications: [{ id: 'app-pending-21', status: 'pending' }],
    });

    renderWithContexts(<MentorApplication />);

    await waitFor(() => {
      expect(mentorApplicationsApi.getMyStatus).toHaveBeenCalled();
      expect(screen.getByText(/Pending/i)).toBeTruthy();
    });
  });
});
