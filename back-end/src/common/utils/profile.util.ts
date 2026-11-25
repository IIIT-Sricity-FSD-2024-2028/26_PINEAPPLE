/**
 * Derives whether a user profile is complete:
 * - A profile is complete only when a valid, non-empty username exists and profileComplete !== false.
 * - Social login users who have not chosen a username evaluate to false.
 */
export function isProfileComplete(user: any): boolean {
  if (!user) {
    return false;
  }
  if (user.profileComplete === false) {
    return false;
  }
  const username = user.username !== undefined ? user.username : user.profile?.username;
  return Boolean(username && String(username).trim().length > 0);
}
