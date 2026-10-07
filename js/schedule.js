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

/**
 * Continuous Upcoming days from tomorrow through horizon, Things-style.
 * Fills empty days up to maxFill; farther scheduled dates append as sparse days.
 * @param {string} today
 * @param {string[]} scheduledYmds future dates (any order)
 * @param {{ minHorizon?: number, maxFill?: number }} [opts]
 * @returns {string[]}
 */
export function buildUpcomingDateRange(today, scheduledYmds = [], opts = {}) {
  const minHorizon = opts.minHorizon == null ? 14 : opts.minHorizon;
  const maxFill = opts.maxFill == null ? 45 : opts.maxFill;
  const start = addDaysYmd(today, 1);
  if (!start) return [];
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
  return out;
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
  console.log('schedule self-check: ok');
}
