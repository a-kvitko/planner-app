/**
 * Typed patch ops + day/week views for Planner agent API.
 * Shared by server (Node) — no DOM.
 */
import { snapToWorkday, todayYmd, parseYmdLocal } from './schedule.js';
import { computeDayCapacity } from './capacity.js';

const KINDS = ['ongoing', 'do', 'wait', 'promise', 'park'];
const PRIOS = ['p1', 'p2', 'p3', 'p4'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function findTask(state, id) {
  return (state.tasks || []).find((t) => t && t.id === id) || null;
}

function normalizeKind(k) {
  let s = String(k || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  if (s === 'in progress' || s === 'in-progress' || s === 'inprogress') s = 'ongoing';
  return KINDS.includes(s) ? s : 'do';
}

function normalizePriority(p) {
  const s = String(p || '').toLowerCase();
  return PRIOS.includes(s) ? s : 'p3';
}

function ymdOrNull(v, settings) {
  if (v == null || v === '') return null;
  const noWeekends = !(settings && settings.noWeekends === false);
  return snapToWorkday(String(v), noWeekends);
}

function applyOne(state, op) {
  const name = op && op.op;
  if (!name) throw new Error('missing op');

  if (name === 'createTask') {
    const text = String(op.text || '').trim();
    if (!text) throw new Error('createTask requires text');
    const kind = normalizeKind(op.kind);
    const task = {
      id: op.id && String(op.id) ? String(op.id) : uid(),
      text,
      description: op.description != null ? String(op.description) : '',
      cat: op.cat || 'work',
      priority: normalizePriority(op.priority),
      tagIds: Array.isArray(op.tagIds) ? op.tagIds : [],
      done: false,
      milestones: [],
      comments: [],
      links: [],
      progress: 0,
      ts: Date.now(),
      kind,
      scheduledOn: ymdOrNull(op.scheduledOn, state.settings),
      deadline: ymdOrNull(op.deadline, state.settings),
      waitingOn: op.waitingOn != null ? String(op.waitingOn) : null,
      promisedTo: op.promisedTo != null ? String(op.promisedTo) : null,
      nextCheckAt: ymdOrNull(op.nextCheckAt, state.settings),
      timeEstimateMin: op.timeEstimateMin != null ? Number(op.timeEstimateMin) : null,
      completedAt: null,
      rolloverCount: 0,
      project: op.project != null ? String(op.project) : null,
      jiraKey: op.jiraKey != null ? String(op.jiraKey) : null,
    };
    if (kind === 'wait' && !task.waitingOn && op.waitingOn == null) {
      /* allow empty; agent should set waitingOn */
    }
    if (!Array.isArray(state.tasks)) state.tasks = [];
    state.tasks.push(task);
    return { ok: true, op: name, id: task.id };
  }

  if (name === 'complete') {
    const t = findTask(state, op.id);
    if (!t) throw new Error('task not found');
    const done = op.done !== false;
    t.done = done;
    t.completedAt = done ? new Date().toISOString() : null;
    return { ok: true, op: name, id: t.id, done };
  }

  if (name === 'setKind') {
    const t = findTask(state, op.id);
    if (!t) throw new Error('task not found');
    const kind = normalizeKind(op.kind);
    t.kind = kind;
    if (kind === 'wait') {
      t.priority = 'p3';
      if (op.waitingOn != null) t.waitingOn = String(op.waitingOn) || null;
      if (op.nextCheckAt !== undefined) t.nextCheckAt = ymdOrNull(op.nextCheckAt, state.settings);
    }
    if (kind === 'promise') {
      if (op.promisedTo != null) t.promisedTo = String(op.promisedTo) || null;
      if (op.deadline !== undefined) t.deadline = ymdOrNull(op.deadline, state.settings);
    }
    return { ok: true, op: name, id: t.id, kind };
  }

  if (name === 'setPriority') {
    const t = findTask(state, op.id);
    if (!t) throw new Error('task not found');
    t.priority = normalizePriority(op.priority);
    return { ok: true, op: name, id: t.id, priority: t.priority };
  }

  if (name === 'schedule') {
    const t = findTask(state, op.id);
    if (!t) throw new Error('task not found');
    t.scheduledOn = ymdOrNull(op.scheduledOn, state.settings);
    if (t.kind === 'park' && t.scheduledOn) t.kind = 'do';
    return { ok: true, op: name, id: t.id, scheduledOn: t.scheduledOn };
  }

  if (name === 'setEstimate') {
    const t = findTask(state, op.id);
    if (!t) throw new Error('task not found');
    if (op.timeEstimateMin == null || op.timeEstimateMin === '') t.timeEstimateMin = null;
    else {
      const n = Number(op.timeEstimateMin);
      if (!Number.isFinite(n) || n < 0) throw new Error('invalid timeEstimateMin');
      t.timeEstimateMin = n;
    }
    return { ok: true, op: name, id: t.id, timeEstimateMin: t.timeEstimateMin };
  }

  if (name === 'setProject') {
    const t = findTask(state, op.id);
    if (!t) throw new Error('task not found');
    t.project = op.project == null || op.project === '' ? null : String(op.project);
    return { ok: true, op: name, id: t.id, project: t.project };
  }

  if (name === 'prependNote') {
    const t = findTask(state, op.id);
    if (!t) throw new Error('task not found');
    const note = String(op.text || '').trim();
    if (!note) throw new Error('prependNote requires text');
    const stamp = todayYmd();
    const line = `${stamp} — ${note}`;
    const prev = t.description != null ? String(t.description) : '';
    t.description = prev ? `${line}\n${prev}` : line;
    return { ok: true, op: name, id: t.id };
  }

  if (name === 'reorder') {
    const ids = Array.isArray(op.ids) ? op.ids.map(String) : [];
    if (!ids.length) throw new Error('reorder requires ids');
    const byId = new Map((state.tasks || []).map((t) => [t.id, t]));
    const used = new Set();
    const ordered = [];
    for (const id of ids) {
      if (!byId.has(id) || used.has(id)) continue;
      ordered.push(byId.get(id));
      used.add(id);
    }
    for (const t of state.tasks || []) {
      if (!used.has(t.id)) ordered.push(t);
    }
    state.tasks = ordered;
    return { ok: true, op: name, count: ordered.length };
  }

  if (name === 'delete') {
    const before = (state.tasks || []).length;
    state.tasks = (state.tasks || []).filter((t) => t.id !== op.id);
    if (state.tasks.length === before) throw new Error('task not found');
    return { ok: true, op: name, id: op.id };
  }

  throw new Error('unknown op: ' + name);
}

/**
 * @param {object} state
 * @param {object[]} ops
 * @returns {{ state: object, results: object[] }}
 */
export function applyOps(state, ops) {
  const next = clone(state || { tasks: [], notes: [], goals: [], journal: [], tags: [], settings: {} });
  if (!Array.isArray(next.tasks)) next.tasks = [];
  const results = [];
  const seen = new Set();
  for (const op of ops || []) {
    if (op && op.opId) {
      const id = String(op.opId);
      if (seen.has(id)) {
        results.push({ ok: true, skipped: true, opId: id });
        continue;
      }
      seen.add(id);
    }
    try {
      const r = applyOne(next, op || {});
      if (op && op.opId) r.opId = String(op.opId);
      results.push(r);
    } catch (e) {
      results.push({ ok: false, error: e.message || String(e), op: op && op.op, opId: op && op.opId });
    }
  }
  next.updatedAt = new Date().toISOString();
  next.schemaVersion = typeof next.schemaVersion === 'number' ? Math.max(next.schemaVersion, 2) : 2;
  return { state: next, results };
}

export function buildDayView(state, date) {
  const ymd = date || todayYmd();
  const capacity = computeDayCapacity(ymd, (state && state.settings) || {}, (state && state.tasks) || []);
  const tasks = ((state && state.tasks) || []).filter((t) => t && !t.done && t.scheduledOn === ymd);
  const sections = {
    ongoing: tasks.filter((t) => t.kind === 'ongoing'),
    do: tasks.filter((t) => t.kind === 'do'),
    promise: tasks.filter((t) => t.kind === 'promise'),
    wait: tasks.filter((t) => t.kind === 'wait'),
    other: tasks.filter((t) => !['do', 'ongoing', 'promise', 'wait'].includes(t.kind)),
  };
  return { date: ymd, capacity, sections, overload: !!capacity.overload };
}

export function buildWeekView(state, start) {
  let d = parseYmdLocal(start);
  if (!d) d = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) {
    const ymd = todayYmd(d);
    days.push(buildDayView(state, ymd));
    d.setDate(d.getDate() + 1);
  }
  return { start: days[0].date, days };
}

export function _selfCheck() {
  const state = {
    tasks: [],
    settings: { noWeekends: true, maxDoItems: 5, workDayMinutes: 480, lunchMinutes: 30, commsBlockMinutes: 90 },
  };
  const { state: s1, results } = applyOps(state, [
    { op: 'createTask', opId: 'a', text: 'Do thing', kind: 'do', scheduledOn: '2026-09-14' },
    { op: 'createTask', opId: 'a', text: 'dup', kind: 'do' },
  ]);
  if (results[1].skipped !== true) throw new Error('opId not idempotent');
  if (s1.tasks.length !== 1) throw new Error('unexpected task count');
  const id = s1.tasks[0].id;
  const { state: s2 } = applyOps(s1, [
    { op: 'setKind', id, kind: 'wait', waitingOn: 'Orlova' },
    { op: 'schedule', id, scheduledOn: '2026-09-12' }, // Sat → Mon
  ]);
  if (s2.tasks[0].priority !== 'p3') throw new Error('wait should demote p3');
  if (s2.tasks[0].scheduledOn !== '2026-09-14') throw new Error('weekend snap failed');
  const day = buildDayView(s2, '2026-09-14');
  if (day.sections.wait.length !== 1) throw new Error('day wait section empty');
  const { state: s3 } = applyOps(s2, [{ op: 'setKind', id, kind: 'ongoing' }]);
  const dayOn = buildDayView(s3, '2026-09-14');
  if (dayOn.sections.ongoing.length !== 1) throw new Error('day ongoing section empty');
  if (dayOn.capacity.doCount !== 0) throw new Error('ongoing must not count as Do');
  console.log('api-ops self-check: ok');
}
