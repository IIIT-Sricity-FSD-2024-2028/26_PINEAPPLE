import { buildSuspendedResponse } from '../common/utils/suspended-response.util';

describe('Step 3 Unit Tests: buildSuspendedResponse', () => {
  it('1. contains ONLY the allowed fields and strictly excludes moderator names, internal notes, passwords, and other user data', () => {
    const dirtyUser = {
      id: 'user-susp-1',
      name: 'Secret User',
      email: 'secret@example.com',
      password: 'HashedPassword123',
      moderator: 'Admin John Doe',
      moderatorName: 'Admin John Doe',
      internalNotes: 'Internal confidential moderation discussion',
      reportDetails: { reporterId: 'user-99', content: 'Offensive comment' },
      status: 'Suspended',
      suspensionReason: 'Violating community guidelines regarding conduct',
      suspendedAt: '2026-11-20T14:30:00.000Z',
    };

    const response = buildSuspendedResponse(dirtyUser);

    // Verify exact expected keys
    const allowedKeys = [
      'statusCode',
      'error',
      'code',
      'message',
      'reason',
      'suspendedAt',
      'suspensionType',
      'appealAvailable',
      'supportContact',
    ];

    expect(Object.keys(response).sort()).toEqual(allowedKeys.sort());

    // Verify values
    expect(response.statusCode).toBe(403);
    expect(response.error).toBe('Forbidden');
    expect(response.code).toBe('ACCOUNT_SUSPENDED');
    expect(response.message).toBe('Your account is suspended.');
    expect(response.reason).toBe('Violating community guidelines regarding conduct');
    expect(response.suspendedAt).toBe('2026-11-20T14:30:00.000Z');
    expect(response.suspensionType).toBe('manual');
    expect(response.appealAvailable).toBe(false);
    expect(response.supportContact).toBe('support@teamforge.io');

    // Strictly ensure no leak of private fields
    expect((response as any).moderator).toBeUndefined();
    expect((response as any).moderatorName).toBeUndefined();
    expect((response as any).internalNotes).toBeUndefined();
    expect((response as any).reportDetails).toBeUndefined();
    expect((response as any).password).toBeUndefined();
    expect((response as any).email).toBeUndefined();
    expect((response as any).name).toBeUndefined();
    expect((response as any).token).toBeUndefined();
  });

  it('2. handles automatic suspension correctly with type "automatic" and canonical automatic text', () => {
    const autoUser = {
      id: 'user-auto-1',
      status: 'Suspended',
      suspensionReason: 'Automatic suspension after 4 warnings',
      suspendedAt: '2026-11-21T08:00:00.000Z',
    };

    const response = buildSuspendedResponse(autoUser);

    expect(response.suspensionType).toBe('automatic');
    expect(response.reason).toBe('Automatic suspension after 4 warnings');
  });

  it('3. falls back to default reason if suspensionReason is empty or missing', () => {
    const emptyReasonUser = {
      id: 'user-empty-1',
      status: 'Suspended',
    };

    const response = buildSuspendedResponse(emptyReasonUser);

    expect(response.suspensionType).toBe('manual');
    expect(response.reason).toBe('Terms of service violation');
    expect(response.suspendedAt).toBeDefined();
    expect(response.supportContact).toBe('support@teamforge.io');
  });
});
