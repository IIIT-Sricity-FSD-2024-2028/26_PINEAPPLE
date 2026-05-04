import { SetMetadata } from '@nestjs/common';

/**
 * Roles Key - Used by RolesGuard to identify required roles
 */
export const ROLES_KEY = 'roles';

/**
 * Roles Decorator - Specifies required roles for an endpoint
 *
 * Works in conjunction with RolesGuard to enforce RBAC.
 * The guard will check the `x-user-role` header and compare it
 * against the roles specified in this decorator.
 *
 * @param roles - One or more role strings (case-insensitive)
 *
 * @example
 *  @UseGuards(RolesGuard)
 *  @Roles('admin', 'mentor')
 *  @Get('/admin-endpoint')
 *  adminEndpoint() { ... }
 *
 * Valid role values:
 * - 'admin'
 * - 'mentor'
 * - 'project-owner'
 * - 'collaborator'
 * - 'superuser'
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
