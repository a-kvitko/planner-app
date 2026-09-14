/**
 * Phase 0 self-check: /js static serving + path escape guard.
 * Run: node scripts/phase0-check.mjs
 */
import http from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const PORT = 3848; // avoid clashing with a running npm start

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchText(url) {
  const res = await fetch(url);
  const text = await res.text();
  return { status: res.status, type: res.headers.get('content-type') || '', text };
}

async function main() {
  const child = spawn(process.execPath, ['server.mjs'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let boot = '';
  child.stdout.on('data', (c) => {
    boot += c.toString();
  });
  child.stderr.on('data', (c) => {
    boot += c.toString();
  });

  try {
    for (let i = 0; i < 40; i++) {
      if (boot.includes(`:${PORT}`)) break;
      await wait(50);
    }

    const js = await fetchText(`http://127.0.0.1:${PORT}/js/planner-db.js`);
    assert(js.status === 200, `expected /js/planner-db.js 200, got ${js.status}`);
    assert(js.type.includes('javascript'), `expected javascript MIME, got ${js.type}`);
    assert(js.text.includes('export async function loadState'), 'planner-db.js body missing loadState');
    assert(js.text.includes('Dexie'), 'planner-db.js body missing Dexie');

    const escape = await fetchText(`http://127.0.0.1:${PORT}/js/../package.json`);
    assert(escape.status === 403 || escape.status === 404, `path escape should fail, got ${escape.status}`);

    const root = await fetchText(`http://127.0.0.1:${PORT}/`);
    assert(root.status === 200, `expected / 200, got ${root.status}`);

    console.log('phase0-check: ok');
  } finally {
    child.kill('SIGTERM');
    await wait(100);
  }
}

main().catch((err) => {
  console.error('phase0-check: FAIL', err.message);
  process.exit(1);
});
