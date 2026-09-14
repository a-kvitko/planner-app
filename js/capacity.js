/**
 * Day capacity from recurring week template + settings overrides.
 * Wait checks are separate from Do/Promise minutes.
 */
import { parseYmdLocal, todayYmd } from './schedule.js';

export const DEFAULT_ESTIMATE_MIN = 45;

/** Mon=1 … Fri=5 (Date.getDay() Sunday=0). */
export const DEFAULT_WEEK_TEMPLATE = [
  { days: [1, 3, 5], title: 'TDW Standup', minutes: 30 },
  { days: [2, 4], title: 'TDW BA – Canadianization', minutes: 45 },
  { days: [2, 4], title: 'TDW design team sync', minutes: 60 },
  { days: [2], title: 'Design text sync', minutes: 10 },
  { days: [5], title: 'Weekly DXd text sync', minutes: 10 },
  { days: [3], title: 'Mobile work discussion', minutes: 60 },
  { days: [3], title: 'TDW mobile design sync', minutes: 60 },
  { days: [5], title: '1:1 Olya', minutes: 45 },
  { days: [5], title: '1:1 Kolya', minutes: 45 },
];

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function weeksBetween(a, b) {
  const ms = b.getTime() - a.getTime();
  return Math.floor(ms / (7 * 24 * 60 * 60 * 1000));
}

/** Biweekly Wed 1:1 — Dima/Mimi alternating from anchor Wednesday. */
export function wedOneOnOneFor(ymd, settings = {}) {
  const d = parseYmdLocal(ymd);
  if (!d || d.getDay() !== 3) return null;
  const rot = settings.wedOneOnOneRotation && typeof settings.wedOneOnOneRotation === 'object'
    ? settings.wedOneOnOneRotation
    : {};
  const anchorYmd = rot.anchorYmd || '2026-01-07';
  const anchor = parseYmdLocal(anchorYmd) || parseYmdLocal('2026-01-07');
  const first = rot.first === 'Mimi' ? 'Mimi' : 'Dima';
  const second = first === 'Dima' ? 'Mimi' : 'Dima';
  const w = weeksBetween(anchor, d);
  const name = w % 2 === 0 ? first : second;
  return { title: `1:1 ${name}`, minutes: 45, person: name };
}

export function templateBlocksForDay(ymd, settings = {}) {
  const d = parseYmdLocal(ymd);
  if (!d) return [];
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return [];
  const tpl = Array.isArray(settings.weekTemplate) && settings.weekTemplate.length
    ? settings.weekTemplate
    : DEFAULT_WEEK_TEMPLATE;
  const blocks = [];
  for (const row of tpl) {
    const days = Array.isArray(row.days) ? row.days : [];
    if (!days.includes(dow)) continue;
    const minutes = num(row.minutes, 0);
    if (minutes <= 0) continue;
    blocks.push({ title: String(row.title || 'Meeting'), minutes, source: 'template' });
  }
  const wed = wedOneOnOneFor(ymd, settings);
  if (wed) blocks.push({ ...wed, source: 'rotation' });
  return blocks;
}

export function dayOverride(ymd, settings = {}) {
  const map = settings.dayOverrides && typeof settings.dayOverrides === 'object'
    ? settings.dayOverrides
    : {};
  const o = map[ymd];
  if (!o || typeof o !== 'object') return { extraMeetingMin: 0, note: '' };
  return {
    extraMeetingMin: Math.max(0, num(o.extraMeetingMin, 0)),
    note: o.note != null ? String(o.note) : ''
  };
}

function estimateMin(task, defaultEst) {
  if (task == null || task.timeEstimateMin == null || task.timeEstimateMin === '') return defaultEst;
  const n = Number(task.timeEstimateMin);
  if (!Number.isFinite(n) || n < 0) return defaultEst;
  return n;
}

/**
 * @param {string} ymd
 * @param {object} settings
 * @param {object[]} tasks
 */
