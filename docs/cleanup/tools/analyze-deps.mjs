import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const REPO_ROOT = path.resolve(process.cwd());
const FE_ROOT = path.join(REPO_ROOT, 'React-Implementation', 'React-Implementation');
const SRC_ROOT = path.join(FE_ROOT, 'src');
const PUBLIC_ROOT = path.join(FE_ROOT, 'public');
const OUT_JSON = path.join(REPO_ROOT, 'docs', 'cleanup', 'tools', 'dep-graph-report.json');

const EXTENSIONS = ['.js', '.jsx', '.mjs', '.cjs', '.json', '.css', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.mp4'];

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function relFe(abs) {
  return toPosix(path.relative(FE_ROOT, abs));
}

function relRepo(abs) {
  return toPosix(path.relative(REPO_ROOT, abs));
}

function walk(dir, filterFn = () => true) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full, filterFn));
    } else if (filterFn(full)) {
      out.push(full);
    }
  }
  return out.sort();
}

function resolveImport(fromFile, spec) {
  if (!spec || (!spec.startsWith('.') && !spec.startsWith('/'))) {
    return null; // bare package or URL
  }
  const baseDir = spec.startsWith('/') ? FE_ROOT : path.dirname(fromFile);
  const cleanSpec = spec.split('?')[0].split('#')[0];
  const candidateBase = spec.startsWith('/')
    ? path.join(FE_ROOT, cleanSpec.slice(1))
    : path.resolve(baseDir, cleanSpec);

  const candidates = [
    candidateBase,
    ...EXTENSIONS.map((ext) => candidateBase + ext),
    ...EXTENSIONS.map((ext) => path.join(candidateBase, 'index' + ext)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) {
      return path.normalize(c);
    }
  }
  return null;
}

function stripCommentsPreserveStrings(code) {
  // Replace // and /* */ comments with spaces while keeping strings intact
  let out = '';
  let i = 0;
  const n = code.length;
  while (i < n) {
    const ch = code[i];
    const next = code[i + 1];
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch;
      out += ch;
      i++;
      while (i < n) {
        const c = code[i];
        out += c;
        if (c === '\\') {
          i++;
          if (i < n) out += code[i];
          i++;
          continue;
        }
        if (quote === '`' && c === '$' && code[i + 1] === '{') {
          out += '{';
          i += 2;
          // copy until matching }
          let depth = 1;
          while (i < n && depth > 0) {
            const tc = code[i];
            if (tc === '{') depth++;
            else if (tc === '}') depth--;
            out += tc;
            i++;
          }
          continue;
        }
        i++;
        if (c === quote) break;
      }
      continue;
    }
    if (ch === '/' && next === '/') {
      out += '  ';
      i += 2;
      while (i < n && code[i] !== '\n') {
        out += ' ';
        i++;
      }
      continue;
    }
    if (ch === '/' && next === '*') {
      out += '  ';
      i += 2;
      while (i < n && !(code[i] === '*' && code[i + 1] === '/')) {
        out += code[i] === '\n' ? '\n' : ' ';
        i++;
      }
      if (i < n) {
        out += '  ';
        i += 2;
      }
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

function parseNamedClause(clause) {
  // e.g. "{ a, b as c, default as d }" -> [{ imported: 'a', local: 'a' }, ...]
  const cleaned = clause.replace(/^\{|\}$/g, '').trim();
  if (!cleaned) return [];
  return cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^([A-Za-z0-9_$]+)\s+as\s+([A-Za-z0-9_$]+)$/);
      if (m) return { imported: m[1], local: m[2] };
      return { imported: part, local: part };
    });
}

