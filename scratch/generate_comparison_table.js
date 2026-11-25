const fs = require('fs');

const baseline = require('./baseline_backend_measurements.json');
const phase2 = require('./phase2_backend_measurements.json');

const baselineMap = new Map();
for (const item of baseline) {
  baselineMap.set(item.name, item);
}

const comparison = [];

for (const p of phase2) {
  const b = baselineMap.get(p.name);
  if (!b) continue;

  const bMedian = parseFloat(b.median);
  const pMedian = parseFloat(p.median);
  const medChangeMs = (pMedian - bMedian).toFixed(2);
  const medChangePct = (((pMedian - bMedian) / bMedian) * 100).toFixed(1);

  const bBytes = b.sizeBytes;
  const pBytes = p.sizeBytes;
  const bytesChange = pBytes - bBytes;
  const bytesChangePct = (((pBytes - bBytes) / bBytes) * 100).toFixed(1);

  comparison.push({
    name: p.name,
    method: p.method,
    path: p.path,
    bMedian,
    pMedian,
    medChangeMs,
    medChangePct,
    bBytes,
    pBytes,
    bytesChange,
    bytesChangePct,
    isGzip: p.isGzip,
  });
}

// Sort by largest byte reduction or slowest median
comparison.sort((a, b) => a.pBytes - a.bBytes);

console.log('Endpoint | Method | Baseline Med (ms) | Optimized Med (ms) | Baseline Size (B) | Optimized Size (B) | Size Δ (%) | Latency Δ (ms)');
console.log('---|---|---|---|---|---|---|---');
for (const c of comparison) {
  console.log(
    `\`${c.name}\` | \`${c.method}\` | ${c.bMedian.toFixed(2)} ms | ${c.pMedian.toFixed(2)} ms | ${c.bBytes} B | ${c.pBytes} B | ${c.bytesChangePct}% | ${c.medChangeMs} ms`
  );
}

fs.writeFileSync('scratch/comparison_summary.json', JSON.stringify(comparison, null, 2));
