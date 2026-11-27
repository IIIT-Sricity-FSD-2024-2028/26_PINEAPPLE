import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = process.cwd();
const FE_ROOT = path.join(REPO_ROOT, 'React-Implementation', 'React-Implementation');
const SRC_ROOT = path.join(FE_ROOT, 'src');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(p)) out.push(p);
  }
  return out.sort();
}
function rel(p) { return path.relative(SRC_ROOT, p).split(path.sep).join('/'); }

const files = walk(SRC_ROOT);
const nonTest = files.filter((f) => !rel(f).startsWith('test/') && !rel(f).startsWith('store/__tests__/'));
const texts = new Map(files.map((f) => [rel(f), fs.readFileSync(f, 'utf8')]));

console.log('=== IMPORTS FROM apiClient.js ===');
for (const f of files) {
  const r = rel(f);
  const txt = texts.get(r);
  const re = /import\s+([\s\S]*?)\s+from\s+["'][^"']*apiClient(?:\.js)?["']/g;
  let m;
  while ((m = re.exec(txt))) {
    console.log(`${r} -> ${m[1].replace(/\s+/g, ' ').trim()}`);
  }
}

console.log('\n=== SPECIFIC SYMBOL REFS (ALL src/ FILES) ===');
const syms = [
  'RouteResetObserver',
  'routeResetListener',
  'resetRouteGroup',
  'useVisibilityPoll',
  'useChatPolling',
  'useChatUnreadPolling',
  'useChatMessagesPolling',
  'useNotificationPolling',
  'useReasonAction',
  'actionApi',
  'useSafeStoreSelector',
  'withOptionalStore',
  'RoleSyncProbe',
  'getOwnerRejectionPatterns',
  'requestPhoneOtp',
  'verifyPhoneOtp',
  'complete_profile',
  'mentorMarketApi',
];
for (const sym of syms) {
  const hits = [];
  for (const f of files) {
    const r = rel(f);
    if (texts.get(r).includes(sym)) hits.push(r);
  }
  console.log(`${sym}: (${hits.length}) -> ${hits.join(', ')}`);
}

console.log('\n=== EMPTY REDUCERS OR NO-OP REDUCERS IN SLICES ===');
for (const f of nonTest.filter((x) => rel(x).startsWith('store/slices/'))) {
  const r = rel(f);
  const txt = texts.get(r);
  const emptyRed = [...txt.matchAll(/([A-Za-z0-9_]+)\s*\([^)]*\)\s*\{\s*\}/g)].map((m) => m[1]);
  if (emptyRed.length) console.log(`${r}: empty functions [${emptyRed.join(', ')}]`);
  const has4Crud = ['setAll', 'addOne', 'updateOne', 'removeOne'].every((k) => new RegExp(`\\b${k}\\b`).test(txt));
  if (!has4Crud) console.log(`${r}: missing one of 4 CRUD ops`);
}

console.log('\n=== TEST FILES TESTING REMOVED / LEGACY CODE ===');
const testFiles = files.filter((f) => rel(f).startsWith('test/') || rel(f).startsWith('store/__tests__/'));
for (const f of testFiles) {
  const r = rel(f);
  const txt = texts.get(r);
  const hits = [];
  if (txt.includes('RouteResetObserver')) hits.push('RouteResetObserver');
  if (txt.includes('getRouteGroup')) hits.push('getRouteGroup');
  if (txt.includes('actionApi')) hits.push('actionApi');
  if (txt.includes('requestPhoneOtp') || txt.includes('verifyPhoneOtp')) hits.push('phoneOtp');
  if (hits.length) console.log(`${r}: [${hits.join(', ')}]`);
}

console.log('\n=== GIT INFO FOR src/store/utils/ & src/store/slices/ & thunks ===');
for (const f of files.filter((x) => rel(x).startsWith('store/utils/'))) {
  const rp = `React-Implementation/React-Implementation/src/${rel(f)}`;
  const st = execSync(`git status --porcelain -- "${rp}"`, { encoding: 'utf8' }).trim();
  const logOut = execSync(`git log --reverse --format="%an|%as" -- "${rp}"`, { encoding: 'utf8' }).trim();
  console.log(`${rel(f)}: status="${st || 'tracked'}" log="${logOut.split(/\r?\n/)[0] || 'uncommitted'}"`);
}