function parseModule(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();
  const lineCount = raw.split(/\r?\n/).length;
  const imports = []; // { spec, resolved, kind, symbols: [...], line }
  const exports = []; // { name, localName, reexportFrom, reexportResolved, importedName, isStar, line }
  const barePackages = new Set();
  const stringLiterals = [];

  if (ext === '.css') {
    const cssNoComments = raw.replace(/\/\*[\s\S]*?\*\//g, '');
    let m;
    const importRe = /@import\s+(?:url\(\s*)?["']([^"']+)["']\s*\)?/g;
    while ((m = importRe.exec(cssNoComments))) {
      const spec = m[1];
      imports.push({ spec, resolved: resolveImport(filePath, spec), kind: 'css-import', symbols: ['*'], line: 1 });
    }
    const urlRe = /url\(\s*["']?([^"')]+)["']?\s*\)/g;
    while ((m = urlRe.exec(cssNoComments))) {
      const spec = m[1].trim();
      if (!spec.startsWith('data:') && !spec.startsWith('http')) {
        stringLiterals.push(spec);
        const res = resolveImport(filePath, spec);
        if (res) {
          imports.push({ spec, resolved: res, kind: 'css-url', symbols: ['*'], line: 1 });
        }
      }
    }
    return { lineCount, imports, exports, barePackages: [], stringLiterals, hookCalls: [], raw };
  }

  if (ext === '.html') {
    let m;
    const srcRe = /(?:src|href)=["']([^"']+)["']/g;
    while ((m = srcRe.exec(raw))) {
      const spec = m[1];
      stringLiterals.push(spec);
      if (spec.startsWith('/') || spec.startsWith('.')) {
        const res = resolveImport(filePath, spec);
        if (res) imports.push({ spec, resolved: res, kind: 'html-ref', symbols: ['*'], line: 1 });
      }
    }
    return { lineCount, imports, exports, barePackages: [], stringLiterals, hookCalls: [], raw };
  }

  if (!['.js', '.jsx', '.mjs', '.cjs'].includes(ext)) {
    return { lineCount, imports, exports, barePackages: [], stringLiterals, hookCalls: [], raw };
  }

  const clean = stripCommentsPreserveStrings(raw);

  // Extract string literals for heuristic checks
  const strRe = /(["'])((?:\\.|(?!\1)[^\\])*)\1/g;
  let sm;
  while ((sm = strRe.exec(clean))) {
    if (sm[2] && sm[2].length < 240) stringLiterals.push(sm[2]);
  }

  // Track hook calls useXxx(
  const hookCallSet = new Set();
  const hookRe = /\b(use[A-Z][A-Za-z0-9_]*)\s*\(/g;
  let hm;
  while ((hm = hookRe.exec(clean))) {
    hookCallSet.add(hm[1]);
  }

  const recordImport = (spec, kind, symbols, idx) => {
    if (!spec) return;
    if (!spec.startsWith('.') && !spec.startsWith('/')) {
      const pkg = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0];
      barePackages.add(pkg);
      return;
    }
    const line = clean.slice(0, idx).split('\n').length;
    imports.push({ spec, resolved: resolveImport(filePath, spec), kind, symbols, line });
  };

  // Static ES imports (multiline safe)
  const staticImportRe = /(?:^|\n|;)\s*import\s+([\s\S]*?)\s+from\s+["']([^"']+)["']\s*;?/g;
  let m;
  while ((m = staticImportRe.exec(clean))) {
    const clause = m[1].trim();
    const spec = m[2];
    const symbols = [];
    if (clause.includes('* as ')) {
      symbols.push('*');
    } else if (clause.startsWith('{')) {
      for (const item of parseNamedClause(clause)) symbols.push(item.imported);
    } else if (clause.includes('{')) {
      const idx = clause.indexOf('{');
      const defPart = clause.slice(0, idx).replace(',', '').trim();
      if (defPart) symbols.push('default');
      for (const item of parseNamedClause(clause.slice(idx))) symbols.push(item.imported);
    } else if (clause) {
      symbols.push('default');
    }
    recordImport(spec, 'static', symbols, m.index);
  }

  // Side-effect imports: import '...';
  const sideEffectImportRe = /(?:^|\n|;)\s*import\s+["']([^"']+)["']\s*;?/g;
  while ((m = sideEffectImportRe.exec(clean))) {
    recordImport(m[1], 'side-effect', ['*'], m.index);
  }

  // Dynamic import('...')
  const dynImportRe = /\bimport\s*\(\s*["'`]([^"'`${}]+)["'`]\s*\)/g;
  while ((m = dynImportRe.exec(clean))) {
    recordImport(m[1], 'dynamic', ['*'], m.index);
  }

  // require('...')
  const reqRe = /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g;
  while ((m = reqRe.exec(clean))) {
    recordImport(m[1], 'require', ['*'], m.index);
  }

  // new URL('...', import.meta.url)
  const urlMetaRe = /new\s+URL\s*\(\s*["']([^"']+)["']\s*,\s*import\.meta\.url\s*\)/g;
  while ((m = urlMetaRe.exec(clean))) {
    recordImport(m[1], 'url-meta', ['*'], m.index);
  }

  // import.meta.glob('...')
  const globRe = /import\.meta\.glob\s*\(\s*["']([^"']+)["']/g;
  while ((m = globRe.exec(clean))) {
    const pattern = m[1];
    // approximate glob prefix match
    imports.push({ spec: pattern, resolved: null, kind: 'glob', symbols: ['*'], line: clean.slice(0, m.index).split('\n').length });
  }

  // Re-exports: export ... from '...'
  const reexportNamedRe = /(?:^|\n|;)\s*export\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']\s*;?/g;
  while ((m = reexportNamedRe.exec(clean))) {
    const line = clean.slice(0, m.index).split('\n').length;
    const spec = m[2];
    const res = resolveImport(filePath, spec);
    const items = parseNamedClause(m[1]);
    imports.push({
      spec,
      resolved: res,
      kind: 're-export',
      symbols: items.map((x) => x.imported),
      line,
    });
    for (const item of items) {
      exports.push({
        name: item.local,
        localName: item.local,
        reexportFrom: spec,
        reexportResolved: res,
        importedName: item.imported,
        isStar: false,
        line,
      });
    }
  }

  const reexportStarRe = /(?:^|\n|;)\s*export\s+\*\s*(?:as\s+([A-Za-z0-9_$]+)\s+)?from\s+["']([^"']+)["']\s*;?/g;
  while ((m = reexportStarRe.exec(clean))) {
    const line = clean.slice(0, m.index).split('\n').length;
    const nsName = m[1];
    const spec = m[2];
    const res = resolveImport(filePath, spec);
    imports.push({ spec, resolved: res, kind: 're-export-star', symbols: ['*'], line });
    exports.push({
      name: nsName || '*',
      localName: nsName || '*',
      reexportFrom: spec,
      reexportResolved: res,
      importedName: '*',
      isStar: !nsName,
      line,
    });
  }

  // Direct exports
  const defaultExpRe = /(?:^|\n|;)\s*export\s+default\b/g;
  while ((m = defaultExpRe.exec(clean))) {
    exports.push({
      name: 'default',
      localName: 'default',
      reexportFrom: null,
      reexportResolved: null,
      importedName: null,
      isStar: false,
      line: clean.slice(0, m.index).split('\n').length,
    });
  }

  const declExpRe = /(?:^|\n|;)\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z0-9_$]+)/g;
  while ((m = declExpRe.exec(clean))) {
    exports.push({
      name: m[1],
      localName: m[1],
      reexportFrom: null,
      reexportResolved: null,
      importedName: null,
      isStar: false,
      line: clean.slice(0, m.index).split('\n').length,
    });
  }

  const destructExpRe = /(?:^|\n|;)\s*export\s+(?:const|let|var)\s*\{([^}]+)\}\s*=/g;
  while ((m = destructExpRe.exec(clean))) {
    const line = clean.slice(0, m.index).split('\n').length;
    const inner = m[1].split(',').map((s) => s.trim()).filter(Boolean);
    for (const part of inner) {
      const colonIdx = part.indexOf(':');
      const eqIdx = part.indexOf('=');
      let name = part;
      if (colonIdx !== -1) name = part.slice(colonIdx + 1).trim();
      if (eqIdx !== -1) name = name.slice(0, name.indexOf('=')).trim();
      name = name.replace(/^\.\.\./, '').trim();
      if (/^[A-Za-z0-9_$]+$/.test(name)) {
        exports.push({ name, localName: name, reexportFrom: null, reexportResolved: null, importedName: null, isStar: false, line });
      }
    }
  }

  const listExpRe = /(?:^|\n|;)\s*export\s+\{([^}]+)\}(?!\s*from\b)/g;
  while ((m = listExpRe.exec(clean))) {
    const line = clean.slice(0, m.index).split('\n').length;
    for (const item of parseNamedClause(m[1])) {
      exports.push({ name: item.local, localName: item.imported, reexportFrom: null, reexportResolved: null, importedName: null, isStar: false, line });
    }
  }

  // Special object-property exports like services/*Api.js exporting `default apiObj = { fn1, fn2 }`
  const exportedApiMethods = [];
  if (toPosix(filePath).includes('/src/services/') && filePath.endsWith('Api.js')) {
    const objMatch = clean.match(/(?:const|export\s+const)\s+[A-Za-z0-9_$]+\s*=\s*\{([\s\S]*?)\n\};/);
    if (objMatch) {
      const body = objMatch[1];
      const propRe = /^\s{2}([A-Za-z0-9_$]+)\s*[:(]/gm;
      let pm;
      while ((pm = propRe.exec(body))) {
        exportedApiMethods.push(pm[1]);
      }
    }
  }

  return {
    lineCount,
    imports,
    exports,
    exportedApiMethods,
    barePackages: [...barePackages],
    stringLiterals,
    hookCalls: [...hookCallSet],
    raw,
  };
}

function getGitInfo(absPath) {
  const rp = relRepo(absPath);
  try {
    const st = execSync(`git status --porcelain -- "${rp}"`, { cwd: REPO_ROOT, encoding: 'utf8' }).trim();
    let status = 'tracked';
    if (st.startsWith('??')) status = 'untracked';
    else if (st.startsWith('M') || st.startsWith(' M')) status = 'modified';
    else if (st.startsWith('A')) status = 'added';

    if (status === 'untracked') {
      return { status: 'untracked', firstAuthor: 'new in current work', firstDate: 'new in current work' };
    }
    const logOut = execSync(`git log --reverse --format="%an|%as" -- "${rp}"`, {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    }).trim();
    const firstLine = logOut.split(/\r?\n/)[0] || '';
    const [firstAuthor = 'unknown', firstDate = 'unknown'] = firstLine.split('|');
    return { status, firstAuthor, firstDate };
  } catch {
    return { status: 'unknown', firstAuthor: 'unknown', firstDate: 'unknown' };
  }
}

// 1. Collect files
const srcFiles = walk(SRC_ROOT);
const publicFiles = walk(PUBLIC_ROOT);
const rootConfigFiles = [
  path.join(FE_ROOT, 'index.html'),
  path.join(FE_ROOT, 'vite.config.js'),
  path.join(FE_ROOT, 'vitest.config.js'),
  path.join(FE_ROOT, 'eslint.config.js'),
  path.join(FE_ROOT, 'package.json'),
].filter((p) => fs.existsSync(p));
const scriptFiles = walk(path.join(REPO_ROOT, 'scripts'));

const allParsedFiles = [...srcFiles, ...rootConfigFiles, ...scriptFiles];
const modules = new Map();
for (const f of allParsedFiles) {
  modules.set(path.normalize(f), parseModule(f));
}

const isTestFile = (abs) => {
  const r = relFe(abs);
  return (
    r.startsWith('src/test/') ||
    r.startsWith('src/store/__tests__/') ||
    /\.test\.(js|jsx)$/i.test(r) ||
    r === 'vitest.config.js'
  );
};

// 2. Build reverse import edges and per-export usage
const importedBy = new Map(); // targetAbs -> [{ fromAbs, kind, symbols }]
for (const f of allParsedFiles) importedBy.set(path.normalize(f), []);

for (const [fromAbs, mod] of modules.entries()) {
  for (const imp of mod.imports) {
    if (imp.resolved && importedBy.has(imp.resolved)) {
      importedBy.get(imp.resolved).push({ fromAbs, kind: imp.kind, symbols: imp.symbols, line: imp.line });
    }
  }
}

// 3. BFS Reachability
function bfs(startFiles, skipTests = false) {
  const visited = new Set();
  const queue = [];
  for (const s of startFiles) {
    const norm = path.normalize(s);
    if (fs.existsSync(norm) && !visited.has(norm)) {
      visited.add(norm);
      queue.push(norm);
    }
  }
  while (queue.length > 0) {
    const cur = queue.shift();
    const mod = modules.get(cur);
    if (!mod) continue;
    for (const imp of mod.imports) {
      if (!imp.resolved) continue;
      if (skipTests && isTestFile(imp.resolved)) continue;
      if (!visited.has(imp.resolved)) {
        visited.add(imp.resolved);
        queue.push(imp.resolved);
      }
    }
  }
  return visited;
}

const appEntries = [
  path.join(FE_ROOT, 'index.html'),
  path.join(SRC_ROOT, 'main.jsx'),
];
const testEntries = [
  path.join(FE_ROOT, 'vitest.config.js'),
  path.join(SRC_ROOT, 'test', 'setup.js'),
  ...srcFiles.filter((f) => isTestFile(f)),
];

const appReachable = bfs(appEntries, true);
const testReachable = bfs(testEntries, false);
const scriptReachable = bfs(scriptFiles, false);

// 4. Analyze files in src/
const fileReports = {};
for (const abs of srcFiles) {
  const norm = path.normalize(abs);
  const rel = relFe(norm);
  const mod = modules.get(norm);
  const inApp = appReachable.has(norm);
  const inTest = testReachable.has(norm);
  const inScript = scriptReachable.has(norm);

  let reachability = 'UNREACHABLE';
  if (inApp) reachability = 'REACHABLE';
  else if (inTest) reachability = 'REACHABLE ONLY FROM TESTS';
  else if (inScript) reachability = 'REACHABLE ONLY FROM SCRIPTS';

  const importers = importedBy.get(norm) || [];
  const uniqueImporters = [...new Set(importers.map((i) => relFe(i.fromAbs)))];

  // Export usage
  const exportedNames = [...new Set(mod.exports.filter((e) => e.name !== '*').map((e) => e.name))];
  const exportUsage = {};
  for (const expName of exportedNames) {
    const callers = [];
    for (const imp of importers) {
      if (imp.symbols.includes('*') || imp.symbols.includes(expName)) {
        callers.push({
          file: relFe(imp.fromAbs),
          reachability: appReachable.has(imp.fromAbs) ? 'APP' : isTestFile(imp.fromAbs) ? 'TEST' : 'UNREACHABLE',
        });
      }
    }
    // Check star re-exports if nobody imported directly by name
    exportUsage[expName] = {
      appCallers: callers.filter((c) => c.reachability === 'APP').map((c) => c.file),
      testCallers: callers.filter((c) => c.reachability === 'TEST').map((c) => c.file),
      unreachableCallers: callers.filter((c) => c.reachability === 'UNREACHABLE').map((c) => c.file),
    };
  }

  // String & name reference scan across FE + docs
  const baseNoExt = path.basename(rel, path.extname(rel));
  const stringRefFiles = [];
  for (const [otherAbs, otherMod] of modules.entries()) {
    if (otherAbs === norm) continue;
    if (
      otherMod.stringLiterals.some((s) => s.includes(baseNoExt)) ||
      (exportedNames.some((n) => n !== 'default' && n.length > 4 && otherMod.raw.includes(n)) && !uniqueImporters.includes(relFe(otherAbs)))
    ) {
      stringRefFiles.push(relFe(otherAbs));
    }
  }

  fileReports[rel] = {
    rel,
    lineCount: mod.lineCount,
    reachability,
    importers: importers.map((i) => ({
      file: relFe(i.fromAbs),
      kind: i.kind,
      symbols: i.symbols,
      appReachable: appReachable.has(i.fromAbs),
      isTest: isTestFile(i.fromAbs),
    })),
    exports: exportedNames,
    exportUsage,
    exportedApiMethods: mod.exportedApiMethods || [],
    barePackages: mod.barePackages,
    hookCalls: mod.hookCalls,
    stringRefFiles,
  };
}

// 5. Git info for inventory target directories + unreachable/test-only files
const inventoryPrefixes = [
  'src/hooks/',
  'src/services/',
  'src/store/middleware/',
  'src/store/hooks/',
  'src/store/actions/',
  'src/store/components/',
  'src/store/selectors/',
  'src/utils/',
  'src/constants/',
  'src/routes/',
];
const gitInfoMap = {};
for (const abs of srcFiles) {
  const rel = relFe(abs);
  const r = fileReports[rel];
  if (
    inventoryPrefixes.some((p) => rel.startsWith(p)) ||
    r.reachability !== 'REACHABLE'
  ) {
    gitInfoMap[rel] = getGitInfo(abs);
  }
}

// 6. Services API method usage report
const apiMethodReport = {};
for (const abs of srcFiles) {
  const rel = relFe(abs);
  if (!rel.startsWith('src/services/') || !rel.endsWith('Api.js')) continue;
  const r = fileReports[rel];
  const methods = {};
  const defaultAliasUsage = new Set();
  for (const imp of r.importers) {
    const callerMod = modules.get(path.join(FE_ROOT, imp.file));
    if (!callerMod) continue;
    // find alias name used in caller
    const m = callerMod.raw.match(new RegExp(`import\\s+([A-Za-z0-9_$]+)\\s+from\\s+["'][^"']*${path.basename(rel, '.js')}(?:\\.js)?["']`));
    const alias = m ? m[1] : path.basename(rel, '.js');
    for (const methodName of r.exportedApiMethods) {
      const re = new RegExp(`\\b${alias}\\.${methodName}\\b|\\.${methodName}\\b`, 'g');
      if (re.test(callerMod.raw)) {
        defaultAliasUsage.add(`${methodName}::${imp.file}`);
      }
    }
  }
  for (const methodName of r.exportedApiMethods) {
    const callers = [...defaultAliasUsage]
      .filter((x) => x.startsWith(`${methodName}::`))
      .map((x) => x.split('::')[1]);
    // fallback whole-src search in case called via destructuring or helper
    const textCallers = [];
    for (const [otherAbs, otherMod] of modules.entries()) {
      const oRel = relFe(otherAbs);
      if (oRel === rel || oRel.endsWith('.json')) continue;
      if (otherMod.raw.includes(methodName)) {
        textCallers.push(oRel);
      }
    }
    methods[methodName] = {
      directCallers: callers,
      textCallers: [...new Set(textCallers)],
    };
  }
  apiMethodReport[rel] = {
    importers: r.importers,
    methods,
    namedExports: r.exports.filter((e) => e !== 'default'),
  };
}

// 7. Public & src assets reference check
const assetReport = {};
const allTextFiles = [
  ...srcFiles,
  ...rootConfigFiles,
];
const allRawByFile = new Map(allTextFiles.map((f) => [relFe(f), fs.readFileSync(f, 'utf8')]));
for (const pFile of [...publicFiles, ...srcFiles.filter((f) => /\.(png|jpg|jpeg|svg|gif|webp|mp4|ico)$/i.test(f))]) {
  const rel = relFe(pFile);
  const name = path.basename(pFile);
  const refs = [];
  for (const [fRel, txt] of allRawByFile.entries()) {
    if (txt.includes(name)) refs.push(fRel);
  }
  assetReport[rel] = { refs, sizeBytes: fs.statSync(pFile).size };
}

// 8. Package.json deps check
const pkgJson = JSON.parse(fs.readFileSync(path.join(FE_ROOT, 'package.json'), 'utf8'));
const usedPkgs = new Set();
for (const mod of modules.values()) {
  for (const b of mod.barePackages) usedPkgs.add(b);
}
const scriptText = Object.values(pkgJson.scripts || {}).join(' ');
const pkgReport = { dependencies: {}, devDependencies: {} };
for (const [dep, ver] of Object.entries(pkgJson.dependencies || {})) {
  pkgReport.dependencies[dep] = { version: ver, imported: usedPkgs.has(dep), inScripts: scriptText.includes(dep) };
}
for (const [dep, ver] of Object.entries(pkgJson.devDependencies || {})) {
  pkgReport.devDependencies[dep] = { version: ver, imported: usedPkgs.has(dep), inScripts: scriptText.includes(dep) };
}

// Summary stats
const counts = {
  totalSrcFiles: srcFiles.length,
  reachable: Object.values(fileReports).filter((r) => r.reachability === 'REACHABLE').length,
  testOnly: Object.values(fileReports).filter((r) => r.reachability === 'REACHABLE ONLY FROM TESTS').length,
  scriptOnly: Object.values(fileReports).filter((r) => r.reachability === 'REACHABLE ONLY FROM SCRIPTS').length,
  unreachable: Object.values(fileReports).filter((r) => r.reachability === 'UNREACHABLE').length,
};

const output = {
  generatedAt: new Date().toISOString(),
  counts,
  fileReports,
  gitInfoMap,
  apiMethodReport,
  assetReport,
  pkgReport,
};

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(output, null, 2), 'utf8');

console.log('Counts:', JSON.stringify(counts));
console.log('Unreachable src files:');
for (const [rel, r] of Object.entries(fileReports)) {
  if (r.reachability === 'UNREACHABLE') {
    console.log(`  [UNREACHABLE] ${rel} (${r.lineCount} LOC)`);
  }
}
console.log('Test-only src files (excluding src/test and src/store/__tests__):');
for (const [rel, r] of Object.entries(fileReports)) {
  if (
    r.reachability === 'REACHABLE ONLY FROM TESTS' &&
    !rel.startsWith('src/test/') &&
    !rel.startsWith('src/store/__tests__/')
  ) {
    console.log(`  [TEST-ONLY] ${rel} (${r.lineCount} LOC) <- ${r.importers.map((i) => i.file).join(', ')}`);
  }
}
