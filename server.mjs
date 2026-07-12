import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'planner-data.json');
const PORT = Number(process.env.PORT) || 3847;

const STATIC_ROOT_FILES = new Set(['planner.html', 'planner-data.json']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

function validatePayload(body) {
  if (typeof body !== 'object' || body === null) return null;
  return {
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    notes: Array.isArray(body.notes) ? body.notes : [],
    goals: Array.isArray(body.goals) ? body.goals : [],
    journal: Array.isArray(body.journal) ? body.journal : [],
  };
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/api/save') {
    try {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const normalized = validatePayload(parsed);
      if (!normalized) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'Invalid payload' }));
        return;
      }
      await fs.writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'Bad JSON' }));
    }
    return;
  }

  const name =
    url.pathname === '/' || url.pathname === ''
      ? 'planner.html'
      : decodeURIComponent(url.pathname.replace(/^\/+/, ''));

  let filePath;
  if (STATIC_ROOT_FILES.has(name)) {
    filePath = path.join(__dirname, name);
  } else if (name.startsWith('assets/')) {
    const assetsRoot = path.resolve(path.join(__dirname, 'assets'));
    const resolved = path.resolve(path.join(__dirname, name));
    const rel = path.relative(assetsRoot, resolved);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    filePath = resolved;
  } else {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(name);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(buf);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`Planner: http://127.0.0.1:${PORT}/`);
});
