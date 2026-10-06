# Planner → Things cutover — execution plan

Рабочий план поверх [`PLANNER-THINGS-CUTOVER.md`](./PLANNER-THINGS-CUTOVER.md) и [`PLANNER-IMPROVEMENT-BRIEF.md`](./PLANNER-IMPROVEMENT-BRIEF.md), с учётом **текущего кода** (сен 2026).

**Цель cutover:** Planner = source of truth для личных work-задач; агент triage читает/патчит Planner (`propose → confirm → apply`); Things отключается после dual-run.

**Не делаем до daily use Phase A–D:** live Calendar/.ics, Jira two-way, native mobile, multi-user, gamification, React rewrite, polish chips/zombie UI (старый Phase 8).

---

## Из Things — операционная грамматика (переносим)

Не копируем UI Things. Переносим привычки, которые уже работают:

| Принцип Things | В Planner |
|----------------|-----------|
| **When ≠ Deadline** | `scheduledOn` vs `deadline` — раздельно |
| **Today = короткий план**, не Inbox | Cap 3–5 Do; capacity + evening clear форсируют |
| **Anytime / Someday** = без давления «сегодня» | Backlog: `scheduledOn=null` + `park`; undated ≠ Today |
| **Tags как роли, не папки** | `kind` first-class (`do`/`wait`/`promise`/`park`); P1–P4 отдельно |
| **Quick Entry** | Composer presets: Quick Do / Promise (who+when) / Waiting on… |
| **Evening clear как ритуал** | Phase E1 — нельзя silently оставить кучу на Today |
| **Notes = хронология** | `prependNote` / description newest-first для агента |
| **Areas ≈ лёгкие buckets** | Плоский `project` string, без дерева Areas/Projects |

**Не тащим в MVP:** глубокие Projects + Headings, красивый Upcoming на месяц, recurring todos Things, iOS-жесты, отдельный Start date (хватит `scheduledOn` + `nextCheckAt`).

**Наше преимущество над Things:** kind в capacity, week template, agent API, Promise как социальный дедлайн, Wait → default p3.

---

## Реальность кода (зачем свой план)

| Факт | Следствие |
|------|-----------|
| `planner.html` ~5.3k — весь UI/логика; модуль только `js/planner-db.js` | Не rewrite; extract только capacity + ops когда появятся |
| `persistData` → IDB/localStorage, **не** зовёт `/api/save` | Файл на диске мёртвый для UI |
| `server.mjs` раньше **не отдавал** `/js/*` → Dexie 404 | **Phase 0.2 fixed**; проверять `npm run check:phase0` |
| `validatePayload` пишет только `tasks/notes/goals/journal` | `tags` / будущие `settings`/`schemaVersion` сбрасываются — чинить в Phase A |
| Нет `kind` / дат / Today / capacity / patch API | Всё с нуля; `normalizeTask` уже `...t` — поля переживут round-trip если нормализовать |
| Titles: `P3. Orlova. 25.03.26 [TDWEB-…]` | Парсинг префиксов — часть миграции Phase A |
| Тестов нет | `scripts/phase0-check.mjs`; после Phase A — smoke sync |

---

## Scope: что обязательно / что выкинуть

### Обязательно для цели

1. Схема task + `settings` + `schemaVersion` + migration defaults  
2. File ↔ UI sync (UI save → disk; disk newer → UI)  
3. Today как primary surface (Do / Promise / Wait)  
4. Capacity по week template (без live calendar)  
5. Agent API: state / day / week / patch(+dryRun)  
6. Evening clear (+ лёгкий morning fill)  
7. Things import + dual-run  
8. Skill cutover в vault (отдельный чат)  

### Отложить (после daily use)

- `.ics` / Calendar import  
- Zombie review UI, S/M/L chips, project filter chips  
- Jira linkify как фича (поле `jiraKey` при import — ок)  
- Reminders / macOS notifications  
- Milestone scheduling as Today Do  

