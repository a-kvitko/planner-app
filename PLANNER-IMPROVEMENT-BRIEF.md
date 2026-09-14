# Planner App — Improvement Brief (AI prompt)

Use this document as the product brief when improving Planner App. Goal: become Aleksey’s **primary personal task system** (replacing Things 3 over time), fully controllable in code and friendly to AI agents.

**Executable cutover roadmap (phases, acceptance, agent prompts):** see [`PLANNER-THINGS-CUTOVER.md`](./PLANNER-THINGS-CUTOVER.md).

Language for UI copy: match the app (English labels OK). Keep data model and agent APIs unambiguous (English field names).

---

## Context & motivation

- Tried many task apps; none fully fit. Planner must be **owned and extensible**.
- Current pain with Things: Today snowballs — too many items mixed together (real work + “check status” + promises). Soft Jira deadlines; hard promises live in Slack.
- Existing Planner strengths to keep: tasks with **P1–P4**, milestones, goals, notes, journal, local persistence (`IndexedDB` + `planner-data.json` via `server.mjs`).
- Transition: Things remains a temporary capture/execution surface; Planner becomes source of truth. Design for **agent propose → human confirm → apply**.

---

## Core product model

### Task kinds (first-class, not just tags)

Every actionable item must have a **kind**:

| Kind | Meaning | Counts toward daily Do capacity? |
|------|---------|----------------------------------|
| `do` | I must actively work on this | **Yes** |
| `wait` | Blocked on someone else; I only need a status check later | **No** (uses a cheap “check” budget) |
| `promise` | I committed to someone (often Slack); treat as social deadline | **Yes**, usually high priority |
| `park` | Not scheduled; backlog / someday | No |

Rules:

- `wait` requires `waitingOn` (person/team name) and optional `nextCheckAt` (date).
- `promise` requires `promisedTo` (optional but recommended) and preferably `deadline` or `scheduledOn`.
- Default for new quick-capture from chat: `do` or `promise` if text implies commitment (“I’ll send…”, “сделаю к…”).

### Priority (already exists — keep)

- `p1` … `p4` (1 = very urgent, 4 = not urgent).
- Priority ≠ kind. A `wait` can be P1 (important unblocker) but still must not fill the Do list like active work.

### Scheduling

Add fields (names suggestive; adapt to schema):

- `scheduledOn` — date the item is planned for (like Things “when”).
- `deadline` — real due date (promises, rare hard Jira dates).
- `timeEstimateMin` — optional minutes (S/M/L mapping OK: S=15, M=45, L=90 as defaults).
- `completedAt` / `done` — keep current completion model; extend if needed.

### Daily plan view (new primary surface)

Replace “flat task dump” for day-to-day use with **Today / Day plan**:

1. **Capacity header** for the selected day  
2. Sections: **Do** · **Promise** · **Wait (checks)** · **Parked / not today**  
3. Soft cap on Do items and/or Do minutes  
4. One-click moves: Do ↔ Wait ↔ Promise ↔ Park; reschedule to another weekday

Today must never be a single undifferentiated list.

---

## Capacity engine (meetings + Slack/mail + deep work)

Days have different meeting loads (mostly weekly-repeating) plus 1:1s with reports. Also need time for email and Slack.

### Day capacity model

For each calendar day compute:

```
workDayMinutes          // e.g. 8h = 480 (configurable)
− meetingMinutes        // from calendar blocks or manual/recurring templates
− oneOnOneMinutes       // can be subset of meetings or separate
− commsBlockMinutes     // Slack + email (default budget, e.g. 60–90)
= availableDoMinutes
```

Then:

- Sum `timeEstimateMin` of items in **Do + Promise** scheduled that day.
- Flag **overload** when planned Do/Promise minutes > availableDoMinutes (or when count > `maxDoItems`, e.g. 3–5).
- **Wait** items use `checkBudget` (e.g. max 3–5 checks/day, ~5–10 min each), separate from Do capacity.

### Workday defaults (Aleksey)

- Target **40 h / week**; aim ~8 h / day with flex (heavier one day, lighter another; occasional weekend catch-up if mid-week absence).
- Typical start **10:00 or 11:00**.
- **Lunch 13:00–13:30** (calendar event often titled “Launch”): protected no-ping block so colleagues don’t expect fast Slack replies — count as **30 min out**, not a collaboration meeting.
- Evening work after ~22:00 is optional overtime; **do not** include in default daily Do capacity unless explicitly enabled that day.
- JTT quirks (booking lunch to offset untracked evening work) are **out of scope** for Planner capacity.

