import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import MentorApplication from '../pages/mentor/MentorApplication';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import uploadsApi from '../services/uploadsApi';
import adminApi from '../services/adminApi';
import { setAccessToken } from '../services/apiClient';
import { renderWithStore } from './test-utils';

vi.mock('../services/mentorApplicationsApi', () => ({
  default: {
    getMyStatus: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
    getDigiLockerStatus: vi.fn(),
    pullDigiLockerDocuments: vi.fn(),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getPublicConfig: vi.fn(),
  },
}));

describe('MentorApplication CV Upload & No-Reload / No-Remount Regression Tests', () => {
  const applicantUser = {
    id: '6',
    name: 'Aditya Sai',
    username: 'adityasai',
    email: 'aditya.sai@teamforge.io',
    role: 'Collaborator',
    emailVerified: true,
    mentorUnlocked: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setAccessToken('test-jwt-token');
    mentorApplicationsApi.getMyStatus.mockResolvedValue({
      status: 'none',
      mentorUnlocked: false,
      application: null,
    });
    mentorApplicationsApi.getDigiLockerStatus.mockResolvedValue({
      mode: 'sandbox',
      available: true,
    });
    adminApi.getPublicConfig.mockResolvedValue({ mentorMinYearsExperience: 5 });
  });

  afterEach(() => {
    setAccessToken(null);
    vi.restoreAllMocks();
  });

  it('shows selected file name and size at once, keeps typed fields & same <input> DOM node, ignores window focus refresh, and does not submit/reload or store File in Redux', async () => {
    let resolveUpload;
    const uploadPromise = new Promise((resolve) => {
      resolveUpload = resolve;
    });

    const originalFetch = globalThis.fetch;
    const fetchSpy = vi.fn().mockImplementation((url) => {
      if (String(url).includes('/uploads/cv')) {
        return uploadPromise;
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        headers: new Headers(),
        text: async () => '{}',
      });
    });
    globalThis.fetch = fetchSpy;

    const reloadSpy = vi.fn();
    const assignSpy = vi.fn();
    const origLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...origLocation, reload: reloadSpy, assign: assignSpy },
    });

    try {
      const { store } = renderWithStore(<MentorApplication />, {
        preloadedState: {
          session: {
            status: 'authenticated',
            isAuthenticated: true,
            user: applicantUser,
            activeRole: 'collaborator',
            allowedRoles: ['collaborator', 'project-owner'],
          },
        },
      });

      const yearsInput = await screen.findByLabelText(/Years of Professional Experience/i);
      const skillsInput = screen.getByLabelText(/Areas of Expertise \/ Skills/i);
      const bioInput = screen.getByLabelText(/Motivation Statement/i);

      fireEvent.change(yearsInput, { target: { value: '7' } });
      fireEvent.change(skillsInput, { target: { value: 'React, NestJS' } });
      fireEvent.change(bioInput, {
        target: { value: 'Passionate engineer ready to mentor students.' },
      });

      const fileInputBefore = document.getElementById('mentor-cv-file');
      expect(fileInputBefore).not.toBeNull();

      const pdfFile = new File(['%PDF-1.4\n%%EOF'], 'my-resume.pdf', {
        type: 'application/pdf',
      });

      // Selecting a file triggers uploadCv without submitting the application form
      fireEvent.change(fileInputBefore, { target: { files: [pdfFile] } });

      // File name & size appear immediately in local state while upload is in-flight
      expect(await screen.findByText('my-resume.pdf')).toBeDefined();
      expect(screen.getByText(/14 B/)).toBeDefined();

      // Simulate returning from OS file picker firing window focus
      act(() => {
        window.dispatchEvent(new Event('focus'));
      });

      // Form did NOT unmount/remount or refetch status on focus
      expect(screen.queryByText(/Checking application status/i)).toBeNull();
      expect(mentorApplicationsApi.getMyStatus).toHaveBeenCalledTimes(1);

      // Verify FormData sent without manual Content-Type header
      await waitFor(() => {
        expect(fetchSpy).toHaveBeenCalledTimes(1);
      });
      const [, fetchInit] = fetchSpy.mock.calls[0];
      expect(fetchInit.body).toBeInstanceOf(FormData);
      expect(fetchInit.headers['Content-Type']).toBeUndefined();
      expect(fetchInit.headers['content-type']).toBeUndefined();

      // Complete upload response
      await act(async () => {
        resolveUpload({
          ok: true,
          status: 201,
          headers: new Headers(),
          text: async () =>
            JSON.stringify({
              filename: 'cv-123.pdf',
              originalName: 'my-resume.pdf',
              size: 15,
              url: '/uploads/cv/cv-123.pdf',
            }),
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/Verified PDF/i)).toBeDefined();
      });

      // Exact same <input type="file"> DOM element (not recreated)
      const fileInputAfter = document.getElementById('mentor-cv-file');
      expect(fileInputAfter).toBe(fileInputBefore);

      // Typed fields preserved; no form submit or window.location navigation/reload occurred
      expect(yearsInput.value).toBe('7');
      expect(skillsInput.value).toBe('React, NestJS');
      expect(bioInput.value).toBe('Passionate engineer ready to mentor students.');
      expect(mentorApplicationsApi.create).not.toHaveBeenCalled();
      expect(reloadSpy).not.toHaveBeenCalled();
      expect(assignSpy).not.toHaveBeenCalled();

      // Redux state must NOT store any non-serializable File object
      const sliceState = store.getState().mentorApplications;
      expect(sliceState.cvData).toEqual({
        filename: 'cv-123.pdf',
        originalName: 'my-resume.pdf',
        size: 15,
        url: '/uploads/cv/cv-123.pdf',
      });
      expect(JSON.stringify(sliceState)).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: origLocation,
      });
    }
  });

  it('displays server magic-byte rejection error under the CV field while keeping all form values intact', async () => {
    const uploadSpy = vi.spyOn(uploadsApi, 'uploadCv').mockRejectedValueOnce({
      statusCode: 400,
      code: 'UNSUPPORTED_FILE_TYPE',
      serverMessage: 'Invalid PDF signature (%PDF- header missing).',
      message: 'Validation Error: Invalid PDF signature (%PDF- header missing).',
    });

    renderWithStore(<MentorApplication />, {
      preloadedState: {
        session: {
          status: 'authenticated',
          isAuthenticated: true,
          user: applicantUser,
          activeRole: 'collaborator',
          allowedRoles: ['collaborator', 'project-owner'],
        },
      },
    });

    const yearsInput = await screen.findByLabelText(/Years of Professional Experience/i);
    const skillsInput = screen.getByLabelText(/Areas of Expertise \/ Skills/i);
    const bioInput = screen.getByLabelText(/Motivation Statement/i);

    fireEvent.change(yearsInput, { target: { value: '8' } });
    fireEvent.change(skillsInput, { target: { value: 'TypeScript, Python' } });
    fireEvent.change(bioInput, {
      target: { value: 'Mentoring students on architecture and testing.' },
    });

    const fileInput = document.getElementById('mentor-cv-file');
    const disguisedTxt = new File(['not a real pdf'], 'renamed.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, { target: { files: [disguisedTxt] } });

    await waitFor(() => {
      expect(uploadSpy).toHaveBeenCalledTimes(1);
    });

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Invalid PDF signature');
    expect(yearsInput.value).toBe('8');
    expect(skillsInput.value).toBe('TypeScript, Python');
    expect(bioInput.value).toBe('Mentoring students on architecture and testing.');
    expect(mentorApplicationsApi.create).not.toHaveBeenCalled();
  });
});
