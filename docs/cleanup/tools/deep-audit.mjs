import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = process.cwd();
const FE_ROOT = path.join(REPO_ROOT, 'React-Implementation', 'React-Implementation');
const SRC_ROOT = path.join(FE_ROOT, 'src');
const report = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs/cleanup/tools/dep-graph-report.json'), 'utf8'));

function walk(dir, filter = () => true) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.git') continue;
    const f = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(f, filter));
    else if (filter(f)) out.push(f);
  }
  return out.sort();
}
function toPosix(p) { return p.split(path.sep).join('/'); }
function relFe(p) { return toPosix(path.relative(FE_ROOT, p)); }

const allSrc = walk(SRC_ROOT);
const nonTestCode = allSrc.filter((f) => /\.(js|jsx)$/.test(f) && !relFe(f).startsWith('src/test/') && !relFe(f).startsWith('src/store/__tests__/'));
const testCode = allSrc.filter((f) => /\.(js|jsx)$/.test(f) && (relFe(f).startsWith('src/test/') || relFe(f).startsWith('src/store/__tests__/')));
const cssFiles = allSrc.filter((f) => f.endsWith('.css'));

const rawCache = new Map(allSrc.map((f) => [relFe(f), fs.readFileSync(f, 'utf8')]));

console.log('=== 1. LEGACY / STRINGS SEARCH IN NON-TEST CODE ===');
const patterns = [
  'apiGetCache',
  'AuthContext',
  'RoleContext',
  'NotificationContext',
  'UIContext',
  'storage.js',
  'roleStore',
  'teamforge:',
  'localStorage',
  'sessionStorage',
  'document.cookie',
  'indexedDB',
  'resetRouteGroup',
  'RouteResetObserver',
  'TODO',
  'FIXME',
  'XXX',
];
for (const pat of patterns) {
  const hits = [];
  for (const f of nonTestCode) {
    const r = relFe(f);
    const txt = rawCache.get(r);
    if (txt.includes(pat)) {
      const lines = txt.split(/\r?\n/).map((l, idx) => l.includes(pat) ? idx + 1 : null).filter(Boolean);
      hits.push(`${r}:${lines.join(',')}`);
    }
  }
  console.log(`PATTERN "${pat}": ${hits.length ? hits.join(' | ') : 'NO MATCHES'}`);
}

console.log('\n=== 2. CONSOLE.* IN NON-TEST CODE ===');
for (const f of nonTestCode) {
  const r = relFe(f);
  const lines = rawCache.get(r).split(/\r?\n/);
  const matches = [];
  lines.forEach((l, i) => {
    if (/\bconsole\.(log|debug|info|warn|error)\b/.test(l)) matches.push(`${i + 1}:${l.trim().slice(0, 80)}`);
  });
  if (matches.length && !r.startsWith('src/utils/') && r.includes('console')) {} // print all console.log/debug
  const debugOnly = [];
  lines.forEach((l, i) => {
    if (/\bconsole\.(log|debug)\b/.test(l)) debugOnly.push(`${i + 1}`);
  });
  if (debugOnly.length) console.log(`console.log/debug: ${r} lines [${debugOnly.join(',')}]`);
}

console.log('\n=== 3. STRAY / BACKUP / EMPTY / COMMENTED FILES IN FE ===');
const allFeFiles = walk(FE_ROOT);
for (const f of allFeFiles) {
  const r = relFe(f);
  if (/\.(old|bak|orig|tmp)$/i.test(r) || /copy|-v2|\(2\)/i.test(r)) {
    console.log(`STRAY_NAME: ${r}`);
  }
  if (/\.(js|jsx|css)$/.test(r)) {
    const txt = fs.readFileSync(f, 'utf8');
    const stripped = txt.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').trim();
    if (!stripped) console.log(`EMPTY_OR_COMMENTED: ${r} (${txt.split(/\r?\n/).length} lines)`);
  }
}

