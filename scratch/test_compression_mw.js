const http = require('http');
const zlib = require('zlib');

function compressionMiddleware(req, res, next) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  if (!acceptEncoding.includes('gzip')) {
    return next();
  }

  const originalWrite = res.write;
  const originalEnd = res.end;
  const chunks = [];

  res.write = function (chunk, ...args) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  };

  res.end = function (chunk, ...args) {
    if (chunk) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    const body = Buffer.concat(chunks);

    // Only compress if size > 1024 bytes and response is JSON/text
    const contentType = String(res.getHeader('content-type') || '');
    const isCompressible = !contentType || contentType.includes('json') || contentType.includes('text');

    if (body.length > 1024 && isCompressible && !res.getHeader('content-encoding')) {
      try {
        const compressed = zlib.gzipSync(body);
        res.setHeader('Content-Encoding', 'gzip');
        res.setHeader('Content-Length', compressed.length);
        res.removeHeader('etag'); // or let express handle
        return originalEnd.call(res, compressed);
      } catch (err) {
        // Fallback to uncompressed on any error
      }
    }

    return originalEnd.call(res, body);
  };

  next();
}

// Test with mini server
const server = http.createServer((req, res) => {
  compressionMiddleware(req, res, () => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ data: 'x'.repeat(5000) }));
  });
});

server.listen(4567, () => {
  http.get('http://localhost:4567', { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Content-Encoding:', res.headers['content-encoding']);
    console.log('Content-Length:', res.headers['content-length']);
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      const decompressed = zlib.gunzipSync(Buffer.concat(chunks)).toString('utf8');
      console.log('Decompressed length matches:', JSON.parse(decompressed).data.length === 5000);
      server.close();
    });
  });
});
