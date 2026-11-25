import 'reflect-metadata';
import { INestApplication, RequestMethod } from '@nestjs/common';
import { APP_GUARD, DiscoveryService, MetadataScanner, ModulesContainer, Reflector } from '@nestjs/core';
import { GUARDS_METADATA, METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { IS_PUBLIC_KEY } from '../../auth/decorators/public.decorator';
import { ROLES_KEY } from '../../core/decorators/roles.decorator';
import { normalizeRole } from '../../core/guards/roles.guard';

export type RouteAccessLevel =
  | 'public'
  | 'authenticated'
  | 'roles'
  | 'permission'
  | 'owner-or-member'
  | 'system';

export interface RouteAuthMatrixEntry {
  method: string;
  path: string;
  access: RouteAccessLevel;
  guards: string[];
  roles?: string[];
  permission?: string;
  controller: string;
  handler: string;
  hasExplicitGuardOrRole: boolean;
}

export interface RouteAuthMatrixDocument {
  version: number;
  publicAllowList: string[];
  routes: RouteAuthMatrixEntry[];
}

export const PUBLIC_ROUTE_ALLOWLIST: string[] = [
  'GET /admin/config/public',
  'POST /admin/login',
  'POST /auth/forgot-password',
  'POST /auth/login',
  'POST /auth/refresh',
  'POST /auth/reset-password',
  'GET /auth/resolve-identifier',
  'POST /auth/signup',
  'POST /auth/verify-email',
  'POST /support/tickets',
  'GET /health',
  'GET /mail/health',
  'GET /uploads/:filename',
  'GET /users/:id/response-time',
  'GET /users/username-available',
].sort();

const REQUEST_METHOD_NAMES: Record<number, string> = {
  [RequestMethod.GET]: 'GET',
  [RequestMethod.POST]: 'POST',
  [RequestMethod.PUT]: 'PUT',
  [RequestMethod.DELETE]: 'DELETE',
  [RequestMethod.PATCH]: 'PATCH',
  [RequestMethod.ALL]: 'ALL',
  [RequestMethod.OPTIONS]: 'OPTIONS',
  [RequestMethod.HEAD]: 'HEAD',
};

function toPathList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((p) => String(p ?? ''));
  }
  if (typeof raw === 'string') {
    return [raw];
  }
  return [''];
}

