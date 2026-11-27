import { createListenerMiddleware } from '@reduxjs/toolkit';
import { routeChanged, resetRouteGroup } from '../actions/appActions';
import { RESET_SCOPE, getPathGroup } from '../utils/routeReset';

export const getRouteGroup = getPathGroup;

export function createRouteResetListener(scope = RESET_SCOPE) {
  const listenerMiddleware = createListenerMiddleware();

  listenerMiddleware.startListening({
    actionCreator: routeChanged,
    effect: (action, listenerApi) => {
      const effectiveScope = action.payload?.scope ?? scope;
      if (effectiveScope !== 'group' && effectiveScope !== 'reading_a') {
        return;
      }
      const fromGroup =
        action.payload?.fromGroup ?? getPathGroup(action.payload?.from);
      const toGroup =
        action.payload?.group ??
        action.payload?.toGroup ??
        getPathGroup(action.payload?.to);
      if (fromGroup && toGroup && fromGroup !== toGroup) {
        listenerApi.dispatch(
          resetRouteGroup({
            leftGroup: fromGroup,
            enteredGroup: toGroup,
            from: action.payload?.from,
            to: action.payload?.to,
          }),
        );
      }
    },
  });

  return listenerMiddleware;
}

export const routeResetListener = createRouteResetListener();
