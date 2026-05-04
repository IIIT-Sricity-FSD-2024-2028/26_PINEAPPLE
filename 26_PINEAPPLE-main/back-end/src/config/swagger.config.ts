import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Swagger Configuration for TeamForge API
 * Defines the OpenAPI/Swagger document metadata and tags.
 */
export function getSwaggerConfig(): DocumentBuilder {
  return new DocumentBuilder()
    .setTitle('TeamForge API')
    .setDescription(
      'TeamForge NestJS Backend: In-memory CRUD operations with Role-Based Access Control (RBAC). ' +
        'All endpoints require the `x-user-role` header for authorization.',
    )
    .setVersion('1.0.0')
    .setContact('TeamForge Support', 'https://teamforge.io', 'support@teamforge.io')
    .addServer('http://localhost:3000', 'Development')
    .addTag('Health', 'Server health checks')
    .addTag('Users', 'User management and profiles')
    .addTag('Projects', 'Project creation and management')
    .addTag('Tasks', 'Task assignments and submissions')
    .addTag('Join Requests', 'Project join requests')
    .addTag('Notifications', 'User notifications')
    .addTag('Leaderboard', 'Ranking and leaderboards')
    .addTag('Mentor Applications', 'Mentor application workflow')
    .addTag('Mentor Requests', 'Project mentor requests')
    .addTag('Support', 'Support requests')
    .addTag('Admin', 'Administrative operations')
    .addTag('Portal Admins', 'Superuser admin management');
}
