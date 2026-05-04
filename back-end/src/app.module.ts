import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { CoreModule } from './core/core.module';
import { RolesGuard } from './core/guards/roles.guard';
import { UsersModule } from './users/users.module';
import { GamificationModule } from './gamification/gamification.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    CoreModule,
    UsersModule,
    GamificationModule,
    ProjectsModule,
    TasksModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
