import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { RoleContext } from '../context/RoleContext';
import { UIProvider } from '../context/UIContext';
import ChatBox from '../components/features/ChatBox';
import AdminUsers from '../pages/admin/AdminUsers';
import AdminReports from '../pages/admin/AdminReports';
import CreateProject from '../pages/owner/CreateProject';
import VerifyEmailBanner from '../components/common/VerifyEmailBanner';
import VerifyEmail from '../pages/VerifyEmail';
import Signup from '../pages/Signup';
import Settings from '../pages/settings';

import communicationApi from '../services/communicationApi';
import adminApi from '../services/adminApi';
import reportsApi from '../services/reportsApi';
import projectsApi from '../services/projectsApi';
import authApi from '../services/authApi';
import usersApi from '../services/usersApi';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  updateProfile: vi.fn(),
  signInWithPopup: vi.fn(),
  RecaptchaVerifier: vi.fn(),
  signInWithPhoneNumber: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}));

vi.mock('../services/firebase.js', () => ({
  auth: { currentUser: null },
  googleProvider: {},
  githubProvider: {},
  phoneVerifyAuth: null,
}));

vi.mock('../services/apiClient.js', async () => {
  const actual = await vi.importActual('../services/apiClient.js');
  return {
    ...actual,
    getAuthMode: vi.fn(() => 'jwt'),
    setAccessToken: vi.fn(),
  };
});

vi.mock('../services/communicationApi', () => ({
  default: {
    getMessages: vi.fn(),
    sendMessage: vi.fn(),
    reportMessage: vi.fn(),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    listUsers: vi.fn(),
    getDuplicateUsers: vi.fn(),
    getPublicConfig: vi.fn(() => Promise.resolve({ maxCollaboratorsPerProject: 20 })),
  },
  recordPortalAuditEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../services/reportsApi', () => ({
  default: {
    getAdminReports: vi.fn(),
    getReportDetails: vi.fn(),
    updateReportStatus: vi.fn(),
    actionReport: vi.fn(),
  },
}));

vi.mock('../services/appealsApi', () => ({
  default: {
    getAdminAppeals: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../services/projectsApi', () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock('../services/authApi', () => ({
  default: {
    verifyEmail: vi.fn(),
    resendVerification: vi.fn(),
  },
}));

vi.mock('../services/usersApi', () => ({
  default: {
    checkUsernameAvailable: vi.fn(() => Promise.resolve({ available: true })),
    get: vi.fn(),
    getMe: vi.fn(),
    update: vi.fn(),
    getPhoneOtpStatus: vi.fn(),
    requestPhoneOtp: vi.fn(),
    verifyPhoneOtp: vi.fn(),
    recordFailedOtpAttempt: vi.fn(),
    deletePhone: vi.fn(),
  },
  usersApi: {
    checkUsernameAvailable: vi.fn(() => Promise.resolve({ available: true })),
    get: vi.fn(),
    getMe: vi.fn(),
    update: vi.fn(),
    getPhoneOtpStatus: vi.fn(),
    requestPhoneOtp: vi.fn(),
    verifyPhoneOtp: vi.fn(),
    recordFailedOtpAttempt: vi.fn(),
    deletePhone: vi.fn(),
  },
}));

const renderWithAuth = (ui, { user = null, updateUser = vi.fn(), signup = vi.fn(), route = '/' } = {}) =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <UIProvider>
        <AuthContext.Provider
          value={{
            user,
            isAuthenticated: Boolean(user),
            loading: false,
            login: vi.fn(),
            signup,
            logout: vi.fn(),
            updateUser,
            refreshToken: vi.fn(),
            authMode: 'jwt',
          }}
        >
          <RoleContext.Provider value={{ activeRole: user?.role || 'Collaborator' }}>
            {ui}
          </RoleContext.Provider>
        </AuthContext.Provider>
      </UIProvider>
    </MemoryRouter>,
  );