### Упрощения vs бриф

| Тема | Решение в этом плане |
|------|----------------------|
| Wait → auto `p3` | Default при `setKind(wait)`; ручной bump приоритета разрешён |
| Milestone как Today Do | **Не в MVP.** Parent task на Today |
| Confirm token для patch | dryRun + human confirm в skill; token не строим |
| `project` | Плоская строка; без дерева Things |
| Conflict IDB ↔ file | Last-write: UI save stamps `updatedAt` → file; boot/visibility: если file newer → reload. Backup перед import |

---

## Phase 0 — Preparatory (до любой схемы)

Цель: безопасный старт, починка инфраструктуры persistence, инвентарь данных. **Без** новых product-полей в UI.

### 0.1 Backup & safety

- [x] Копия `planner-data.json` → `backups/planner-data-20260913.json` (`backups/` в `.gitignore`)
- [x] Live IDB export → `backups/planner-idb-export-20260913.json` (tags/journal богаче файла; диск синхронизирован)
- [x] Работаем при `npm start` на `127.0.0.1:3847`

### 0.2 Fix static serving (blocker)

- [x] `server.mjs`: отдаёт `/js/*` (+ MIME `.js`), path escape → 403
- [x] `npm run check:phase0` → 200 на `/js/planner-db.js`
- [x] localhost smoke: network `planner-db.js` + Dexie 200; IDB `planner-app` с state

### 0.3 Inventory текущего state

**Root сегодня:** `{ tasks, notes, goals, journal }` (+ `tags` в runtime через `ensureDataShape`, в seed-файле tags нет).

**Task fields сейчас:** `id, text, description, done, ts, cat, priority, milestones[], comments[], links[], tagIds[], progress`.

**Title-паттерны из `planner-data.json` (спека парсера Phase A):**

| Пример | Что вытащить |
|--------|----------------|
| `P3. Orlova. 25.03.26 [TDWEB-16557] Nickname…` | priority `p3`, person→waitingOn/promisedTo?, date, jiraKey, clean title |
| `P3. 12.03.26 👀 Orlova [TDWEB-16497] Fractional…` | priority, date, emoji (игнор/signal Wait?), person, jiraKey |
| `P3 Lopes/Dzhelebov [TDWADMIN-7291] [TDBL-3730] [CAD] …` | priority, people, multi jira keys, project hint `CAD` |
| `[TDWEB-16653] [a11y][Order Entry] - Zoom…` | jiraKey only; priority from field `p3` |
| `Check Maria’s tickets…` / `Upload Olga's and Dima's PPR…` | plain text; person в prose |
| Description lines `08.04.26 — …` | хронология в description (newest-first уже привычка) |

**Tags как kind:** в seed **нет** tags Do/Wait/Promise — kind при миграции default `do`; маппинг tags — на Things import (E2).

**Priority drift:** у `P3 Lopes/…` в title P3, в поле `priority: p2` — при parse **не затирать** существующий `priority`, если уже задан (title parse только для missing / import).

### 0.4 Точки касания в коде (карта)

| Когда | Функция | Где |
|-------|---------|-----|
| Phase A | `persistData` | `planner.html` ~1580 |
| Phase A | `ensureDataShape` | ~1593 |
| Phase A | `load` | ~1630 |
| Phase A | `flushPersist` / `flushPersistNow` | ~1700 / ~1711 |
| Phase A | `normalizeTagsArray` | ~1739 |
| Phase A | `normalizeTask` | ~1793 |
| Phase A | `normalizeGoal` / `normalizeNote` | ~1823 / ~1848 |
| Phase A | `normalizePlannerImport` | ~1881 |
| Phase A | `validatePayload` + static routes | `server.mjs` |
| Phase A | title prefix parse (new helper) | рядом с `normalizeTask` или `js/migrate-titles.js` |
| Phase B | `addTaskFromComposer` / `taskComposerHTML` | ~2118 / ~3454 |
| Phase B | `renderTasks` + nav panels | ~4048 + sidebar HTML |
| Phase C | new `js/capacity.js` | extract |
| Phase D | new ops + `/api/*` | `server.mjs` (+ `js/api-ops.js`) |
| Schedule helper | `js/schedule.js` (noWeekends) | Phase B; capacity может импортировать |