console.log('\n=== 4. UNUSED THUNKS (EXPORTED IN src/store/thunks/*.js WITH 0 APP CALLERS) ===');
for (const [rel, r] of Object.entries(report.fileReports)) {
  if (!rel.startsWith('src/store/thunks/')) continue;
  for (const [exp, u] of Object.entries(r.exportUsage)) {
    if (u.appCallers.length === 0) {
      console.log(`THUNK_UNUSED_APP: ${rel}::${exp} (testCallers=${u.testCallers.length})`);
    }
  }
}

console.log('\n=== 5. UNUSED ROUTES & LINK AUDIT ===');
const appRoutesRaw = rawCache.get('src/routes/AppRoutes.jsx');
const routeMatches = [...appRoutesRaw.matchAll(/<Route\s+[^>]*path=["']([^"']+)["'][^>]*element=\{<([A-Za-z0-9_]+)/g)];
const allUiText = nonTestCode.filter((f) => relFe(f) !== 'src/routes/AppRoutes.jsx').map((f) => rawCache.get(relFe(f))).join('\n');
for (const m of routeMatches) {
  const rPath = m[1];
  const comp = m[2];
  const fullPath = rPath.startsWith('/') ? rPath : `/admin/${rPath}`;
  if (rPath === '*') continue;
  const staticPathPrefix = fullPath.split(':')[0];
  const hasRef = allUiText.includes(staticPathPrefix);
  console.log(`ROUTE ${fullPath} -> ${comp}: linked/mentioned=${hasRef}`);
}

console.log('\n=== 6. CSS FILES & CLASS USAGE CHECK ===');
const allJsxText = nonTestCode.filter((f) => /\.(js|jsx)$/.test(f)).map((f) => rawCache.get(relFe(f))).join('\n');
for (const f of cssFiles) {
  const r = relFe(f);
  const css = rawCache.get(r);
  const rInfo = report.fileReports[r];
  const impCount = rInfo ? rInfo.importers.filter((i) => i.appReachable).length : 0;
  // extract top-level simple class selectors
  const clsMatches = [...new Set([...css.matchAll(/\.([a-zA-Z_-][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))];
  const unusedCls = clsMatches.filter((c) => !allJsxText.includes(c));
  console.log(`${r} (${css.split(/\r?\n/).length}L) imp=${impCount} | classes=${clsMatches.length} potentiallyUnused=${unusedCls.length} [${unusedCls.slice(0, 8).join(', ')}${unusedCls.length > 8 ? '...' : ''}]`);
}

console.log('\n=== 7. GIT LOG FOR store/utils, slices, thunks, components ===');
for (const f of allSrc) {
  const r = relFe(f);
  if (!r.startsWith('src/store/utils/')) continue;
  const st = execSync(`git status --porcelain -- "React-Implementation/React-Implementation/${r}"`, { encoding: 'utf8' }).trim();
  let info = 'tracked';
  if (st.startsWith('??')) info = 'untracked (new in current work)';
  else {
    const logOut = execSync(`git log --reverse --format="%an|%as" -- "React-Implementation/React-Implementation/${r}"`, { encoding: 'utf8' }).trim();
    info = `${st ? 'modified' : 'tracked'} (${logOut.split(/\r?\n/)[0] || ''})`;
  }
  console.log(`${r}: ${info}`);
}

console.log('\n=== 8. TESTS TESTING WITHOUT <Provider> (useSafeStoreSelector / withOptionalStore) ===');
let nonProviderTests = [];
for (const f of testCode) {
  const r = relFe(f);
  const txt = rawCache.get(r);
  if (/\brender\s*\(/.test(txt) && !txt.includes('renderWithStore') && !txt.includes('renderWithProviders') && !txt.includes('<Provider')) {
    nonProviderTests.push(r);
  }
}
console.log(`Tests calling raw RTL render() without Provider/renderWithStore (${nonProviderTests.length}): ${nonProviderTests.join(', ')}`);
