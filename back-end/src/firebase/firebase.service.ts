import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { initializeApp, getApps, App, cert } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app: App | null = null;
  private initialized = false;

  async onModuleInit() {
    this.initializeFirebase();
    await this.seedDefaultAdminAccounts().catch((err) => {
      this.logger.warn(`Firebase admin auto-seed skipped: ${err?.message}`);
    });
  }

  private initializeFirebase() {
    if (this.initialized) return;

    const projectId = process.env.FIREBASE_PROJECT_ID || 'team-forge-auth';
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;

    if (emulatorHost) {
      process.env.FIREBASE_AUTH_EMULATOR_HOST = emulatorHost;
      this.logger.log(`Initializing Firebase Admin SDK in EMULATOR mode (host: ${emulatorHost}, project: ${projectId})`);

      const apps = getApps();
      if (apps.length > 0) {
        this.app = apps[0];
      } else {
        this.app = initializeApp({
          projectId,
        });
      }
      this.initialized = true;
      return;
    }

    // Real Firebase mode - search candidate paths
    const candidatePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'back-end/serviceAccountKey.json'),
      typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../serviceAccountKey.json') : null,
    ].filter(Boolean) as string[];

    for (const rawPath of candidatePaths) {
      const resolvedPath = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(process.cwd(), rawPath);

      if (fs.existsSync(resolvedPath)) {
        try {
          const serviceAccount = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
          this.logger.log(`Initializing Firebase Admin with service account from ${resolvedPath}`);
          const apps = getApps();
          if (apps.length > 0) {
            this.app = apps[0];
          } else {
            this.app = initializeApp({
              credential: cert(serviceAccount),
              projectId: serviceAccount.project_id || projectId,
            });
          }
          this.initialized = true;
          return;
        } catch (err: any) {
          this.logger.error(`Failed to parse Firebase service account at ${resolvedPath}: ${err.message}`);
        }
      }
    }

    // Fallback if credentials not found
    const apps = getApps();
    if (apps.length > 0) {
      this.app = apps[0];
      this.initialized = true;
    } else {
      this.logger.warn('No Firebase service account found. Initializing with project id.');
      try {
        this.app = initializeApp({ projectId });
        this.initialized = true;
      } catch (err: any) {
        this.logger.error(`Firebase initialization fallback failed: ${err.message}`);
      }
    }
  }

  get auth(): Auth {
    if (!this.initialized) {
      this.initializeFirebase();
    }
    return this.app ? getAuth(this.app) : getAuth();
  }


  async seedDefaultAdminAccounts() {
    if (!this.initialized || !this.app) return;
    const accounts = [
      {
        uid: 'u-superuser',
        email: 'superuser@teamforge.io',
        password: 'Super@123',
        displayName: 'Super User',
        role: 'superuser',
        permissions: ['*'],
      },
      {
        uid: 'u-admin',
        email: 'admin@teamforge.io',
        password: 'admin123',
        displayName: 'Admin User',
        role: 'admin',
        permissions: ['*'],
      },
    ];

    for (const acc of accounts) {
      try {
        let user: any;
        try {
          user = await this.auth.getUserByEmail(acc.email);
        } catch (e: any) {
          if (e.code === 'auth/user-not-found') {
            user = await this.auth.createUser({
              uid: acc.uid,
              email: acc.email,
              password: acc.password,
              displayName: acc.displayName,
            });
            this.logger.log(`Created Firebase admin account for ${acc.email}`);
          } else {
            throw e;
          }
        }
        await this.auth.setCustomUserClaims(user.uid, {
          name: acc.displayName,
          role: acc.role,
          portalRole: acc.role,
          permissions: acc.permissions,
        });
      } catch (err: any) {
        this.logger.warn(`Could not sync Firebase admin account ${acc.email}: ${err.message}`);
      }
    }
  }

  isEmulator(): boolean {
    return Boolean(process.env.FIREBASE_AUTH_EMULATOR_HOST);
  }

  isConfigured(): boolean {
    if (this.isEmulator()) {
      return true;
    }
    const candidatePaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
      path.resolve(process.cwd(), 'serviceAccountKey.json'),
      path.resolve(process.cwd(), 'back-end/serviceAccountKey.json'),
      typeof __dirname !== 'undefined' ? path.resolve(__dirname, '../../serviceAccountKey.json') : null,
    ].filter(Boolean) as string[];

    for (const rawPath of candidatePaths) {
      const resolvedPath = path.isAbsolute(rawPath) ? rawPath : path.resolve(process.cwd(), rawPath);
      if (fs.existsSync(resolvedPath)) {
        return true;
      }
    }
    return false;
  }

  isInitialized(): boolean {
    return this.initialized && Boolean(this.app);
  }

  async verifyIdToken(token: string, checkRevoked = false) {
    return this.auth.verifyIdToken(token, checkRevoked);
  }

  async setCustomClaims(uid: string, claims: Record<string, any>) {
    return this.auth.setCustomUserClaims(uid, claims);
  }

  async revokeRefreshTokens(uid: string) {
    return this.auth.revokeRefreshTokens(uid);
  }

  async getUser(uid: string) {
    return this.auth.getUser(uid);
  }

  async getUserByEmail(email: string) {
    return this.auth.getUserByEmail(email);
  }

  async createUser(properties: { email: string; password?: string; displayName?: string; uid?: string }) {
    return this.auth.createUser(properties);
  }

  async updateUser(uid: string, properties: { disabled?: boolean; displayName?: string; email?: string }) {
    return this.auth.updateUser(uid, properties);
  }

  async deleteUser(uid: string) {
    return this.auth.deleteUser(uid);
  }
}
