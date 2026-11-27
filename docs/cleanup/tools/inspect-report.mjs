import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = process.cwd();
const FE_ROOT = path.join(REPO_ROOT, 'React-Implementation', 'React-Implementation');
const report = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'docs/cleanup/tools/dep-graph-report.json'), 'utf8'));

function printSection(title) {
  console.log('\n==============================');
  console.log(title);
  console.log('==============================');
}

const prefixes = [
  'src/hooks/',
  'src/services/',
  'src/store/middleware/',
  'src/store/hooks/',
  'src/store/actions/',
  'src/store/components/',
  'src/store/selectors/',
  'src/store/utils/',
  'src/utils/',
  'src/constants/',
  'src/routes/',
];

printSection('TARGET FOLDERS SUMMARY');
for (const p of prefixes) {
  console.log(`\n--- ${p} ---`);
  for (const [rel, r] of Object.entries(report.fileReports)) {
    if (!rel.startsWith(p)) continue;
    const appImp = r.importers.filter((i) => i.appReachable).map((i) => i.file);
    const testImp = r.importers.filter((i) => i.isTest).map((i) => i.file);
    const unusedExp = Object.entries(r.exportUsage)
      .filter(([, u]) => u.appCallers.length === 0 && u.testCallers.length === 0)
      .map(([n]) => n);
    const testOnlyExp = Object.entries(r.exportUsage)
      .filter(([, u]) => u.appCallers.length === 0 && u.testCallers.length > 0)
      .map(([n]) => n);
    const git = report.gitInfoMap[rel] || {};
    console.log(
      `${rel} (${r.lineCount}L) [${r.reachability}] git=${git.status}(${git.firstAuthor},${git.firstDate}) | appImp=${appImp.length} [${appImp.slice(0, 4).join(', ')}${appImp.length > 4 ? '...' : ''}] | testImp=${testImp.length} | exports=${r.exports.length} unused=[${unusedExp.join(',')}] testOnlyExp=[${testOnlyExp.join(',')}]`,
    );
  }
}

printSection('SELECTORS FOLDER BREAKDOWN');
let selFiles = 0;
let selUnusedFiles = 0;
let selTestOnlyFiles = 0;
let selTotalExports = 0;
let selComponentUsedExports = 0;
let selNonTestAppUsedExports = 0;
let selTestOnlyExports = 0;
for (const [rel, r] of Object.entries(report.fileReports)) {
  if (!rel.startsWith('src/store/selectors/')) continue;
  selFiles++;
  let hasAppImp = false;
  let hasCompImp = false;
  for (const [exp, u] of Object.entries(r.exportUsage)) {
    selTotalExports++;
    const compCallers = u.appCallers.filter((f) => f.startsWith('src/pages/') || f.startsWith('src/components/') || f === 'src/App.jsx' || f.startsWith('src/routes/') || f.startsWith('src/hooks/'));
    if (u.appCallers.length > 0) {
      hasAppImp = true;
      selNonTestAppUsedExports++;
    }
    if (compCallers.length > 0) selComponentUsedExports++;
    else if (u.testCallers.length > 0 && u.appCallers.length === 0) selTestOnlyExports++;
    if (compCallers.length > 0) hasCompImp = true;
  }
  const appImpFiles = r.importers.filter((i) => i.appReachable);
  const testImpFiles = r.importers.filter((i) => i.isTest);
  if (appImpFiles.length === 0 && testImpFiles.length === 0) selUnusedFiles++;
  else if (appImpFiles.length === 0 && testImpFiles.length > 0) selTestOnlyFiles++;
  if (!hasCompImp) {
    console.log(`NO-COMP-CONSUMER: ${rel} | appImp=${appImpFiles.map((i) => i.file).join(',')} | testImp=${testImpFiles.map((i) => i.file).join(',')}`);
  }
}
console.log({ selFiles, selUnusedFiles, selTestOnlyFiles, selTotalExports, selNonTestAppUsedExports, selComponentUsedExports, selTestOnlyExports });