export function computeDayCapacity(ymd, settings = {}, tasks = []) {
  const workDayMinutes = num(settings.workDayMinutes, 480);
  const lunchMinutes = num(settings.lunchMinutes, 30);
  const commsBlockMinutes = num(settings.commsBlockMinutes, 90);
  const maxDoItems = num(settings.maxDoItems, 5);
  const maxWaitChecks = num(settings.maxWaitChecks, 5);
  const defaultEst = num(settings.defaultEstimateMin, DEFAULT_ESTIMATE_MIN);

  const d = parseYmdLocal(ymd);
  const isWeekend = !d || d.getDay() === 0 || d.getDay() === 6;

  const meetingBlocks = isWeekend ? [] : templateBlocksForDay(ymd, settings);
  const override = dayOverride(ymd, settings);
  if (override.extraMeetingMin > 0) {
    meetingBlocks.push({
      title: override.note || 'Extra meeting',
      minutes: override.extraMeetingMin,
      source: 'override'
    });
  }

  const meetingMinutes = meetingBlocks.reduce((s, b) => s + b.minutes, 0);
  const availableDoMinutes = isWeekend
    ? 0
    : Math.max(0, workDayMinutes - lunchMinutes - meetingMinutes - commsBlockMinutes);

  const dayTasks = (tasks || []).filter(t => t && !t.done && t.scheduledOn === ymd);
  const doPromise = dayTasks.filter(t => t.kind === 'do' || t.kind === 'promise');
  const waits = dayTasks.filter(t => t.kind === 'wait');
  const plannedDoMinutes = doPromise.reduce((s, t) => s + estimateMin(t, defaultEst), 0);
  const doCount = doPromise.length;
  const waitCount = waits.length;

  return {
    ymd,
    isWeekend,
    workDayMinutes,
    lunchMinutes,
    commsBlockMinutes,
    meetingMinutes,
    meetingBlocks,
    extraMeetingMin: override.extraMeetingMin,
    overrideNote: override.note,
    availableDoMinutes,
    plannedDoMinutes,
    doCount,
    waitCount,
    maxDoItems,
    maxWaitChecks,
    defaultEstimateMin: defaultEst,
    overloadCount: doCount > maxDoItems,
    overloadMinutes: plannedDoMinutes > availableDoMinutes,
    overload: doCount > maxDoItems || plannedDoMinutes > availableDoMinutes
  };
}

export function _selfCheck() {
  const settings = {
    workDayMinutes: 480,
    lunchMinutes: 30,
    commsBlockMinutes: 90,
    maxDoItems: 5,
    defaultEstimateMin: 45,
    wedOneOnOneRotation: { anchorYmd: '2026-01-07', first: 'Dima' },
    dayOverrides: {}
  };
  const wed = computeDayCapacity('2026-09-16', settings, []); // Wed
  const mon = computeDayCapacity('2026-09-14', settings, []); // Mon
  if (!(wed.meetingMinutes > mon.meetingMinutes)) {
    throw new Error(`Wed should be heavier than Mon: wed=${wed.meetingMinutes} mon=${mon.meetingMinutes}`);
  }
  if (!wed.meetingBlocks.some(b => /1:1/.test(b.title))) {
    throw new Error('Wed missing biweekly 1:1');
  }
  const withWait = computeDayCapacity('2026-09-14', settings, [
    { kind: 'wait', scheduledOn: '2026-09-14', done: false, timeEstimateMin: 200 },
    { kind: 'do', scheduledOn: '2026-09-14', done: false, timeEstimateMin: 45 }
  ]);
  if (withWait.plannedDoMinutes !== 45) {
    throw new Error('Wait must not inflate Do minutes: ' + withWait.plannedDoMinutes);
  }
  if (withWait.doCount !== 1 || withWait.waitCount !== 1) {
    throw new Error('do/wait counts wrong');
  }
  const over = computeDayCapacity('2026-09-14', settings, [
    { kind: 'do', scheduledOn: '2026-09-14', done: false },
    { kind: 'do', scheduledOn: '2026-09-14', done: false },
    { kind: 'do', scheduledOn: '2026-09-14', done: false },
    { kind: 'do', scheduledOn: '2026-09-14', done: false },
    { kind: 'do', scheduledOn: '2026-09-14', done: false },
    { kind: 'promise', scheduledOn: '2026-09-14', done: false }
  ]);
  if (!over.overloadCount) throw new Error('expected count overload');
  // anchor 2026-01-07 is Wed week 0 → Dima; 2026-09-16 is many weeks later
  const one = wedOneOnOneFor('2026-09-16', settings);
  if (!one || !one.person) throw new Error('rotation person missing');
  console.log('capacity self-check: ok', { wedMeet: wed.meetingMinutes, monMeet: mon.meetingMinutes, person: one.person });
}
