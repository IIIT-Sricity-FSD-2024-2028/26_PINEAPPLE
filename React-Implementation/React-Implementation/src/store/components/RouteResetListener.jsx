import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { routeChanged } from '../actions/appActions';
import { getPathGroup } from '../utils/routeReset';

/**
 * Mounted under the router root. Whenever location.pathname changes (ignoring
 * query-string updates like ?tab=chat), dispatches:
 *   routeChanged({ from, to, group, fromGroup, scope? })
 */
export function RouteResetListener({ resetScope } = {}) {
  const location = useLocation();
  const dispatch = useDispatch();
  const prevPathnameRef = useRef(location.pathname);

  useEffect(() => {
    const nextPathname = location.pathname;
    const prevPathname = prevPathnameRef.current;
    if (prevPathname !== nextPathname) {
      prevPathnameRef.current = nextPathname;
      const payload = {
        from: prevPathname,
        to: nextPathname,
        group: getPathGroup(nextPathname),
        fromGroup: getPathGroup(prevPathname),
      };
      if (resetScope) {
        payload.scope = resetScope;
      }
      dispatch(routeChanged(payload));
    }
  }, [location.pathname, dispatch, resetScope]);

  return null;
}

export default RouteResetListener;