function normalizeRoutePath(basePath: string, subPath: string): string {
  const joined = [basePath, subPath]
    .map((part) => String(part || '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(Boolean)
    .join('/');
  return joined ? `/${joined}` : '/';
}

function extractGuardNames(target: any): string[] {
  if (!target) return [];
  const rawGuards = Reflect.getMetadata(GUARDS_METADATA, target);
  if (!Array.isArray(rawGuards)) return [];
  return rawGuards
    .map((guard: any) => {
      if (typeof guard === 'function') return guard.name || 'AnonymousGuard';
      if (guard && typeof guard === 'object' && guard.constructor) {
        return guard.constructor.name || 'AnonymousGuard';
      }
      return String(guard || 'AnonymousGuard');
    })
    .filter(Boolean);
}

/**
 * Mirrors RolesGuard admin section-permission resolution so the matrix
 * reflects actual backend section enforcement accurately.
 */
export function resolveAdminSectionPermission(path: string): string | undefined {
  const cleanPath = String(path || '').split('?')[0].replace(/\/+$/, '') || '/';
  if (
    cleanPath.startsWith('/admin/users') ||
    cleanPath.startsWith('/admin/moderation-actions') ||
    cleanPath === '/users'
  ) {
    return 'users';
  }
  if (cleanPath.startsWith('/admin/projects')) return 'projects';
  if (
    cleanPath.startsWith('/admin/mentor') ||
    cleanPath.startsWith('/admin/abandonment-reviews') ||
    cleanPath.startsWith('/mentor-applications') ||
    cleanPath.startsWith('/uploads/cv')
  ) {
    return 'mentor_apps';
  }
  if (
    cleanPath.startsWith('/admin/revenue') ||
    cleanPath === '/mentor-marketplace/sessions' ||
    cleanPath.startsWith('/mentor-marketplace/sessions/admin-stats') ||
    cleanPath.startsWith('/escrow')
  ) {
    return 'revenue';
  }
  if (cleanPath.startsWith('/admin/audit')) return 'audit';
  if (cleanPath.startsWith('/admin/stats') || cleanPath === '/admin') return 'dashboard';
  if (cleanPath.startsWith('/admin/su-admins') || cleanPath.startsWith('/portal-admins')) {
    return 'manage_admins';
  }
  if (cleanPath.startsWith('/admin/su-config') || cleanPath.startsWith('/admin/config')) {
    return 'config';
  }
  if (cleanPath.startsWith('/admin/support')) {
    return 'support';
  }
  if (
    cleanPath.startsWith('/admin/reports') ||
    cleanPath.startsWith('/admin/appeals') ||
    cleanPath.startsWith('/admin/disputes')
  ) {
    return 'reports';
  }
  return undefined;
}

function getGlobalGuardNames(app: INestApplication): string[] {
  const names: string[] = [];
  try {
    const appConfig = (app as any).config;
    if (appConfig && typeof appConfig.getGlobalGuards === 'function') {
      for (const guard of appConfig.getGlobalGuards()) {
        const name = guard?.constructor?.name || guard?.name;
        if (name && !names.includes(name)) names.push(name);
      }
    }
    if (appConfig && typeof appConfig.getGlobalRequestGuards === 'function') {
      for (const wrapper of appConfig.getGlobalRequestGuards()) {
        const name = wrapper?.instance?.constructor?.name || wrapper?.metatype?.name;
        if (name && !names.includes(name)) names.push(name);
      }
    }
  } catch {
    // Minimal test modules may not expose ApplicationConfig
  }
  if (names.length > 0) return names;

  try {
    const container = app.get(ModulesContainer, { strict: false });
    if (container) {
      for (const [, moduleRef] of container.entries()) {
        for (const [, wrapper] of moduleRef.providers.entries()) {
          const isAppGuard =
            wrapper.token === APP_GUARD ||
            (typeof wrapper.name === 'string' && wrapper.name.startsWith('APP_GUARD'));
          if (!isAppGuard) continue;
          const guardName =
            wrapper.instance?.constructor?.name ||
            wrapper.metatype?.name ||
            'GlobalGuard';
          if (!names.includes(guardName)) {
            names.push(guardName);
          }
        }
      }
    }
  } catch {
    // Minimal test modules may not expose ModulesContainer providers
  }
  return names;
}

function classifyRouteAccess(params: {
  method: string;
  path: string;
  isPublic: boolean;
  roles: string[];
  permission?: string;
  routeGuards: string[];
  allGuards: string[];
}): { access: RouteAccessLevel; permission?: string } {
  const { method, path, isPublic, roles, permission, routeGuards } = params;
  if (isPublic) {
    return { access: 'public' };
  }

  const normalizedRoles = roles.map((r) => normalizeRole(r)).filter(Boolean);
  const hasOnlyAdminRoles =
    normalizedRoles.length > 0 &&
    normalizedRoles.every((r) => r === 'admin' || r === 'superuser' || r === 'portal_admin');
  const hasSuperuserOnly =
    normalizedRoles.length === 1 && normalizedRoles[0] === 'superuser';

  if (
    hasSuperuserOnly ||
    path.startsWith('/admin/system') ||
    path.startsWith('/admin/su-') ||
    path === '/admin/jobs/tick' ||
    (path === '/users' && method === 'POST') ||
    (permission === 'manage_admins' && hasOnlyAdminRoles) ||
    (permission === 'config' && hasOnlyAdminRoles)
  ) {
    return { access: 'system', ...(permission ? { permission } : {}) };
  }

  if (permission && (hasOnlyAdminRoles || path.startsWith('/admin/'))) {
    return { access: 'permission', permission };
  }

  if (
    routeGuards.includes('SelfAccountUpdateGuard') ||
    path.startsWith('/users/me') ||
    path.startsWith('/notifications') ||
    path.startsWith('/tasks') ||
    path.startsWith('/projects/:id/task-templates') ||
    path.startsWith('/invites') ||
    path.startsWith('/uploads/cv') ||
    path === '/reports' ||
    path === '/reports/mine' ||
    path === '/warnings/:id/appeal' ||
    path === '/mentor-applications/me' ||
    (path === '/mentor-applications' && method === 'GET') ||
    (path === '/mentor-applications/:id' && method === 'GET') ||
    (path === '/mentor-applications/:id/cv' && method === 'DELETE')
  ) {
    return { access: 'owner-or-member', ...(permission ? { permission } : {}) };
  }

  if (normalizedRoles.length > 0) {
    return { access: 'roles', ...(permission ? { permission } : {}) };
  }

  return { access: 'authenticated', ...(permission ? { permission } : {}) };
}

/**
 * Extracts a stably sorted Route Authorization Matrix from a running Nest application
 * using DiscoveryService, MetadataScanner, and Reflector.
 */
export function buildRouteAuthMatrixFromApp(app: INestApplication): RouteAuthMatrixEntry[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const reflector = app.get(Reflector);

  const globalGuards = getGlobalGuardNames(app);
  const controllers = discovery.getControllers();
  const entries: RouteAuthMatrixEntry[] = [];
  const seen = new Set<string>();

  for (const wrapper of controllers) {
    const controllerClass = wrapper.metatype;
    const instance = wrapper.instance;
    if (!controllerClass || !instance) continue;

    const prototype = Object.getPrototypeOf(instance);
    const controllerPaths = toPathList(Reflect.getMetadata(PATH_METADATA, controllerClass));
    const classGuards = extractGuardNames(controllerClass);
    const controllerName = controllerClass.name;
    const methodNames = scanner.getAllMethodNames(prototype);

    for (const methodName of methodNames) {
      const handler = prototype[methodName];
      if (typeof handler !== 'function') continue;

      const methodCode = Reflect.getMetadata(METHOD_METADATA, handler);
      const handlerPathMeta = Reflect.getMetadata(PATH_METADATA, handler);
      if (methodCode === undefined || handlerPathMeta === undefined) continue;

      const httpMethod = REQUEST_METHOD_NAMES[methodCode] || String(methodCode);
      const handlerPaths = toPathList(handlerPathMeta);
      const isPublic = Boolean(
        reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler, controllerClass]),
      );
      const rawRoles =
        reflector.getAllAndOverride<string[]>(ROLES_KEY, [handler, controllerClass]) || [];
      const normalizedRoles = Array.from(
        new Set(rawRoles.map((r) => normalizeRole(r)).filter(Boolean)),
      ).sort();

      const methodGuards = extractGuardNames(handler);
      const routeGuards = Array.from(new Set([...classGuards, ...methodGuards]));
      const allGuards = isPublic
        ? Array.from(new Set([...routeGuards]))
        : Array.from(new Set([...globalGuards, ...routeGuards]));

      for (const basePath of controllerPaths) {
        for (const subPath of handlerPaths) {
          const fullPath = normalizeRoutePath(basePath, subPath);
          const dedupeKey = `${httpMethod} ${fullPath}`;
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          const rawPermission = resolveAdminSectionPermission(fullPath);
          const classified = classifyRouteAccess({
            method: httpMethod,
            path: fullPath,
            isPublic,
            roles: normalizedRoles,
            permission: rawPermission,
            routeGuards,
            allGuards,
          });

          const entry: RouteAuthMatrixEntry = {
            method: httpMethod,
            path: fullPath,
            access: classified.access,
            guards: allGuards,
            ...(normalizedRoles.length > 0 ? { roles: normalizedRoles } : {}),
            ...(classified.permission ? { permission: classified.permission } : {}),
            controller: controllerName,
            handler: methodName,
            hasExplicitGuardOrRole: isPublic || routeGuards.length > 0 || normalizedRoles.length > 0,
          };
          entries.push(entry);
        }
      }
    }
  }

  return entries.sort((a, b) => {
    const pathCmp = a.path.localeCompare(b.path);
    if (pathCmp !== 0) return pathCmp;
    return a.method.localeCompare(b.method);
  });
}

