import { routeChanged } from '../actions/appActions';

/**
 * Single route-leave reset switch (Decision D3, Requirement 5 = Reading B):
 * - 'page'  (default): clear slice working state on every location.pathname change.
 * - 'group': clear slice working state only when the first path segment (group) changes.
 */
export const RESET_SCOPE = 'page';

/**
 * Extracts the first URL path segment (lowercase), e.g.:
 *   '/admin/users'       -> 'admin'
 *   '/owner/workspace/1' -> 'owner'
 *   '/dashboard'         -> 'dashboard'
 *   '/'                  -> 'root'
 */
export function getPathGroup(pathname = '/') {
  const clean = String(pathname || '/').split('?')[0].split('#')[0].replace(/^\/+/, '');
  return clean.split('/')[0].toLowerCase() || 'root';
}

/**
 * Registers a slice's working-state reset handler against the shared app/routeChanged
 * action in one line inside extraReducers(builder).
 *
 * When RESET_SCOPE === 'group' (or payload.scope === 'group'), skips resetting when
 * the navigation stays within the same first-segment route group.
 */
export function addRouteReset(builder, resetFn, scopeOverride) {
  builder.addCase(routeChanged, (state, action) => {
    const activeScope = scopeOverride ?? action.payload?.scope ?? RESET_SCOPE;
    if (activeScope === 'group') {
      const fromGroup = action.payload?.fromGroup ?? getPathGroup(action.payload?.from);
      const toGroup =
        action.payload?.group ??
        action.payload?.toGroup ??
        getPathGroup(action.payload?.to);
      if (fromGroup === toGroup) {
        return state;
      }
    }
    return resetFn(state, action);
  });
}