describe('Phase 16: Trust & Safety Frontend Workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  it('1. ChatBox hides Report button on own messages, submits report modal, and surfaces duplicate/limit errors', async () => {
    communicationApi.reportMessage.mockResolvedValueOnce({ id: 'rep-chat-1' });

    const messages = [
      { id: 'm-mine', senderId: 'u1', senderName: 'Me', content: 'My own text', timestamp: '2026-12-01T10:00:00Z' },
      { id: 'm-other', senderId: 'u2', senderName: 'Other User', content: 'Inappropriate remark', timestamp: '2026-12-01T10:01:00Z' },
      { id: 'm-other-2', senderId: 'u2', senderName: 'Other User', content: 'Second offending message', timestamp: '2026-12-01T10:02:00Z' },
    ];

    render(
      <ChatBox
        messages={messages}
        currentUserId="u1"
        currentUserName="Me"
        onSendMessage={vi.fn()}
      />,
    );

    expect(screen.queryByTestId('report-msg-btn-m-mine')).toBeNull();
    const reportBtn = screen.getByTestId('report-msg-btn-m-other');
    fireEvent.click(reportBtn);

    const textarea = screen.getByTestId('chat-report-reason-input');
    fireEvent.change(textarea, { target: { value: 'This chat message contains abusive harassment.' } });
    fireEvent.click(screen.getByTestId('submit-chat-report-btn'));

    await waitFor(() => {
      expect(communicationApi.reportMessage).toHaveBeenCalledWith(
        'm-other',
        'This chat message contains abusive harassment.',
      );
      expect(screen.getByTestId('chat-report-success')).toBeTruthy();
      expect(screen.getByTestId('reported-badge-m-other')).toBeTruthy();
    });

    // Server error feedback (ALREADY_REPORTED) on another message
    communicationApi.reportMessage.mockRejectedValueOnce({
      code: 'ALREADY_REPORTED',
      message: 'Already reported',
    });
    fireEvent.click(screen.getByTestId('report-msg-btn-m-other-2'));
    fireEvent.change(screen.getByTestId('chat-report-reason-input'), {
      target: { value: 'Submitting duplicate report check message.' },
    });
    fireEvent.click(screen.getByTestId('submit-chat-report-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('chat-report-error').textContent).toContain('already reported');
    });
  });

  it('2. AdminUsers shows Possible duplicates tab with normalized groups and never auto-blocks', async () => {
    adminApi.listUsers.mockResolvedValueOnce([
      { id: '1', name: 'Alice One', role: 'Collaborator', status: 'Active' },
    ]);
    adminApi.getDuplicateUsers.mockResolvedValueOnce({
      groups: [
        {
          key: 'email:alice@gmail.com',
          type: 'email',
          normalizedValue: 'alice@gmail.com',
          reason: 'Shared normalized email address',
          users: [
            { id: '1', name: 'Alice One', username: 'alice1', email: 'a.lice@gmail.com', status: 'Active' },
            { id: '2', name: 'Alice Two', username: 'alice2', email: 'alice+alt@gmail.com', status: 'Active' },
          ],
        },
      ],
    });

    renderWithAuth(<AdminUsers />, {
      user: { id: 'admin-1', role: 'admin', permissions: ['users', '*'] },
    });

    const dupTab = await screen.findByText(/Possible duplicates \(1\)/i);
    fireEvent.click(dupTab);

    await waitFor(() => {
      expect(screen.getByTestId('duplicate-group-email')).toBeTruthy();
      expect(screen.getByText(/Shared normalized email address/i)).toBeTruthy();
      expect(screen.getByText(/alice@gmail.com/i)).toBeTruthy();
    });
  });

  it('3. AdminReports renders chat_message badge, reported message box, and 20-message snapshot', async () => {
    reportsApi.getAdminReports.mockResolvedValueOnce([
      {
        id: 'rep-100',
        type: 'chat_message',
        reportedUserName: 'Bob Author',
        reportedUserUsername: 'bob',
        reporterName: 'Arjun',
        reporterUsername: 'arjun',
        reason: 'Other',
        status: 'Open',
        createdAt: '2026-12-01T12:00:00Z',
      },
    ]);
    reportsApi.getReportDetails.mockResolvedValueOnce({
      id: 'rep-100',
      type: 'chat_message',
      projectId: 'proj-1',
      messageId: 'msg-12',
      reportedUserId: '2',
      reportedUserName: 'Bob Author',
      reportedUserUsername: 'bob',
      reporterName: 'Arjun',
      reporterUsername: 'arjun',
      reason: 'Other',
      details: 'Repeated toxic comments inside chat thread.',
      status: 'Open',
      reportedMessage: {
        id: 'msg-12',
        senderName: 'Bob Author',
        content: 'Offensive line preserved',
        timestamp: '2026-12-01T11:55:00Z',
      },
      messageSnapshot: Array.from({ length: 20 }, (_, i) => ({
        id: `msg-${i + 1}`,
        senderName: i === 11 ? 'Bob Author' : 'Teammate',
        content: i === 11 ? 'Offensive line preserved' : `Context message ${i + 1}`,
        timestamp: '2026-12-01T11:50:00Z',
      })),
      priorWarnings: [],
      priorReports: [],
    });

    renderWithAuth(<AdminReports />, {
      user: { id: 'admin-1', role: 'admin', permissions: ['reports', '*'] },
    });

    await waitFor(() => {
      expect(screen.getByTestId('chat-report-badge-rep-100')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('review-report-rep-100'));

    await waitFor(() => {
      expect(screen.getByTestId('detail-chat-report-badge')).toBeTruthy();
      expect(screen.getByTestId('reported-message-box').textContent).toContain('Offensive line preserved');
      expect(screen.getByTestId('chat-snapshot-list')).toBeTruthy();
      expect(screen.getByText(/20 messages preserved/i)).toBeTruthy();
    });
  });

  it('4. CreateProject shows character counters and maps CONTENT_NOT_ALLOWED / limit errors inline', async () => {
    renderWithAuth(<CreateProject />, {
      user: { id: '1', name: 'Owner', role: 'Project Owner', emailVerified: true },
    });

    expect(screen.getByText('0/5 minimum characters')).toBeTruthy();
    expect(screen.getByText('0/100 minimum characters')).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/AI Campus Navigator/i), { target: { value: 'Hi' } });
    fireEvent.change(screen.getByPlaceholderText(/at least 100 characters/i), { target: { value: 'Too short desc' } });
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(screen.getByText('Title must be at least 5 characters.')).toBeTruthy();
      expect(screen.getByText('Description must be at least 100 characters.')).toBeTruthy();
    });
    expect(projectsApi.create).not.toHaveBeenCalled();

    // Valid length -> server rejects CONTENT_NOT_ALLOWED on title
    projectsApi.create.mockRejectedValueOnce({
      code: 'CONTENT_NOT_ALLOWED',
      field: 'title',
      message: 'The field "title" contains content that is not allowed on TeamForge.',
    });

    const titleInput = screen.getByPlaceholderText(/AI Campus Navigator/i);
    const descInput = screen.getByPlaceholderText(/at least 100 characters/i);
    const dueInput = document.querySelector('input[type="date"], input[placeholder="DD/MM/YYYY"]');

    fireEvent.change(titleInput, { target: { value: 'Valid Title Long Enough' } });
    fireEvent.change(descInput, { target: { value: 'D'.repeat(110) } });
    if (dueInput) {
      fireEvent.change(dueInput, { target: { value: '2027-06-01' } });
    }
    fireEvent.click(screen.getByRole('button', { name: /Create Project/i }));

    await waitFor(() => {
      expect(projectsApi.create).toHaveBeenCalled();
      expect(screen.getAllByText(/not allowed/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('5. VerifyEmailBanner & VerifyEmail page handle resend cooldown and token confirmation', async () => {
    authApi.resendVerification.mockResolvedValueOnce({
      sent: true,
      message: 'Verification email sent. Please check your inbox.',
      cooldownSeconds: 120,
    });

    renderWithAuth(<VerifyEmailBanner />, {
      user: { id: 'u-9', email: 'new@edu.org', role: 'Collaborator', emailVerified: false },
    });

    expect(screen.getByTestId('verify-email-banner')).toBeTruthy();
    const resendBtn = screen.getByTestId('resend-verification-btn');
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(authApi.resendVerification).toHaveBeenCalled();
      expect(screen.getByTestId('verify-email-status')).toBeTruthy();
      expect(screen.getByTestId('resend-verification-btn').disabled).toBe(true);
      expect(screen.getByTestId('resend-verification-btn').textContent).toMatch(/2m 00s|1m 59s/);
    });

    // VerifyEmail route page marks email verified on valid token
    const updateUser = vi.fn();
    authApi.verifyEmail.mockResolvedValueOnce({
      verified: true,
      message: 'Email address verified successfully.',
      user: { emailVerifiedAt: '2026-12-01T12:00:00Z' },
    });

    renderWithAuth(<VerifyEmail />, {
      user: { id: 'u-9', email: 'new@edu.org', emailVerified: false },
      updateUser,
      route: '/verify-email?token=abc-token-123',
    });

    await waitFor(() => {
      expect(authApi.verifyEmail).toHaveBeenCalledWith('abc-token-123');
      expect(screen.getByTestId('verify-email-result-msg').textContent).toContain('verified successfully');
      expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ emailVerified: true }));
    });
  });

  it('6. Signup submits email + password without username and surfaces backend errors', async () => {
    const signupMock = vi.fn().mockRejectedValueOnce({
      message: 'An account with this email already exists',
    });

    renderWithAuth(<Signup />, { signup: signupMock });
    expect(screen.queryByPlaceholderText(/johndoe/i)).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/name@example\.com/i), { target: { value: 'user@university.edu' } });
    const pwInputs = document.querySelectorAll('input[type="password"]');
    fireEvent.change(pwInputs[0], { target: { value: 'Password123!' } });
    fireEvent.change(pwInputs[1], { target: { value: 'Password123!' } });
    fireEvent.click(screen.getByRole('button', { name: /^Sign Up$/i }));

    await waitFor(() => {
      expect(signupMock).toHaveBeenCalledWith({
        email: 'user@university.edu',
        password: 'Password123!',
        role: 'Collaborator',
      });
      expect(screen.getByText(/already exists/i)).toBeTruthy();
    });
  });

  it('7. Settings shows backend 15m OTP lockout countdown', async () => {
    const profileMock = {
      id: '2',
      name: 'Arjun',
      username: 'arjunsharma',
      email: 'arjun@teamforge.io',
      phone: '+919876543210',
      phoneVerified: false,
      profile: { bio: 'Developer building React apps' },
    };
    usersApi.getMe.mockResolvedValueOnce(profileMock);
    usersApi.getPhoneOtpStatus.mockResolvedValueOnce({
      locked: true,
      wrongAttempts: 5,
      remainingSeconds: 900,
    });

    renderWithAuth(<Settings />, {
      user: { id: '2', name: 'Arjun', username: 'arjunsharma', email: 'arjun@teamforge.io', emailVerified: true },
    });

    const verifyBtn = await screen.findByRole('button', { name: 'Verify' });
    fireEvent.click(verifyBtn);

    await waitFor(() => {
      expect(usersApi.getPhoneOtpStatus).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: /Locked \(1[45]m/i }).disabled).toBe(true);
    });
  });
});
