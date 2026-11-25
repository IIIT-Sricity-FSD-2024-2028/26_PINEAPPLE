import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { UsersService } from '../users/users.service';

@Injectable()
export class SeedingService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SeedingService.name);

  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly usersService: UsersService,
  ) {}

  async onApplicationBootstrap() {
    const authMode = (process.env.AUTH_MODE || 'jwt').trim().toLowerCase();
    if (authMode === 'firebase' && this.firebaseService.isEmulator()) {
      await this.seedFirebaseEmulatorIdentities();
    }
  }

  private async seedFirebaseEmulatorIdentities() {
    this.logger.log('🌱 Seeding demo identities into Firebase Auth Emulator...');
    const auth = this.firebaseService.auth;

    const demoUsers = [
      {
        uid: 'u-superuser',
        email: 'superuser@teamforge.io',
        password: 'Super@123',
        displayName: 'Super User',
        claims: { role: 'SuperUser', permissions: ['*'] },
      },
      {
        uid: 'u-admin',
        email: 'admin@teamforge.io',
        password: 'password123',
        displayName: 'Default Admin',
        claims: { role: 'Admin', permissions: ['*'] },
      },
      {
        uid: 'u-collab',
        email: 'aditya@example.com',
        password: 'password123',
        displayName: 'Aditya',
        claims: { role: 'Collaborator' },
      },
      {
        uid: 'u-owner',
        email: 'jathin@example.com',
        password: 'password123',
        displayName: 'Jathin',
        claims: { role: 'Project Owner' },
      },
      {
        uid: 'u-mentor',
        email: 'mentor@example.com',
        password: 'password123',
        displayName: 'Rohan Mehta',
        claims: { role: 'Mentor' },
      },
    ];

    for (const demo of demoUsers) {
      try {
        let userRecord: any;
        try {
          userRecord = await auth.getUser(demo.uid);
        } catch {
          userRecord = null;
        }

        if (!userRecord) {
          userRecord = await auth.createUser({
            uid: demo.uid,
            email: demo.email,
            password: demo.password,
            displayName: demo.displayName,
          });
          this.logger.log(`Created emulator account: ${demo.email} (${demo.uid})`);
        }

        await auth.setCustomUserClaims(demo.uid, demo.claims);

        // Ensure in-memory profile exists
        this.usersService.findOrCreateFromAuth(
          demo.uid,
          demo.email,
          demo.claims.role,
          demo.displayName,
        );
      } catch (err: any) {
        this.logger.warn(`Could not seed emulator user ${demo.email}: ${err.message}`);
      }
    }
    this.logger.log('✅ Firebase Auth Emulator seeding complete.');
  }
}
