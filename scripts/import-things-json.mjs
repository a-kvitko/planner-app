#!/usr/bin/env node
/**
 * Merge a Things dump JSON into Planner via GET /api/state + POST /api/save.
 * Dedupe: skip if open task has same jiraKey or normalized title.
 *
 * Usage: node scripts/import-things-json.mjs [path-to-dump.json]
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { snapToWorkday } from '../js/schedule.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PLANNER_URL || 'http://127.0.0.1:3847';
const dumpPath =
  process.argv[2] ||
  path.join(__dirname, '../backups/things-work-dump-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '.json');

const KINDS = ['do', 'wait', 'promise', 'park'];
const PRIOS = ['p1', 'p2', 'p3', 'p4'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function normalizeKind(k) {
  const s = String(k || '').toLowerCase();
  return KINDS.includes(s) ? s : 'do';
}

function normalizePriority(p) {
  const s = String(p || '').toLowerCase();
  return PRIOS.includes(s) ? s : 'p3';
}

function parseTaskTitleHints(text) {
  const raw = String(text || '');
  const out = {};
  const jira = raw.match(/\[([A-Z][A-Z0-9]+-\d+)\]/);
  if (jira) out.jiraKey = jira[1];
  const p = raw.match(/\bP([1-4])(?:\.\d+)?\b/i);
  if (p) out.priorityFromTitle = 'p' + p[1];
  const kindM =
    raw.match(/\bP[1-4](?:\.\d+)?\s+(Do|Wait|Promise|Park)\b/i) ||
    raw.match(/^(Do|Wait|Promise|Park)\s*[—\-:–]\s*/i);
  if (kindM) out.kindFromTitle = kindM[1].toLowerCase();
  return out;
}

function tagsList(item) {
  const raw = item.tags || item.tag || [];
  if (!Array.isArray(raw)) return [String(raw)];
  return raw.map((t) => (typeof t === 'string' ? t : (t && t.name) || '')).filter(Boolean);
}

function normTitle(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/^p[1-4](?:\.\d+)?\s+(do|wait|promise|park)\s*[—\-:–]?\s*/i, '')
    .replace(/^p[1-4](?:\.\d+)?[.\s—\-–]+/i, '')
    .trim();
}

function mapThingsItemToTask(item) {
  const title = String(item.title || item.text || item.name || '').trim();
  if (!title) return null;
  const tags = tagsList(item).map((t) => t.toLowerCase());
  let kind = 'do';
  if (tags.some((t) => t === 'wait' || t === 'waiting')) kind = 'wait';
  else if (tags.some((t) => t === 'promise')) kind = 'promise';
  else if (tags.some((t) => t === 'park' || t === 'someday')) kind = 'park';
  let priority = null;
  for (const p of PRIOS) {
    if (tags.includes(p)) priority = p;
  }
  const hints = parseTaskTitleHints(title);
  if (!priority && hints.priorityFromTitle) priority = hints.priorityFromTitle;
  if (kind === 'do' && hints.kindFromTitle) kind = normalizeKind(hints.kindFromTitle);
  if (kind === 'wait') priority = 'p3';
  const when = item.when || item.activation || item.scheduledOn || item.startDate || null;
  const deadline = item.deadline || item.due || null;
  const notes =
    item.notes != null
      ? String(item.notes)
      : item.description != null
        ? String(item.description)
        : '';
  const scheduledOn = when ? snapToWorkday(String(when).slice(0, 10), true) : null;
  return {
    id: uid(),
    text: title,
    description: notes,
    cat: 'work',
    priority: normalizePriority(priority || 'p3'),
    done: !!(item.done || item.completed),
    milestones: [],
    comments: [],
    links: [],
    tagIds: [],
    progress: 0,
    ts: Date.now(),
    kind: normalizeKind(kind),
    scheduledOn,
    deadline: deadline ? String(deadline).slice(0, 10) : null,
    waitingOn: kind === 'wait' ? (item.waitingOn != null ? String(item.waitingOn) : null) : null,
    promisedTo: kind === 'promise' ? (item.promisedTo != null ? String(item.promisedTo) : null) : null,
    nextCheckAt: null,
    timeEstimateMin: null,
    completedAt: null,
    rolloverCount: 0,
    project: item.project || item.area || item.areaName || null,
    jiraKey: hints.jiraKey || null,
  };
}

async function main() {
  const raw = await fs.readFile(dumpPath, 'utf8');
  const parsed = JSON.parse(raw);
  let items = [];
  if (Array.isArray(parsed)) items = parsed;
  else if (Array.isArray(parsed.items)) items = parsed.items;
  else if (Array.isArray(parsed.tasks)) items = parsed.tasks;
  else if (Array.isArray(parsed.todos)) items = parsed.todos;
  else throw new Error('Unrecognized dump shape');

  const stateRes = await fetch(`${BASE}/api/state`);
  if (!stateRes.ok) throw new Error(`GET /api/state ${stateRes.status}`);
  const state = await stateRes.json();
  if (!Array.isArray(state.tasks)) state.tasks = [];

  const open = state.tasks.filter((t) => t && !t.done);
  const byJira = new Set(open.map((t) => t.jiraKey).filter(Boolean));
  const byTitle = new Set(open.map((t) => normTitle(t.text)).filter(Boolean));

  const imported = [];
  const skipped = [];
  const kindCounts = { do: 0, wait: 0, promise: 0, park: 0 };

  for (const item of items) {
    const task = mapThingsItemToTask(item);
    if (!task || task.done) {
      skipped.push({ reason: 'empty-or-done', title: item.title || item.text });
      continue;
    }
    const nt = normTitle(task.text);
    if (task.jiraKey && byJira.has(task.jiraKey)) {
      skipped.push({ reason: 'jiraKey', jiraKey: task.jiraKey, title: task.text });
      continue;
    }
    if (nt && byTitle.has(nt)) {
      skipped.push({ reason: 'title', title: task.text });
      continue;
    }
    state.tasks.push(task);
    imported.push(task);
    kindCounts[task.kind] = (kindCounts[task.kind] || 0) + 1;
    if (task.jiraKey) byJira.add(task.jiraKey);
    if (nt) byTitle.add(nt);
  }

  state.updatedAt = new Date().toISOString();
  if (typeof state.schemaVersion !== 'number') state.schemaVersion = 2;

  const saveRes = await fetch(`${BASE}/api/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
  if (!saveRes.ok) {
    const err = await saveRes.text();
    throw new Error(`POST /api/save ${saveRes.status}: ${err}`);
  }

  console.log(
    JSON.stringify(
      {
        dump: dumpPath,
        imported: imported.length,
        skipped: skipped.length,
        kindCounts,
        skippedSample: skipped.slice(0, 12),
        totalOpenTasks: state.tasks.filter((t) => !t.done).length,
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
