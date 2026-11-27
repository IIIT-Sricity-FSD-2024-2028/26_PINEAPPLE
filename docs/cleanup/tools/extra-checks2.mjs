import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const SRC_ROOT = path.join(REPO_ROOT, 'React-Implementation', 'React-Implementation', 'src');
const report = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs/cleanup/tools/dep-graph-report.json'), 'utf8'));

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(p)) out.push(p);
  }
  return out.sort();
}
function rel(p) { return path.relative(SRC_ROOT, p).split(path.sep).join('/'); }
const files = walk(SRC_ROOT);
const nonTest = files.filter((f) => !rel(f).startsWith('test/') && !rel(f).startsWith('store/__tests__/'));
const nonTestTxt = nonTest.map((f) => [rel(f), fs.readFileSync(f, 'utf8')]);
const allTxt = files.map((f) => [rel(f), fs.readFileSync(f, 'utf8')]);

console.log('=== useReasonAction MEMBERS USAGE ===');
const members = [
  'requestReason', 'closeModal', 'modalState', 'renderModal', 'renderReasonModal',
  'handleDeclineInvite', 'handleAcceptInvite', 'handleWithdrawApplication', 'handleLeaveProject',
  'handleDropTask', 'handleRejectWork', 'handleRemoveMember', 'handleCancelBooking',
  'handleDeclineBooking', 'handleAcceptBooking',
];
for (const m of members) {
  const appHits = nonTestTxt.filter(([r, t]) => r !== 'hooks/useReasonAction.jsx' && t.includes(m)).map(([r]) => r);
  const testHits = allTxt.filter(([r, t]) => (r.startsWith('test/') || r.startsWith('store/__tests__/')) && t.includes(m)).map(([r]) => r);
  console.log(`${m}: app=[${appHits.join(',')}] test=[${testHits.length}]`);
}

console.log('\n=== actionApi METHODS IN Phase9CollaboratorScreens.test.jsx & NON-TEST ===');
const apiMethods = ['declineInvite','acceptInvite','withdrawApplication','leaveProject','dropTask','rejectWork','removeMember','cancelBooking','declineBooking','acceptBooking'];
for (const m of apiMethods) {
  const hits = nonTestTxt.filter(([r, t]) => r !== 'hooks/useReasonAction.jsx' && t.includes(`actionApi.${m}`)).map(([r]) => r);
  console.log(`actionApi.${m}: app=[${hits.join(',')}]`);
}

console.log('\n=== NON-CRUD REDUCER EXPORTS WITH 0 APP CALLERS ===');
const crud = new Set(['setAll', 'addOne', 'updateOne', 'removeOne', 'default']);
for (const [fRel, info] of Object.entries(report.fileReports)) {
  if (!fRel.startsWith('src/store/slices/')) continue;
  const zeroApp = [];
  for (const [exp, u] of Object.entries(info.exportUsage)) {
    if (crud.has(exp)) continue;
    if (/Adapter$|CrudSelectors$|^createInitial|^getInitialTheme$|^escrowSlice$/.test(exp)) continue;
    if (u.appCallers.length === 0) zeroApp.push(`${exp}(t:${u.testCallers.length})`);
  }
  if (zeroApp.length) console.log(`${fRel}: ${zeroApp.join(', ')}`);
}

console.log('\n=== SLICE NAMES VS THUNK NAMES VS SELECTOR NAMES ===');
const slices = Object.keys(report.fileReports).filter((r) => r.startsWith('src/store/slices/')).sort();
const thunks = Object.keys(report.fileReports).filter((r) => r.startsWith('src/store/thunks/')).sort();
const selectors = Object.keys(report.fileReports).filter((r) => r.startsWith('src/store/selectors/')).sort();
console.log({ slices: slices.length, thunks: thunks.length, selectors: selectors.length });

console.log('\n=== TEST FILES SUMMARY (CHECK ANY OBSOLETE TESTS) ===');
for (const f of files.filter((x) => rel(x).startsWith('test/') || rel(x).startsWith('store/__tests__/'))) {
  const r = rel(f);
  const t = fs.readFileSync(f, 'utf8');
  if (t.includes('authMode') || t.includes('RouteResetObserver') || t.includes('actionApi') || t.includes('SafeLink')) {
    // skip noise
  }
}
// Count lines of candidate removals
const candidates = [
  'src/store/components/RouteResetObserver.jsx',
  'src/store/README.md',
];
console.log('Done.');
