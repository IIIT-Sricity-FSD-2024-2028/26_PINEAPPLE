import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import MyMentorProfile from '../pages/mentor/MyMentorProfile';
import {
  INVALID_PRICE_MESSAGE,
  validatePriceInput,
} from '../utils/mentorProfileValidation';
import mentorMarketplaceApi from '../services/mentorMarketplaceApi';
import { renderWithStore } from './test-utils';

vi.mock('../services/mentorMarketplaceApi', () => ({
  default: {
    myProfile: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    updateAvailability: vi.fn(() => Promise.resolve({ success: true })),
    getMyAbandonmentReviews: vi.fn(() => Promise.resolve([])),
  },
}));

describe('Mentor Profile Price (INR) Component & Validation Tests', () => {
  const mockUser = { id: 'mentor-1', name: 'Neha Gupta', role: 'mentor' };

  const mockExistingProfile = {
    id: 'profile-1',
    userId: 'mentor-1',
    name: 'Neha Gupta',
    title: 'Senior React Architect',
    bio: 'Experienced React developer and architect',
    skills: ['React', 'JavaScript', 'Node.js'],
    experienceYears: 5,
    sessionPrice: 1500,
    availability: 'AVAILABLE',
  };

  const renderComponent = () => {
    return renderWithStore(<MyMentorProfile />, {
      preloadedState: {
        session: {
          user: mockUser,
          isAuthenticated: true,
          status: 'authenticated',
          activeRole: 'mentor',
          allowedRoles: ['mentor'],
        },
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mentorMarketplaceApi.myProfile.mockResolvedValue(mockExistingProfile);
    mentorMarketplaceApi.updateProfile.mockResolvedValue({
      ...mockExistingProfile,
      sessionPrice: 117,
    });
  });

  describe('validatePriceInput helper function', () => {
    it('accepts whole numbers in [1, 100000]', () => {
      expect(validatePriceInput(1)).toBe('');
      expect(validatePriceInput('1')).toBe('');
      expect(validatePriceInput(117)).toBe('');
      expect(validatePriceInput('117')).toBe('');
      expect(validatePriceInput(125)).toBe('');
      expect(validatePriceInput('125')).toBe('');
      expect(validatePriceInput(999)).toBe('');
      expect(validatePriceInput('999')).toBe('');
      expect(validatePriceInput(1000)).toBe('');
      expect(validatePriceInput('1000')).toBe('');
      expect(validatePriceInput(100000)).toBe('');
      expect(validatePriceInput('100000')).toBe('');
    });

    it('rejects empty, 0, negative, decimals, non-numeric and > 100000 with INVALID_PRICE_MESSAGE', () => {
      expect(validatePriceInput('')).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput(0)).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput('0')).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput(-5)).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput(12.5)).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput('12.5')).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput('abc')).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput(100001)).toBe(INVALID_PRICE_MESSAGE);
      expect(validatePriceInput('100001')).toBe(INVALID_PRICE_MESSAGE);
    });
  });

  describe('Price Input Attributes & Typing Behavior', () => {
    it('renders input with correct type, min=1, max=100000, step=1, and label "Price (INR)"', async () => {
      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      expect(priceInput).toBeDefined();
      expect(priceInput.getAttribute('type')).toBe('number');
      expect(priceInput.getAttribute('min')).toBe('1');
      expect(priceInput.getAttribute('max')).toBe('100000');
      expect(priceInput.getAttribute('step')).toBe('1');
      expect(priceInput.getAttribute('inputmode')).toBe('numeric');
      expect(priceInput.value).toBe('1500');
    });

    it('allows typing non-multiples of 10 like 117 and updates live preview card to ₹117', async () => {
      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      fireEvent.change(priceInput, { target: { value: '117' } });

      expect(priceInput.value).toBe('117');
      // Live preview card should show ₹117
      expect(screen.getByText('₹117')).toBeDefined();
    });

    it('allows typing 125, 999, 1000 and reflects correctly in live preview card', async () => {
      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);

      fireEvent.change(priceInput, { target: { value: '125' } });
      expect(priceInput.value).toBe('125');
      expect(screen.getByText('₹125')).toBeDefined();

      fireEvent.change(priceInput, { target: { value: '999' } });
      expect(priceInput.value).toBe('999');
      expect(screen.getByText('₹999')).toBeDefined();

      fireEvent.change(priceInput, { target: { value: '1000' } });
      expect(priceInput.value).toBe('1000');
      expect(screen.getByText('₹1000')).toBeDefined();
    });

    it('allows clearing the input while typing without crashing, and validates on blur', async () => {
      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      fireEvent.change(priceInput, { target: { value: '' } });
      expect(priceInput.value).toBe('');

      // Blur without entering a value triggers validation error
      fireEvent.blur(priceInput);
      expect(screen.getByText(INVALID_PRICE_MESSAGE)).toBeDefined();
    });

    it('shows error message on blur when entering a decimal like 12.5', async () => {
      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      fireEvent.change(priceInput, { target: { value: '12.5' } });
      fireEvent.blur(priceInput);

      expect(screen.getByText(INVALID_PRICE_MESSAGE)).toBeDefined();
    });

    it('shows error message on blur when entering > 100000', async () => {
      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      fireEvent.change(priceInput, { target: { value: '100001' } });
      fireEvent.blur(priceInput);

      expect(screen.getByText(INVALID_PRICE_MESSAGE)).toBeDefined();
    });
  });

  describe('Form Submission & API Integration', () => {
    it('successfully submits 117 to the server as a number and shows success toast', async () => {
      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      fireEvent.change(priceInput, { target: { value: '117' } });

      const saveButton = screen.getByTestId('save-mentor-profile-btn');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mentorMarketplaceApi.updateProfile).toHaveBeenCalled();
      });

      const callArgs = mentorMarketplaceApi.updateProfile.mock.calls[0];
      expect(callArgs[0].sessionPrice).toBe(117);
      expect(callArgs[2]).toBe('mentor-1');

      await waitFor(() => {
        const toast = screen.getByTestId('toast');
        expect(toast.textContent).toContain('Mentor profile saved');
      });
    });

    it('handles backend 400 INVALID_PRICE error and displays it on the field', async () => {
      const err = new Error(INVALID_PRICE_MESSAGE);
      err.code = 'INVALID_PRICE';
      err.serverMessage = INVALID_PRICE_MESSAGE;
      err.data = { code: 'INVALID_PRICE', message: INVALID_PRICE_MESSAGE };
      mentorMarketplaceApi.updateProfile.mockRejectedValueOnce(err);

      renderComponent();

      const priceInput = await screen.findByLabelText(/Price \(INR\)/i);
      fireEvent.change(priceInput, { target: { value: '117' } });

      const saveButton = screen.getByTestId('save-mentor-profile-btn');
      fireEvent.click(saveButton);

      await waitFor(() => {
        const matches = screen.getAllByText(INVALID_PRICE_MESSAGE);
        expect(matches.length).toBeGreaterThanOrEqual(1);
      });

      const toast = screen.getByTestId('toast');
      expect(toast.textContent).toContain(INVALID_PRICE_MESSAGE);
    });
  });
});