printSection('COMPONENTS / PAGES / STORE SLICES & THUNKS CHECK');
for (const [rel, r] of Object.entries(report.fileReports)) {
  if (rel.startsWith('src/components/') || rel.startsWith('src/pages/') || rel.startsWith('src/store/slices/') || rel.startsWith('src/store/thunks/')) {
    const appImp = r.importers.filter((i) => i.appReachable).map((i) => i.file);
    if (appImp.length === 0) {
      console.log(`ZERO_APP_IMPORTERS: ${rel} [${r.reachability}] testImp=${r.importers.filter((i) => i.isTest).map((i) => i.file).join(',')}`);
    }
    // check slices only consumed by slices/store/index.js vs selectors/components
    if (rel.startsWith('src/store/slices/')) {
      const consumersOutsideStoreIndex = appImp.filter((f) => f !== 'src/store/index.js');
      if (consumersOutsideStoreIndex.length === 0) {
        console.log(`SLICE_ONLY_IN_STORE_INDEX: ${rel} (imports only from store/index.js among app files)`);
      }
    }
  }
}

printSection('UNUSED THUNK EXPORTS & UNUSED SELECTOR/COMPONENT EXPORTS');
for (const [rel, r] of Object.entries(report.fileReports)) {
  if (rel.startsWith('src/test/') || rel.startsWith('src/store/__tests__/') || rel.endsWith('.css') || rel.endsWith('.md')) continue;
  const unused = Object.entries(r.exportUsage)
    .filter(([, u]) => u.appCallers.length === 0 && u.testCallers.length === 0)
    .map(([n]) => n);
  const testOnly = Object.entries(r.exportUsage)
    .filter(([, u]) => u.appCallers.length === 0 && u.testCallers.length > 0)
    .map(([n]) => n);
  if (unused.length > 0 || testOnly.length > 0) {
    if (rel.startsWith('src/store/slices/')) {
      // ignore standard CRUD exports if they are unused directly in UI, report non-CRUD
      const nonCrudUnused = unused.filter((x) => !['setAll', 'addOne', 'updateOne', 'removeOne', 'default'].includes(x));
      const nonCrudTestOnly = testOnly.filter((x) => !['setAll', 'addOne', 'updateOne', 'removeOne', 'default'].includes(x));
      if (nonCrudUnused.length || nonCrudTestOnly.length) {
        console.log(`${rel}: unused=[${nonCrudUnused.join(',')}] testOnly=[${nonCrudTestOnly.join(',')}]`);
      }
    } else {
      console.log(`${rel}: unused=[${unused.join(',')}] testOnly=[${testOnly.join(',')}]`);
    }
  }
}

printSection('API METHODS WITH ZERO NON-TEST CALLERS');
for (const [rel, data] of Object.entries(report.apiMethodReport)) {
  const zeroApp = [];
  for (const [m, info] of Object.entries(data.methods)) {
    const nonTest = info.textCallers.filter((f) => !f.startsWith('src/test/') && !f.startsWith('src/store/__tests__/') && !f.startsWith('src/services/'));
    if (nonTest.length === 0) {
      zeroApp.push(`${m} (tests: ${info.textCallers.filter((f) => f.startsWith('src/test/') || f.startsWith('src/store/__tests__/')).length})`);
    }
  }
  console.log(`${rel}: total=${Object.keys(data.methods).length} zeroApp=${zeroApp.length} [${zeroApp.join('; ')}]`);
}

printSection('ASSETS IN PUBLIC & SRC');
for (const [rel, info] of Object.entries(report.assetReport)) {
  console.log(`${rel} (${info.sizeBytes}B): refs=${info.refs.length} [${info.refs.join(', ')}]`);
}

printSection('PACKAGE.JSON REPORT');
console.log(JSON.stringify(report.pkgReport, null, 2));
