import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { applyOps, buildDayView, buildWeekView } from './js/api-ops.js';
import { todayYmd } from './js/schedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, 'planner-data.json');
const PORT = Number(process.env.PORT) || 3847;

const STATIC_ROOT_FILES = new Set(['planner.html', 'planner-data.json']);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

/** Serve a file only if it resolves under `subdir` of the app root (no path escape). */
function safePathUnder(subdir, name) {
  const root = path.resolve(path.join(__dirname, subdir));
  const resolved = path.resolve(path.join(__dirname, name));
  const rel = path.relative(root, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}

function validatePayload(body) {
  if (typeof body !== 'object' || body === null) return null;
  const out = {
    tasks: Array.isArray(body.tasks) ? body.tasks : [],
    notes: Array.isArray(body.notes) ? body.notes : [],
    goals: Array.isArray(body.goals) ? body.goals : [],
    journal: Array.isArray(body.journal) ? body.journal : [],
  };
  if (Array.isArray(body.tags)) out.tags = body.tags;
  if (body.settings && typeof body.settings === 'object' && !Array.isArray(body.settings)) {
    out.settings = body.settings;
  }
  if (typeof body.schemaVersion === 'number') out.schemaVersion = body.schemaVersion;
  if (typeof body.updatedAt === 'string') out.updatedAt = body.updatedAt;
  return out;
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function loadState() {
  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const parsed = JSON.parse(raw);
  const normalized = validatePayload(parsed);
  if (!normalized) throw new Error('invalid state file');
  return normalized;
}

async function saveState(state) {
  const normalized = validatePayload(state);
  if (!normalized) throw new Error('invalid state');
  await fs.writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
  return normalized;
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);

  try {
    if (req.method === 'GET' && url.pathname === '/api/state') {
      const state = await loadState();
      json(res, 200, state);
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/day') {
      const state = await loadState();
      const date = url.searchParams.get('date') || todayYmd();
      json(res, 200, buildDayView(state, date));
      return;
    }

    if (req.method === 'GET' && url.pathname === '/api/week') {
      const state = await loadState();
      const start = url.searchParams.get('start') || todayYmd();
      json(res, 200, buildWeekView(state, start));
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/patch') {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const ops = parsed && Array.isArray(parsed.ops) ? parsed.ops : null;
      if (!ops) {
        json(res, 400, { ok: false, error: 'body.ops array required' });
        return;
      }
      const dryRun = url.searchParams.get('dryRun') === '1' || parsed.dryRun === true;
      const state = await loadState();
      const { state: next, results } = applyOps(state, ops);
      const failed = results.some((r) => r.ok === false);
      if (dryRun) {
        const date = url.searchParams.get('date') || todayYmd();
        json(res, failed ? 207 : 200, {
          ok: !failed,
          dryRun: true,
          results,
          day: buildDayView(next, date),
          week: buildWeekView(next, date),
        });
        return;
      }
      if (failed) {
        json(res, 400, { ok: false, results });
        return;
      }
      const saved = await saveState(next);
      json(res, 200, { ok: true, results, updatedAt: saved.updatedAt });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/api/save') {
      const raw = await readBody(req);
      const parsed = JSON.parse(raw);
      const normalized = validatePayload(parsed);
      if (!normalized) {
        json(res, 400, { ok: false, error: 'Invalid payload' });
        return;
      }
      await fs.writeFile(DATA_FILE, JSON.stringify(normalized, null, 2), 'utf8');
      json(res, 200, { ok: true });
      return;
    }
  } catch (e) {
    if (e instanceof SyntaxError) {
      json(res, 400, { ok: false, error: 'Bad JSON' });
      return;
    }
    json(res, 500, { ok: false, error: e.message || 'Server error' });
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
    filePath = safePathUnder('assets', name);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
  } else if (name.startsWith('js/')) {
    filePath = safePathUnder('js', name);
    if (!filePath) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
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