### 0.5 Минимальный harness

- [x] `scripts/phase0-check.mjs` — `/js` 200 + MIME + path escape
- [x] `npm run check:phase0`
- [x] Phase A: `npm run check:phase-a` + browser smoke (edit → `planner-data.json` updatedAt)
### 0.6 Things dump prep

**Формат:** JSON (предпочтительнее TSV).

**Минимальные поля dump → Planner:**

| Things / dump | Planner |
|---------------|---------|
| title | `text` (+ parse prefixes) |
| notes | `description` |
| tags `Do`/`Wait`/`Promise`/`Park` | `kind` |
| tags `P1`–`P4` | `priority` |
| when / activation date | `scheduledOn` |
| deadline | `deadline` |
| checklist | `milestones[]` (optional) |
| area / project name | `project` (flat string) |
| — | `waitingOn` / `promisedTo` / `nextCheckAt` из tags или notes если есть |

Скрипт AppleScript — **не писать** до Phase E2; dump класть в `backups/things-dump-YYYYMMDD.json` (gitignore).

### 0.7 Продуктовые решения

| Вопрос | Решение | Статус |
|--------|---------|--------|
| Wait auto-p3 | да, с ручным override | закрыто |
| Weekends | `noWeekends: true`, snap → Monday | закрыто |
| A+B одной сессией? | Нет. A green smoke → B | закрыто |
| Skill до import? | D → dual-run skill; E2 параллельно ok | закрыто |
| Source of truth | `planner-data.json` + `updatedAt`; IDB cache | закрыто |
| Title parse vs field priority | field wins if set; parse for import/missing | закрыто (0.3) |

**Done Phase 0:** backup есть; `/js` 200; inventory+карта в этом файле; harness зелёный. Осталось: ручной IDB smoke в браузере + UI export если IDB богаче файла.

---

## Phase A — Schema + migration + file sync

*(cutover Phase 1; критично до всего остального)*

**Files:** `planner.html`, `js/planner-db.js`, `server.mjs`, `planner-data.json`.

1. `schemaVersion: 2`, `updatedAt` ISO на каждом save  
2. Task fields + defaults в `normalizeTask`; goals/notes/journal **untouched** по смыслу  
3. Migration on load: missing `kind` → `do`; parse Things-like title prefixes по inventory 0.3 (не затирать явный `priority`)  
4. `data.settings` defaults (workDayMinutes, maxDoItems, noWeekends, …)  
5. `validatePayload` сохраняет `tags`, `settings`, `schemaVersion`, `updatedAt`  
6. `persistData`: после IDB → `POST /api/save`  
7. Boot / `visibilitychange`: если server file `updatedAt` newer → принять file  
8. Расширить `normalizePlannerImport` под новые root keys  

**Done:** UI edit → `planner-data.json` обновляется; reload сохраняет `kind`/settings; goals/journal целы.

---

## Phase B — Today UI

*(cutover Phase 2)*

1. Nav: **Today** default; Tasks = backlog (undated / park / not today) — Things Anytime semantics  
2. Секции Do · Promise · Wait; Wait quieter; Promise who+deadline  
3. Actions: complete, set kind, schedule, backlog; Wait demote → p3  
4. Composer presets: Quick Do / Promise / Waiting on… (Things Quick Entry+)  
5. `js/schedule.js`: reject Sat/Sun → next Monday  
6. Capacity header stub (ручные meeting minutes OK до Phase C)  
7. Filters: P, person, jiraKey (лёгкие)  

