const fs = require("fs");
const path = require("path");

function walk(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== "node_modules" && file !== "dist" && file !== ".git") {
        walk(fullPath, fileList);
      }
    } else if (/\.(jsx?|tsx?)$/.test(file)) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const files = [
  ...walk("React-Implementation/React-Implementation/src"),
  ...walk("back-end/src")
];

const emptyCatches = [];
for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/(?:^|\})\s*catch\s*(?:\(([^)]*)\))?\s*\{/);
    if (match) {
      const errVar = match[1] ? match[1].trim() : "";
      
      let depth = 0;
      let bodyLines = [];
      let startCharIdx = line.indexOf('{');
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (let k = (j === i ? startCharIdx : 0); k < l.length; k++) {
          const c = l[k];
          if (c === '{') depth++;
          if (c === '}') depth--;
          if (depth === 0) break;
        }
        bodyLines.push(l);
        if (depth === 0) break;
      }
      
      const fullText = bodyLines.join("\n");
      const firstBrace = fullText.indexOf('{');
      const lastBrace = fullText.lastIndexOf('}');
      const inner = firstBrace !== -1 && lastBrace !== -1 ? fullText.slice(firstBrace + 1, lastBrace).trim() : "";
      
      const isCleanEmpty = inner === "" ||
        /^\/\*[\s\S]*?\*\/$/.test(inner) ||
        /^\/\/[^\n]*$/.test(inner) ||
        inner === "/* ignore */" ||
        inner === "/* non-critical */" ||
        inner === "// non-critical" ||
        inner === "// ignore";
      
      if (isCleanEmpty) {
        emptyCatches.push({
          file: file.replace(/\\/g, "/"),
          line: i + 1,
          errVar,
          fullText,
          inner
        });
      }
    }
  }
}

console.log(`Found ${emptyCatches.length} TRULY EMPTY/COMMENT-ONLY catch blocks:\n`);
emptyCatches.forEach((r, idx) => {
  console.log(`${idx + 1}. ${r.file}:${r.line} -> catch(${r.errVar || 'no-var'}) { ${r.inner || '<EMPTY>'} }`);
});
