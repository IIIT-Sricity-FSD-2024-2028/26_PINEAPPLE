const zlib = require('zlib');
const payload = JSON.stringify({ test: 'hello world', items: new Array(100).fill({ id: 1, name: 'Alice' }) });
const uncompressed = Buffer.from(payload);
const compressed = zlib.gzipSync(uncompressed);
console.log('Uncompressed bytes:', uncompressed.length);
console.log('Compressed bytes:', compressed.length);
console.log('Compression ratio:', ((1 - compressed.length / uncompressed.length) * 100).toFixed(1) + '%');