**Done:** «Today раздельно Do/Promise/Wait»; Wait не в Do count.

---

## Phase C — Capacity engine

*(cutover Phase 3)*

1. `js/capacity.js` — week template из брифа (включая Wed Dima/Mimi biweekly, Fri Kolya alias, skip Wed BA Sync, text sync ~10 min)  
2. Settings UI: overrides + manual day meeting block  
3. Meter на Today; overload warn (+ confirm ok)  
4. Default estimate M=45 для do/promise без estimate  

**Done:** Wed низкий available Do; Wait не раздувает meter.

---

## Phase D — Agent API

*(cutover Phase 4 — условие ухода из Things)*

| Endpoint | |
|----------|--|
| `GET /api/state` | full normalized |
| `GET /api/day?date=` | capacity + sections + overload |
| `GET /api/week?start=` | 7-day summary |
| `POST /api/patch` | typed ops → save file + notify |
| `POST /api/patch?dryRun=1` | preview, no save |

Ops min: `createTask`, `complete`, `setKind`, `setPriority`, `schedule`, `setEstimate`, `setProject`, `prependNote`, `reorder`, `delete`. Prefer extract `js/api-ops.js` если server не должен дублировать HTML-логику.

**Done:** `curl` читает today и schedule’ит задачу; UI подхватывает после refresh/visibility.

---

## Phase E — Morning / Evening + Things import

*(cutover 5+6; можно одним треком UI, import — отдельный slice)*

**E1 Evening/Morning (UI rule-based):**  
- Evening clear: leftovers → Reschedule / Backlog / Complete; `rolloverCount`; zombie flag ≥3  
- Morning: leftovers + scheduled + P1–P2 candidates; fill to cap; batch confirm  

**E2 Import:**  
- Settings import Things JSON по таблице 0.6; map tags/prefixes → kind/priority; when → `scheduledOn`  
- Dual-run: новые captures → Planner; weekly reconcile  

**Done:** evening не оставляет 15 silent на Today; Things dump влит хотя бы раз.

---

## Phase F — Skill cutover (вне этого репо)

Vault `!!! My Notes/!!! Work`: skill `planner-triage` на `GET /api/day` + `POST /api/patch` после confirm. Outlook/Slack intake сохранить. После 1–2 недель только Planner — Things scripts archive.

---

## Порядок сессий

```
0 Prep  ← **done**
→ A Schema + sync  ← **done**
→ B Today UI  ← **done**
→ C Capacity  ← **done**
→ D Agent API  ← **done**
→ E1 Evening/Morning  ← **done**
→ E2 Things import + dual-run  ← **done** (import UI; dual-run = process)
→ F Skill (vault chat)  ← **done** (`/planner-triage`)
→ (later) polish / calendar — только после daily use A–D
```

**Не смешивать** A с B в одном огромном diff. A green smoke обязателен.

---

## Acceptance (можно выключать Things)

- [x] Today: Do / Promise / Wait раздельно; cap 3–5 виден  
- [x] Wait не в Do-минутах; transition Wait → default p3  
- [x] Schedule не ставит Sat/Sun  
- [x] Evening clear разгребает leftovers  
- [x] `/api/day` + `/api/patch`; `planner-data.json` актуален  
- [x] Агент triage без AppleScript  
- [x] Импорт Things; work не только в Things (cutover dump 2026-10-05)  
- [x] Goals / milestones / journal не сломаны  
- [x] `/js/planner-db.js` отдаётся; IDB + file sync работают  

---

## Progress

| Phase | Status |
|-------|--------|
| 0 Prep | **done** |
| A Schema + sync | **done** |
| B Today UI | **done** |
| C Capacity | **done** |
| D Agent API | **done** |
| E1 Morning/Evening | **done** |
| E2 Things import | **done** |
| F Skill (vault) | **done** (planner-triage in `!!! My Notes/!!! Work`) |
| Later polish | deferred |
