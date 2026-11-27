import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  ensureUploadDirectories,
  getSecureCvsDir,
  getUploadRootDir,
  getUploadsDir,
} from '../core/middleware/file-upload.middleware';

describe('Upload Directory & Watcher Configuration Tests', () => {
  const originalEnv = {
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    UPLOADS_DIR: process.env.UPLOADS_DIR,
    SECURE_CVS_DIR: process.env.SECURE_CVS_DIR,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(originalEnv)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  it('defaults UPLOAD_DIR to back-end/.runtime/uploads and creates upload + secure-cvs dirs', () => {
    delete process.env.UPLOAD_DIR;
    delete process.env.UPLOADS_DIR;
    delete process.env.SECURE_CVS_DIR;

    const root = getUploadRootDir();
    expect(root).toBe(path.resolve(process.cwd(), '.runtime', 'uploads'));
    expect(getUploadsDir()).toBe(root);
    expect(getSecureCvsDir()).toBe(path.join(root, 'secure-cvs'));

    const { uploadsDir, secureCvsDir } = ensureUploadDirectories();
    expect(fs.existsSync(uploadsDir)).toBe(true);
    expect(fs.existsSync(secureCvsDir)).toBe(true);
  });

  it('respects custom UPLOAD_DIR and creates the folder via ensureUploadDirectories', () => {
    const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'tf-upload-dir-'));
    const customUploadDir = path.join(tmpBase, 'nested', 'uploads');
    process.env.UPLOAD_DIR = customUploadDir;
    delete process.env.UPLOADS_DIR;
    delete process.env.SECURE_CVS_DIR;

    try {
      expect(getUploadRootDir()).toBe(path.resolve(customUploadDir));
      expect(getUploadsDir()).toBe(path.resolve(customUploadDir));
      expect(getSecureCvsDir()).toBe(path.join(path.resolve(customUploadDir), 'secure-cvs'));

      const created = ensureUploadDirectories();
      expect(fs.existsSync(created.uploadsDir)).toBe(true);
      expect(fs.existsSync(created.secureCvsDir)).toBe(true);
    } finally {
      fs.rmSync(tmpBase, { recursive: true, force: true });
    }
  });

  it('excludes upload directories in nest-cli.json, tsconfig, nodemon.json, and vite.config.js', () => {
    const backendRoot = process.cwd();
    const repoRoot = path.resolve(backendRoot, '..');

    const nestCli = JSON.parse(fs.readFileSync(path.join(backendRoot, 'nest-cli.json'), 'utf8'));
    const nestExcludes: string[] = nestCli?.watchOptions?.excludeDirectories || [];
    expect(nestExcludes).toEqual(
      expect.arrayContaining(['.runtime', 'uploads', 'secure-cvs']),
    );

    const tsconfig = JSON.parse(fs.readFileSync(path.join(backendRoot, 'tsconfig.json'), 'utf8'));
    const tsExcludes: string[] = tsconfig?.exclude || [];
    expect(tsExcludes).toEqual(
      expect.arrayContaining(['.runtime', 'uploads', 'secure-cvs']),
    );

    const tsconfigBuild = JSON.parse(
      fs.readFileSync(path.join(backendRoot, 'tsconfig.build.json'), 'utf8'),
    );
    const tsBuildExcludes: string[] = tsconfigBuild?.exclude || [];
    expect(tsBuildExcludes).toEqual(
      expect.arrayContaining(['.runtime', 'uploads', 'secure-cvs']),
    );

    const nodemonCfg = JSON.parse(
      fs.readFileSync(path.join(backendRoot, 'nodemon.json'), 'utf8'),
    );
    const nodemonIgnore: string[] = nodemonCfg?.ignore || [];
    expect(nodemonIgnore.some((p) => p.includes('.runtime'))).toBe(true);
    expect(nodemonIgnore.some((p) => p.includes('uploads'))).toBe(true);
    expect(nodemonIgnore.some((p) => p.includes('secure-cvs'))).toBe(true);

    // Ensure default UPLOAD_DIR (.runtime/uploads) is not inside srcRoot without exclusion
    const defaultRoot = path.resolve(backendRoot, '.runtime', 'uploads');
    const srcRoot = path.resolve(backendRoot, nestCli?.sourceRoot || 'src');
    expect(defaultRoot.startsWith(srcRoot + path.sep)).toBe(false);

    const viteCfgPath = path.join(
      repoRoot,
      'React-Implementation',
      'React-Implementation',
      'vite.config.js',
    );
    const viteCfg = fs.readFileSync(viteCfgPath, 'utf8');
    expect(viteCfg).toContain('watch');
    expect(viteCfg).toContain('.runtime');
    expect(viteCfg).toContain('uploads');
  });
});
