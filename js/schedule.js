/**
 * Workday schedule helpers for Planner.
 * noWeekends: Sat/Sun snap forward to Monday.
 */

/** @param {Date} [d] */
export function todayYmd(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse YYYY-MM-DD as local calendar date. */
export function parseYmdLocal(ymd) {
  const m = String(ymd || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * If noWeekends and date is Sat/Sun, snap to next Monday.
 * @param {string|null} ymd
 * @param {boolean} [noWeekends=true]
 * @returns {string|null}
 */
export function snapToWorkday(ymd, noWeekends = true) {
  if (ymd == null || ymd === '') return null;
  const d = parseYmdLocal(ymd);
  if (!d) return null;
  if (!noWeekends) return todayYmd(d);
  const dow = d.getDay(); // 0 Sun … 6 Sat
  if (dow === 0) d.setDate(d.getDate() + 1);
  else if (dow === 6) d.setDate(d.getDate() + 2);
  return todayYmd(d);
}

/** Add calendar days to YYYY-MM-DD (local). */
export function addDaysYmd(ymd, n) {
  const d = parseYmdLocal(ymd);
  if (!d) return null;
  d.setDate(d.getDate() + Number(n) || 0);
  return todayYmd(d);
}

const UPCOMING_KINDS = new Set(['do', 'ongoing', 'promise', 'wait']);

function normalizeKindLite(k) {
  let s = String(k || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
  if (s === 'in progress' || s === 'in-progress' || s === 'inprogress') s = 'ongoing';
  return s;
}

/**
 * Open task with a day that is not Today → lives on Upcoming (past or future).
 * Past unfinished dated tasks stay on their original day; they do not become Backlog.
 */
export function isUpcomingTask(t, today) {
  if (!t || t.done || !t.scheduledOn) return false;
  if (t.scheduledOn === today) return false;
  return UPCOMING_KINDS.has(normalizeKindLite(t.kind));
}

/**
 * Backlog = undated / unscheduled open items only.
 * Anything with scheduledOn stays on that day (Today or Upcoming).
 */
export function isBacklogOpenTask(t) {
  if (!t || t.done) return false;
  return !t.scheduledOn;
}

/**
 * Upcoming days: past unfinished scheduled days (sparse), then tomorrow→horizon continuous,
 * then sparse far-future dates. Today is owned by the Today panel.
 * @param {string} today
 * @param {string[]} scheduledYmds dates with open tasks (any order; may include past)
 * @param {{ minHorizon?: number, maxFill?: number }} [opts]
 * @returns {string[]}
 */
export function buildUpcomingDateRange(today, scheduledYmds = [], opts = {}) {
  const minHorizon = opts.minHorizon == null ? 14 : opts.minHorizon;
  const maxFill = opts.maxFill == null ? 45 : opts.maxFill;
  const past = [...new Set(
    (scheduledYmds || []).filter((y) => y && y < today && parseYmdLocal(y))
  )].sort();
  const start = addDaysYmd(today, 1);
  if (!start) return past;
  let last = addDaysYmd(start, Math.max(0, minHorizon - 1));
  for (const y of scheduledYmds) {
    if (!y || y <= today) continue;
    if (!parseYmdLocal(y)) continue;
    if (!last || y > last) last = y;
  }
  const fillEnd = addDaysYmd(start, Math.max(0, maxFill - 1)) || start;
  const continuousEnd = last && last < fillEnd ? last : fillEnd;
  const out = [];
  let cur = start;
  while (cur && cur <= continuousEnd) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
  }
  if (last && last > fillEnd) {
    const extra = [...new Set(scheduledYmds.filter((y) => y > fillEnd && parseYmdLocal(y)))].sort();
    for (const y of extra) out.push(y);
  }
  return past.concat(out);
}

/** Runnable self-check: node --input-type=module -e "import('./js/schedule.js').then(m=>m._selfCheck())" */
export function _selfCheck() {
  const sat = snapToWorkday('2026-09-12', true); // Sat
  const sun = snapToWorkday('2026-09-13', true); // Sun
  const mon = snapToWorkday('2026-09-14', true);
  if (sat !== '2026-09-14') throw new Error('Sat→Mon failed: ' + sat);
  if (sun !== '2026-09-14') throw new Error('Sun→Mon failed: ' + sun);
  if (mon !== '2026-09-14') throw new Error('Mon intact failed: ' + mon);
  if (snapToWorkday('2026-09-12', false) !== '2026-09-12') throw new Error('weekend allow failed');
  if (addDaysYmd('2026-10-07', 1) !== '2026-10-08') throw new Error('addDaysYmd failed');
  const range = buildUpcomingDateRange('2026-10-07', ['2026-10-10'], { minHorizon: 3, maxFill: 10 });
  if (range[0] !== '2026-10-08') throw new Error('upcoming start failed: ' + range[0]);
  if (!range.includes('2026-10-10')) throw new Error('upcoming missing scheduled day');
  if (range.length !== 3) throw new Error('upcoming horizon length: ' + range.length);
  const sparse = buildUpcomingDateRange('2026-10-07', ['2026-12-01'], { minHorizon: 2, maxFill: 3 });
  if (!sparse.includes('2026-12-01')) throw new Error('upcoming sparse failed');
  if (sparse.filter((y) => y > '2026-10-10' && y < '2026-12-01').length) throw new Error('upcoming filled too far');
  const withPast = buildUpcomingDateRange('2026-10-08', ['2026-10-07', '2026-10-10'], { minHorizon: 2, maxFill: 5 });
  if (withPast[0] !== '2026-10-07') throw new Error('past day should lead upcoming: ' + withPast[0]);
  if (!withPast.includes('2026-10-10')) throw new Error('future day missing with past');
  if (withPast.includes('2026-10-08')) throw new Error('today must not appear in upcoming range');
  const pastTask = { done: false, kind: 'do', scheduledOn: '2026-10-07' };
  const todayTask = { done: false, kind: 'do', scheduledOn: '2026-10-08' };
  const undated = { done: false, kind: 'do', scheduledOn: null };
  if (!isUpcomingTask(pastTask, '2026-10-08')) throw new Error('past dated must stay upcoming');
  if (isBacklogOpenTask(pastTask)) throw new Error('past dated must not be backlog');
  if (isUpcomingTask(todayTask, '2026-10-08')) throw new Error('today must not be upcoming');
  if (isBacklogOpenTask(todayTask)) throw new Error('today dated must not be backlog');
  if (isUpcomingTask(undated, '2026-10-08')) throw new Error('undated must not be upcoming');
  if (!isBacklogOpenTask(undated)) throw new Error('undated must be backlog');
  console.log('schedule self-check: ok');
}
