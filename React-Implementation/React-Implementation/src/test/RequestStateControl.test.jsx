import { describe, it, expect } from 'vitest';
import { getRequestControlConfig } from '../utils/requestState';

describe('Phase 3 - Request State Control Helper (getRequestControlConfig)', () => {
  it('handles "none" state: collaborator can apply with standard Apply button', () => {
    const config = getRequestControlConfig({ state: 'none', requestsLeft: 2, requestsUsed: 0 });
    expect(config.label).toBe('Apply');
    expect(config.disabled).toBe(false);
    expect(config.canApply).toBe(true);
    expect(config.hint).toBeNull();
  });

  it('handles null/undefined status: defaults to "none" state', () => {
    const config = getRequestControlConfig(null);
    expect(config.label).toBe('Apply');
    expect(config.disabled).toBe(false);
    expect(config.canApply).toBe(true);
  });

  it('handles "pending" state: disables button with "Request pending"', () => {
    const config = getRequestControlConfig({ state: 'pending', requestsLeft: 1, requestsUsed: 1 });
    expect(config.label).toBe('Request pending');
    expect(config.disabled).toBe(true);
    expect(config.canApply).toBe(false);
  });

  it('handles "rejected_can_retry" (1st rejection): keeps Apply available with "1 request left" hint', () => {
    const config = getRequestControlConfig({
      state: 'rejected_can_retry',
      requestsLeft: 1,
      requestsUsed: 1,
      lastReason: 'Please demonstrate more experience in React and state management.',
    });
    expect(config.label).toBe('Apply');
    expect(config.disabled).toBe(false);
    expect(config.canApply).toBe(true);
    expect(config.hint).toBe('1 request left');
    expect(config.reason).toBe('Please demonstrate more experience in React and state management.');
  });

  it('handles "rejected_final" (2nd rejection): replaces Apply with disabled "Request rejected" tag', () => {
    const config = getRequestControlConfig({
      state: 'rejected_final',
      requestsLeft: 0,
      requestsUsed: 2,
      lastReason: 'Team is pursuing different technical stack.',
    });
    expect(config.label).toBe('Request rejected');
    expect(config.disabled).toBe(true);
    expect(config.canApply).toBe(false);
    expect(config.hint).toBe('No requests left');
    expect(config.variant).toBe('danger');
    expect(config.reason).toBe('Team is pursuing different technical stack.');
  });

  it('handles "member" state: disables button with "Member"', () => {
    const config = getRequestControlConfig({ state: 'member' });
    expect(config.label).toBe('Member');
    expect(config.disabled).toBe(true);
    expect(config.canApply).toBe(false);
  });

  it('handles "banned" state: disables button with "Removed" tag and reason hint', () => {
    const config = getRequestControlConfig({
      state: 'banned',
      lastReason: 'Violation of project code of conduct',
    });
    expect(config.label).toBe('Removed');
    expect(config.disabled).toBe(true);
    expect(config.canApply).toBe(false);
    expect(config.hint).toContain('Violation of project code of conduct');
  });

  it('handles "full" state: disables button with "Project full"', () => {
    const config = getRequestControlConfig({ state: 'full' });
    expect(config.label).toBe('Project full');
    expect(config.disabled).toBe(true);
    expect(config.canApply).toBe(false);
  });

  it('handles "closed" state: disables button with "Closed"', () => {
    const config = getRequestControlConfig({
      state: 'closed',
      lastReason: 'No applicants within 5 days',
    });
    expect(config.label).toBe('Closed');
    expect(config.disabled).toBe(true);
    expect(config.canApply).toBe(false);
    expect(config.reason).toBe('No applicants within 5 days');
  });
});
