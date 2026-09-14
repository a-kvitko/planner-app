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

/** Runnable self-check: node --input-type=module -e "import('./js/schedule.js').then(m=>m._selfCheck())" */
export function _selfCheck() {
  const sat = snapToWorkday('2026-09-12', true); // Sat
  const sun = snapToWorkday('2026-09-13', true); // Sun
  const mon = snapToWorkday('2026-09-14', true);
  if (sat !== '2026-09-14') throw new Error('Sat→Mon failed: ' + sat);
  if (sun !== '2026-09-14') throw new Error('Sun→Mon failed: ' + sun);
  if (mon !== '2026-09-14') throw new Error('Mon intact failed: ' + mon);
  if (snapToWorkday('2026-09-12', false) !== '2026-09-12') throw new Error('weekend allow failed');
  console.log('schedule self-check: ok');
}
