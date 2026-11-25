const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('React-Implementation/React-Implementation/src');

function getAllFiles(dir, list = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(full, list);
    } else {
      list.push(full);
    }
  }
  return list;
}

const allSrcFiles = getAllFiles(srcDir);

// Build dependency graph
const graph = new Map();
const extensions = ['.js', '.jsx', '.ts', '.tsx', '.json', '.css'];

function resolveImport(sourceFile, importPath) {
  if (importPath.startsWith('.')) {
    const dir = path.dirname(sourceFile);
    const candidate = path.resolve(dir, importPath);
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
    for (const ext of extensions) {
      if (fs.existsSync(candidate + ext) && fs.statSync(candidate + ext).isFile()) {
        return candidate + ext;
      }
      const indexCandidate = path.join(candidate, 'index' + ext);
      if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
        return indexCandidate;
      }
    }
  }
  return null;
}

for (const file of allSrcFiles) {
  if (!extensions.some(ext => file.endsWith(ext))) continue;
  const content = fs.readFileSync(file, 'utf8');
  const deps = [];
  
  // match import ... from '...'; import '...'; export ... from '...';
  const importRegex = /(?:import|export)\s+(?:.*?from\s+)?['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const resolved = resolveImport(file, match[1]);
    if (resolved) {
      deps.push(resolved);
    }
  }

  // match CSS url(...) or @import
  if (file.endsWith('.css')) {
    const cssImportRegex = /@import\s+['"]([^'"]+)['"]/g;
    while ((match = cssImportRegex.exec(content)) !== null) {
      const resolved = resolveImport(file, match[1]);
      if (resolved) deps.push(resolved);
    }
  }

  graph.set(file, deps);
}

// Traverse from main.jsx
const entryPoint = path.resolve(srcDir, 'main.jsx');
const reached = new Set();

function dfs(node) {
  if (reached.has(node)) return;
  reached.add(node);
  const deps = graph.get(node) || [];
  for (const dep of deps) {
    dfs(dep);
  }
}

dfs(entryPoint);

const unreached = allSrcFiles.filter(f => !reached.has(f));

console.log('Total files in src:', allSrcFiles.length);
console.log('Reached files:', reached.size);
console.log('Unreached files count:', unreached.length);
console.log('\nUnreached files:');
unreached.forEach(f => {
  console.log('-', path.relative(srcDir, f));
});
