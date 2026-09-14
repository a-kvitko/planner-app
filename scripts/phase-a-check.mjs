/**
 * Phase A self-check: validatePayload keeps tags/settings/schemaVersion/updatedAt;
 * title hint parse via browser is checked separately.
 * Run: node scripts/phase-a-check.mjs
 */
import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'planner-data.json');
const PORT = 3849;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const before = await fs.readFile(DATA_FILE, 'utf8');
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

    const payload = {
      tasks: [{ id: 't1', text: 'P3 Wait — check Orlova [TDWEB-1] x', done: false }],
      notes: [],
      goals: [],
      journal: [],
      tags: [{ id: 'tag1', name: 'Do', order: 0 }],
      settings: { maxDoItems: 3, noWeekends: true },
      schemaVersion: 2,
      updatedAt: '2026-09-13T20:00:00.000Z',
    };

    const saveRes = await fetch(`http://127.0.0.1:${PORT}/api/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert(saveRes.ok, `/api/save status ${saveRes.status}`);

    const file = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    assert(Array.isArray(file.tags) && file.tags.length === 1, 'tags not preserved');
    assert(file.settings && file.settings.maxDoItems === 3, 'settings not preserved');
    assert(file.schemaVersion === 2, 'schemaVersion not preserved');
    assert(file.updatedAt === payload.updatedAt, 'updatedAt not preserved');

    const js = await fetch(`http://127.0.0.1:${PORT}/js/planner-db.js`);
    assert(js.status === 200, 'js still served');

    console.log('phase-a-check: ok');
  } finally {
    child.kill('SIGTERM');
    await wait(100);
    await fs.writeFile(DATA_FILE, before, 'utf8');
  }
}

main().catch(async (err) => {
  console.error('phase-a-check: FAIL', err.message);
  process.exit(1);
});
