import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { UserRole } from './dto/create-user.dto';

describe('Username Validation & Normalization Unit Tests (Phase 5)', () => {
  let repository: UsersRepository;
  let service: UsersService;

  beforeEach(() => {
    repository = new UsersRepository();
    // Instantiate UsersService with repository
    service = new UsersService(
      repository,
      null as any, // moduleRef
      null as any, // gamificationRepo
      null as any, // firebaseService
      null as any, // auditService
      null as any, // notificationsService
    );
  });

  describe('Username Normalization & Case-Insensitivity', () => {
    it('normalizes username by trimming whitespace and converting to lowercase', () => {
      expect(service.normalizeUsername('  AdityaDev  ')).toBe('adityadev');
      expect(service.normalizeUsername('JOHN_DOE')).toBe('john_doe');
      expect(service.normalizeUsername('')).toBe('');
      expect(service.normalizeUsername(undefined)).toBe('');
    });

    it('checks username availability case-insensitively', () => {
      // Seed user Priya Patel has username 'priyapatel'
      expect(service.isUsernameAvailable('priyapatel')).toBe(false);
      expect(service.isUsernameAvailable('PriyaPatel')).toBe(false);
      expect(service.isUsernameAvailable('PRIYAPATEL')).toBe(false);
      expect(service.isUsernameAvailable('  priyapatel  ')).toBe(false);

      // Unique username is available
      expect(service.isUsernameAvailable('unique_dev_2026')).toBe(true);
    });

    it('allows current user to keep their own username when checking availability with excludeUserId', () => {
      // User '1' is Priya Patel
      expect(service.isUsernameAvailable('priyapatel', '1')).toBe(true);
      expect(service.isUsernameAvailable('PriyaPatel', '1')).toBe(true);
      // Another user cannot claim it
      expect(service.isUsernameAvailable('priyapatel', '2')).toBe(false);
    });
  });

  describe('Allowed Characters & Format Validation', () => {
    it('rejects usernames shorter than 3 characters or longer than 30 characters on signup', () => {
      expect(() => {
        service.create({
          name: 'Short',
          email: 'short@example.com',
          username: 'ab',
          role: UserRole.Collaborator,
        });
      }).toThrow(BadRequestException);

      const longUsername = 'a'.repeat(31);
      expect(() => {
        service.create({
          name: 'Long',
          email: 'long@example.com',
          username: longUsername,
          role: UserRole.Collaborator,
        });
      }).toThrow(BadRequestException);
    });

    it('rejects invalid characters (spaces, @, !, $, etc.)', () => {
      const invalidUsernames = [
        'user name',
        'user@domain',
        'user!alert',
        'dev#1',
        'test$user',
        'hello.world',
      ];

      for (const invalid of invalidUsernames) {
        expect(() => {
          service.create({
            name: 'Invalid User',
            email: `invalid_${Date.now()}@example.com`,
            username: invalid,
            role: UserRole.Collaborator,
          });
        }).toThrow(BadRequestException);
      }
    });

    it('accepts valid usernames with alphanumeric, underscores, and hyphens', () => {
      const valid = service.create({
        name: 'Valid User',
        email: 'valid.user@example.com',
        username: 'valid-user_99',
        role: UserRole.Collaborator,
      });

      expect(valid).toBeDefined();
      expect(valid.username).toBe('valid-user_99');
    });
  });

  describe('Missing or Empty Username Handling', () => {
    it('throws 400 USERNAME_REQUIRED if username is omitted or blank', () => {
      try {
        service.create({
          name: 'No Username',
          email: 'no.username@example.com',
          username: '',
          role: UserRole.Collaborator,
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.code || err.code).toBe('USERNAME_REQUIRED');
      }

      try {
        service.create({
          name: 'Whitespace Username',
          email: 'ws.username@example.com',
          username: '   ',
          role: UserRole.Collaborator,
        });
        fail('Should have thrown BadRequestException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        const res = err.getResponse();
        expect(res.code || err.code).toBe('USERNAME_REQUIRED');
      }
    });

    it('throws 409 USERNAME_TAKEN if username is already taken', () => {
      try {
        service.create({
          name: 'Duplicate Priya',
          email: 'dup.priya@example.com',
          username: 'priyapatel',
          role: UserRole.Collaborator,
        });
        fail('Should have thrown ConflictException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ConflictException);
        const res = err.getResponse();
        expect(res.code || err.code).toBe('USERNAME_TAKEN');
      }
    });
  });

  describe('Email-Prefix Auto-Generated Flag Detection', () => {
    it('flags usernameAutoGenerated = true when username equals email prefix', () => {
      const user = service.create({
        name: 'Auto Matched',
        email: 'myhandle@example.com',
        username: 'myhandle',
        role: UserRole.Collaborator,
      });

      expect(user.usernameAutoGenerated).toBe(true);
      const raw = service.findRawUserById(user.id);
      expect(raw?.usernameAutoGenerated).toBe(true);
    });

    it('does NOT flag usernameAutoGenerated when username differs from email prefix', () => {
      const user = service.create({
        name: 'Different Handle',
        email: 'alice.smith@example.com',
        username: 'wonderland99',
        role: UserRole.Collaborator,
      });

      expect(user.usernameAutoGenerated).toBe(false);
      const raw = service.findRawUserById(user.id);
      expect(raw?.usernameAutoGenerated).toBe(false);
    });

    it('flags seeded u-collab whose username matches email prefix aditya@example.com', () => {
      const collab = service.findRawUserById('u-collab');
      expect(collab).toBeDefined();
      expect(collab?.username).toBe('aditya');
      expect(collab?.email).toBe('aditya@example.com');
      expect(collab?.usernameAutoGenerated).toBe(true);
    });
  });

  describe('Confirm or Change Username via Service', () => {
    it('clears usernameAutoGenerated when confirm is true', () => {
      const res = service.confirmOrChangeUsername('u-collab', { confirm: true });
      expect(res.needsUsernameConfirmation).toBe(false);
      expect(res.username).toBe('aditya');

      const raw = service.findRawUserById('u-collab');
      expect(raw?.usernameAutoGenerated).toBe(false);
    });

    it('rejects changing an existing non-autogenerated username with 400 USERNAME_IMMUTABLE', () => {
      expect(() => {
        service.confirmOrChangeUsername('1', { username: 'priya_new' });
      }).toThrow(BadRequestException);
    });
  });
});
