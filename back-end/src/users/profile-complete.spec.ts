import { isProfileComplete } from '../common/utils/profile.util';

describe('Profile-Complete derivation unit tests', () => {
  it('returns true for a user with a valid username and profileComplete true/undefined', () => {
    expect(isProfileComplete({ username: 'adityasai' })).toBe(true);
    expect(isProfileComplete({ profile: { username: 'coder_42' } })).toBe(true);
    expect(isProfileComplete({ username: 'john', profileComplete: true })).toBe(true);
  });

  it('returns false when username is missing or empty', () => {
    expect(isProfileComplete({ username: '' })).toBe(false);
    expect(isProfileComplete({ username: '   ' })).toBe(false);
    expect(isProfileComplete({ name: 'No Handle' })).toBe(false);
    expect(isProfileComplete({ profile: { username: '' } })).toBe(false);
  });

  it('returns false when profileComplete flag is explicitly false', () => {
    expect(isProfileComplete({ username: 'valid_user', profileComplete: false })).toBe(false);
    expect(isProfileComplete({ profileComplete: false })).toBe(false);
  });

  it('returns false for null or undefined user', () => {
    expect(isProfileComplete(null)).toBe(false);
    expect(isProfileComplete(undefined)).toBe(false);
  });
});
