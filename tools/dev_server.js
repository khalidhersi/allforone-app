// Local test server: serves www/ and runs the api/ functions with an in-memory database.
// Usage: node tools/dev_server.js   (then open http://localhost:8787)
process.env.AFO_MEMORY_DB = process.env.AFO_MEMORY_DB || '1';
const http = require('http'), fs = require('fs'), path = require('path');

const root = path.join(__dirname, '..');
const www = path.join(root, 'www');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, 'http://local');
    const api = url.pathname.match(/^\/api\/([a-z-]+)$/);
    if (api) {
      const file = path.join(root, 'api', api[1] + '.js');
      if (fs.existsSync(file)) return require(file)(req, res);
      res.statusCode = 404; return res.end('{"error":"Not found."}');
    }
    let file = path.join(www, decodeURIComponent(url.pathname));
    if (url.pathname.endsWith('/')) file = path.join(file, 'index.html');
    if (!file.startsWith(www) || !fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('content-type', TYPES[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log('ALL FOR ONE test server on http://localhost:' + port));
}
module.exports = { createServer };
