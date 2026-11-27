import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AppModule } from '../app.module';
import { MailService } from '../mail/mail.service';
import { UploadsController } from './uploads.controller';
import { validateMagicBytesBuffer } from './file-validation.util';
import { UsersRepository } from '../users/users.repository';
import { StorageHygieneService, ORPHAN_UPLOAD_MAX_AGE_MS } from '../jobs/storage-hygiene.service';
import { serializeSafeUser } from '../users/user-serializer';
import { UserRole, UserStatus } from '../users/dto/create-user.dto';

describe('Avatar Persistence Unit Tests', () => {
  let appRef: any;
  let uploadsController: UploadsController;
  let usersRepo: UsersRepository;
  let storageHygieneService: StorageHygieneService;
  let tmpRoot: string;

  const VALID_PNG = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  ]);
  const VALID_JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const VALID_WEBP = Buffer.concat([
    Buffer.from('RIFF'),
    Buffer.from([0x10, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP'),
  ]);
  const SVG_BUF = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');

  beforeAll(async () => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-avatar-unit-'));
    const upDir = path.join(tmpRoot, 'uploads');
    const cvsDir = path.join(tmpRoot, 'secure-cvs');
    fs.mkdirSync(upDir, { recursive: true });
    fs.mkdirSync(cvsDir, { recursive: true });

    process.env.NODE_ENV = 'test';
    process.env.ALLOW_STORE_RESET = 'true';
    process.env.SCHEDULER_ENABLED = 'false';
    process.env.UPLOAD_DIR = upDir;
    process.env.UPLOADS_DIR = upDir;
    process.env.SECURE_CVS_DIR = cvsDir;

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue({
        sendMail: async () => ({ success: true, mode: 'console' }),
      })
      .compile();

    appRef = moduleRef.createNestApplication();
    await appRef.init();

    uploadsController = moduleRef.get(UploadsController);
    usersRepo = moduleRef.get(UsersRepository);
    storageHygieneService = moduleRef.get(StorageHygieneService);
  });

  afterAll(async () => {
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOADS_DIR;
    delete process.env.SECURE_CVS_DIR;
    if (appRef) await appRef.close();
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch {}
  });

  it('validates PNG, JPG, WEBP magic bytes and rejects SVG and fake images', () => {
    expect(validateMagicBytesBuffer(VALID_PNG, { originalName: 'a.png', mimetype: 'image/png', allowedKinds: ['png', 'jpeg', 'webp'] }).valid).toBe(true);
    expect(validateMagicBytesBuffer(VALID_JPG, { originalName: 'a.jpg', mimetype: 'image/jpeg', allowedKinds: ['png', 'jpeg', 'webp'] }).valid).toBe(true);
    expect(validateMagicBytesBuffer(VALID_WEBP, { originalName: 'a.webp', mimetype: 'image/webp', allowedKinds: ['png', 'jpeg', 'webp'] }).valid).toBe(true);

    expect(validateMagicBytesBuffer(SVG_BUF, { originalName: 'a.svg', mimetype: 'image/svg+xml', allowedKinds: ['png', 'jpeg', 'webp'] }).valid).toBe(false);
    expect(validateMagicBytesBuffer(SVG_BUF, { originalName: 'a.png', mimetype: 'image/png', allowedKinds: ['png', 'jpeg', 'webp'] }).valid).toBe(false);
    expect(validateMagicBytesBuffer(Buffer.from('not an image'), { originalName: 'a.png', mimetype: 'image/png', allowedKinds: ['png', 'jpeg', 'webp'] }).valid).toBe(false);
  });

  it('POST /uploads/avatar updates user.avatarUrl & profile.avatarUrl, returns updated user, and deletes previous avatar file', () => {
    const upDir = process.env.UPLOADS_DIR!;
    const user = usersRepo.create({
      name: 'Avatar Unit User',
      username: 'avatar_unit_user',
      email: 'avatar.unit@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);

    const oldName = 'old-avatar-unit.png';
    const oldPath = path.join(upDir, oldName);
    fs.writeFileSync(oldPath, VALID_PNG);
    usersRepo.update(user.id, {
      avatarUrl: `/uploads/${oldName}`,
      avatar: `/uploads/${oldName}`,
      profile: { avatarUrl: `/uploads/${oldName}`, avatar: `/uploads/${oldName}` } as any,
    });

    const newName = 'random-uuid-new.png';
    const newPath = path.join(upDir, newName);
    fs.writeFileSync(newPath, VALID_PNG);

    const fakeReq: any = {
      user: { uid: user.id, id: user.id, role: 'collaborator' },
      headers: {},
      path: '/uploads/avatar',
    };
    const fakeFile: any = {
      filename: newName,
      originalname: 'photo.png',
      mimetype: 'image/png',
      size: VALID_PNG.length,
      path: newPath,
    };

    const result = uploadsController.uploadAvatar(fakeFile, fakeReq) as any;

    expect(result.url).toBe(`/uploads/${newName}`);
    expect(result.avatarUrl).toBe(`/uploads/${newName}`);
    expect(result.user).toBeDefined();
    expect(result.user.avatarUrl).toBe(`/uploads/${newName}`);
    expect(result.user.profile?.avatarUrl).toBe(`/uploads/${newName}`);
    expect(fs.existsSync(oldPath)).toBe(false);
    expect(fs.existsSync(newPath)).toBe(true);

    const serialized = serializeSafeUser(usersRepo.findById(user.id));
    expect(serialized.avatarUrl).toBe(`/uploads/${newName}`);
    expect(serialized.profile?.avatarUrl).toBe(`/uploads/${newName}`);
  });

  it('StorageHygieneService retains referenced avatar files older than 24h while removing unreferenced old orphans', () => {
    const upDir = process.env.UPLOADS_DIR!;
    const user = usersRepo.create({
      name: 'Hygiene Keep User',
      username: 'hygiene_keep_user',
      email: 'hygiene.keep@test.local',
      password: 'Password@123',
      role: UserRole.Collaborator,
      status: UserStatus.Active,
    } as any);

    const keptFile = 'live-user-avatar.png';
    const keptPath = path.join(upDir, keptFile);
    fs.writeFileSync(keptPath, VALID_PNG);
    usersRepo.update(user.id, {
      avatarUrl: `/uploads/${keptFile}`,
      profile: { avatarUrl: `/uploads/${keptFile}` } as any,
    });

    const orphanFile = 'old-orphan-avatar.png';
    const orphanPath = path.join(upDir, orphanFile);
    fs.writeFileSync(orphanPath, VALID_PNG);

    const oldDate = new Date(Date.now() - (ORPHAN_UPLOAD_MAX_AGE_MS + 60_000));
    fs.utimesSync(keptPath, oldDate, oldDate);
    fs.utimesSync(orphanPath, oldDate, oldDate);

    storageHygieneService.runHygiene({ dryRun: false, uploadsDir: upDir });

    expect(fs.existsSync(keptPath)).toBe(true);
    expect(fs.existsSync(orphanPath)).toBe(false);
  });
});