### Primary deep-work window

Most recurring meetings sit **after 13:00**. Default Do focus: **start → 13:00**. Afternoon Do only when the day’s template/calendar shows a real gap.

### Recurring week template (defaults)

Use this as Phase-1 capacity when the live calendar isn’t imported. Override with one-off demos/kickoffs from the real calendar.

| When | Block | Capacity notes |
|------|--------|----------------|
| Daily 13:00–13:30 | Lunch (“Launch”) | 30 min; `comms: off` |
| Mon / Wed / Fri ~14:00–14:30 | TDW Standup | ~30 min |
| Tue / Thu ~13:30–14:15 | TDW BA – Canadianization | Usually attends |
| Tue / Thu 16:00–17:00 | TDW design team sync | 60 min |
| Tue ~14:00 + Fri (Weekly DXd / design text sync) | Async/text design sync | **~10 min each**, not a full hour — even if calendar shows a long block |
| Wed 14:30–15:30 | Mobile work discussion | 60 min |
| Wed 15:40–16:40 | TDW mobile design sync | 60 min |
| Wed **17:00** (~45 min) | 1:1 **Dima** **or** **Mimi** | **Alternating biweekly** (one week Dima, next week Maria) |
| Fri ~15:00–15:45 | 1:1 **Olya** | Recurring |
| Fri (calendar may say “1-on-1 with Alexey”) | 1:1 **Kolya** | Organizer named the event with Aleksey’s name — treat as **Kolya**, not a self-meeting |
| Other weekdays (variable) | 1:1 **Vitya** etc. | From live calendar |

**Do not put in the default template**

- Wed 13:30–14:00 **TDW BA Sync** — Aleksey does **not** attend (only rarely on request).
- Fri **Weekly DXd Tex…** as a 60-minute meeting — only **~10 min** of attention (same class as Tuesday text sync).

**Rough day weights for Do planning**

- **Wednesday** — heaviest afternoon → keep Do mostly in the morning window; light Do count.
- **Monday / Thursday** — relatively more afternoon slack after standup/BA (still protect morning).
- **Friday** — standup + Olya 1:1 + Kolya 1:1; still prefer morning for deep Do.

### Calendar inputs (phased)

**Phase 1 (ship first):**

- Encode the **week template** above (including biweekly Wed 1:1 rotation and calendar-title aliases).
- Manual override for a specific date (“extra workshop 14:00–16:00”).
- Settings: `commsBlockMinutes`, `workDayStart` (10:00/11:00), lunch, `maxDoItems`, default estimates, `workWeekMinutes = 2400`.

**Phase 2:**

- Import from macOS Calendar / `.ics` / Google (read-only) for the current week.
- Map 1:1s by attendee names (Vitya, Mimi, Olya, Dima, Kolya). Alias: event title “1-on-1 with Alexey” on Friday → **Kolya**.
- When calendar shows long “Weekly DXd” / text sync blocks, cap counted time at **~10 min** unless user overrides.

Agent triage must receive capacity for “today” and “rest of week” before proposing a plan.

---

## Workflows the app must support

### Morning triage

1. Show yesterday leftovers + today’s scheduled + inbox/unscheduled candidates.
2. Propose classification: Do / Wait / Promise / Park.
3. Fit Do+Promise into **availableDoMinutes**.
4. User confirms → persist.

### Evening rollup

1. Incomplete Do/Promise: reschedule (not silent pile onto tomorrow).
2. Wait: bump `nextCheckAt` or leave with reminder.
3. Log rollover count; items rolled N times → “zombie” review (split, kill, or renegotiate promise).

### Weekly planning

1. Spread Do/Promise across the week using capacity per day.
2. Prefer protecting 1–2 deep-work days if the template shows lighter meetings.
3. Surface promises with deadlines first.

### Capture

- Fast add: title, kind, priority, optional person, optional date.
- “Promise from Slack” preset: kind=`promise`, prompt for who + when.
- “Waiting on…” preset: kind=`wait`, person + next check date.

---

## AI agent surface (required)

Agents must not scrape the DOM. Provide a stable local API / files:

### Read

- `GET /api/state` — full normalized JSON (or keep file `planner-data.json` always in sync).
- `GET /api/day?date=YYYY-MM-DD` — capacity + sections for one day.
- `GET /api/week?start=YYYY-MM-DD` — week overview + overload flags.

### Write (confirm-then-apply)

