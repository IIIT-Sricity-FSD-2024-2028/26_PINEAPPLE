import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import MentorApplication from '../pages/mentor/MentorApplication';
import mentorApplicationsApi from '../services/mentorApplicationsApi';
import adminApi from '../services/adminApi';
import { renderWithProviders } from './test-utils';

vi.mock('../services/mentorApplicationsApi', () => ({
  default: {
    getMyStatus: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('../services/adminApi', () => ({
  default: {
    getPublicConfig: vi.fn(),
  },
}));

vi.mock('../services/uploadsApi', () => ({
  default: {
    uploadCv: vi.fn(),
  },
}));

describe('Phase 4 - Mentor Application Years of Experience Validation (5 to 40)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mentorApplicationsApi.getMyStatus.mockResolvedValue({ status: 'none', application: null });
    mentorApplicationsApi.list.mockResolvedValue([]);
    adminApi.getPublicConfig.mockResolvedValue({ minimumTenure: 5, mentorMinYearsExperience: 5 });
  });

  it('renders experience input with min=5 and max=40 and enforces integer boundaries', async () => {
    renderWithProviders(<MentorApplication />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Years of Professional Experience/i)).toBeDefined();
    });

    const expInput = screen.getByLabelText(/Years of Professional Experience/i);
    expect(expInput.getAttribute('type')).toBe('number');
    expect(expInput.getAttribute('min')).toBe('5');
    expect(expInput.getAttribute('max')).toBe('40');
    expect(expInput.getAttribute('step')).toBe('1');
  });

  it('shows error if years of experience is below 5', async () => {
    renderWithProviders(<MentorApplication />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Years of Professional Experience/i)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sneha Patel' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'sneha@example.com' } });
    fireEvent.change(screen.getByLabelText(/Years of Professional Experience/i), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText(/Areas of Expertise/i), { target: { value: 'Data Science, Python' } });
    fireEvent.change(screen.getByLabelText(/Motivation Statement/i), {
      target: { value: 'Passionate about guiding students in advanced machine learning algorithms.' },
    });

    const form = screen.getByLabelText(/Years of Professional Experience/i).closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Minimum 5 years of professional experience required/i)).toBeDefined();
    });
    expect(mentorApplicationsApi.create).not.toHaveBeenCalled();
  });

  it('shows error if years of experience exceeds 40', async () => {
    renderWithProviders(<MentorApplication />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Years of Professional Experience/i)).toBeDefined();
    });

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: 'Sneha Patel' } });
    fireEvent.change(screen.getByLabelText(/Email Address/i), { target: { value: 'sneha@example.com' } });
    fireEvent.change(screen.getByLabelText(/Years of Professional Experience/i), { target: { value: '45' } });
    fireEvent.change(screen.getByLabelText(/Areas of Expertise/i), { target: { value: 'Cloud Architecture' } });
    fireEvent.change(screen.getByLabelText(/Motivation Statement/i), {
      target: { value: 'Passionate about guiding students in advanced machine learning algorithms.' },
    });

    const form = screen.getByLabelText(/Years of Professional Experience/i).closest('form');
    fireEvent.submit(form);

    await waitFor(() => {
      expect(screen.getByText(/Maximum 40 years of professional experience allowed/i)).toBeDefined();
    });
    expect(mentorApplicationsApi.create).not.toHaveBeenCalled();
  });
});