export function buildRouteAuthMatrixDocument(app: INestApplication): RouteAuthMatrixDocument {
  return {
    version: 1,
    publicAllowList: [...PUBLIC_ROUTE_ALLOWLIST],
    routes: buildRouteAuthMatrixFromApp(app),
  };
}

export function validatePublicAllowList(
  routes: RouteAuthMatrixEntry[],
  allowList: string[] = PUBLIC_ROUTE_ALLOWLIST,
): { valid: boolean; unexpectedPublic: string[] } {
  const allowed = new Set(allowList);
  const unexpectedPublic = routes
    .filter((r) => r.access === 'public')
    .map((r) => `${r.method} ${r.path}`)
    .filter((key) => !allowed.has(key));

  return {
    valid: unexpectedPublic.length === 0,
    unexpectedPublic,
  };
}

export function findUnguardedRoutes(
  routes: RouteAuthMatrixEntry[],
  knownAuthenticatedAllowList: string[] = [],
): RouteAuthMatrixEntry[] {
  const allowedAuth = new Set(knownAuthenticatedAllowList);
  return routes.filter((r) => {
    if (r.access === 'public') return false;
    const key = `${r.method} ${r.path}`;
    if (r.guards.length === 0) return true;
    return !r.hasExplicitGuardOrRole && !allowedAuth.has(key);
  });
}