- `POST /api/patch` — JSON patch or typed operations, e.g.:

```json
{
  "ops": [
    { "op": "setKind", "id": "…", "kind": "wait", "waitingOn": "Vitya", "nextCheckAt": "2026-07-21" },
    { "op": "schedule", "id": "…", "scheduledOn": "2026-07-22" },
    { "op": "setPriority", "id": "…", "priority": "p2" }
  ]
}
```

- Optional dry-run: `POST /api/patch?dryRun=1` returns the resulting day/week preview without saving.

### Design constraints

- Schema version field in saved state.
- Idempotent ops where possible.
- Never auto-apply agent plans without user confirm in the UI (or an explicit `confirmToken` flow later).

---

## UX requirements (day plan)

- Brand/product feel can stay; avoid dashboard clutter on the first screen of **Today**.
- Capacity meter: available vs planned minutes; red when overloaded.
- Wait section visually quieter than Do (checks, not guilt).
- Promise section shows **who** and **deadline**.
- Filters: priority, person, project/Jira key, kind.
- Keep milestones under larger work items; allow a milestone to be scheduled as today’s Do while parent stays in backlog.

---

## Migration from Things 3

- Import path: AppleScript/Shortcuts dump → Planner JSON (title, notes, tags→kind/priority, dates).
- Tag mapping suggestion during bridge period:
  - Things tags `Do` / `Wait` / `Promise` → Planner `kind`
  - `P1`–`P4` tags or name prefixes → `priority`
- Dual-run OK: capture in either tool; weekly reconcile until Things is dropped.

---

## Non-goals (for now)

- Multi-user / team accounts
- Full Jira two-way sync (links + ticket keys in description are enough initially)
- Mobile-native app (responsive web / local server on Mac is enough first)
- Gamification, streaks, social features

---

## Suggested implementation order

1. **Data model**: `kind`, `waitingOn`, `promisedTo`, `scheduledOn`, `deadline`, `timeEstimateMin`, `nextCheckAt`; migrate existing tasks (default `kind: "do"`).
2. **Today / Day plan UI** with Do · Promise · Wait · Park sections + simple capacity settings (manual meeting minutes + comms block).
3. **Week template** for recurring meetings / 1:1s.
4. **Agent API** (`/api/day`, `/api/week`, `/api/patch` + dry-run).
5. **Morning/Evening triage UI** (even without LLM: rule-based overload warnings).
6. **Calendar import** and Things import.
7. Polish: zombie detection, estimate presets, Slack-promise capture template.

---

## Acceptance criteria (MVP day plan)

- [ ] I can open Today and see Do / Promise / Wait separately.
- [ ] Wait items do not count toward Do minute budget.
- [ ] I can set meeting+comms load for a day and see overload when too many Do/Promise items are scheduled.
- [ ] I can reschedule instead of silently stacking onto tomorrow.
- [ ] An agent can read day/week JSON and propose a patch I confirm before save.
- [ ] Existing tasks/milestones/goals/journal still work after migration.

---

## Reference: user constraints (do not lose)

1. Often puts too much on “today”; needs hard capacity + reclassification, not motivational tips.
2. Many “today” items are status checks → must be `wait`.
3. Promises to colleagues (Slack) are the real deadlines more often than Jira.
4. Meeting load varies by weekday; weekly pattern mostly repeats; include 1:1s with reports (see week template).
5. Always reserve time for Slack + email.
6. Mac-first; workflow = agent proposes, user confirms.
7. Long-term: single owned tool (this app), not perpetual Things dependency.
8. **40 h / week** target; start ~10–11; lunch ~13:00 protected; flexible day lengths OK.
9. Skip default capacity for Wed BA Sync; text design syncs (Tue + Fri DXd) ≈ **10 min**, not full calendar duration.
10. Wed 17:00 1:1 alternates **Dima / Mimi**; Fri “1-on-1 with Alexey” = **Kolya**.

---

## Prompt stub (paste into an implementation chat)

```
Read PLANNER-IMPROVEMENT-BRIEF.md and implement the next slice of Planner App.

Current codebase: planner.html (UI + logic), js/planner-db.js (IndexedDB), server.mjs + planner-data.json (file sync).

Follow the suggested implementation order. For this session, focus on: <SLICE>.
Preserve existing P1–P4, milestones, goals, notes, journal.
Prefer small schema migrations with defaults.
Add agent-friendly API only when the data model for kind/scheduling/capacity exists.
Do not build mobile or Jira sync yet.
```
