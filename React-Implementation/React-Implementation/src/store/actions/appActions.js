import { createAction } from '@reduxjs/toolkit';

export const routeChanged = createAction('app/routeChanged');
export const resetRouteGroup = createAction('app/resetRouteGroup');
export const sessionReset = createAction('app/sessionReset');
