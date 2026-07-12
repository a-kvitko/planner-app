/**
 * IndexedDB persistence for Planner (Dexie). Loaded via dynamic import from planner.html.
 */
import Dexie from 'https://cdn.jsdelivr.net/npm/dexie@4.0.10/+esm';

const DB_NAME = 'planner-app';
const LS_LEGACY_KEY = 'planner-v1';
const BC_NAME = 'planner-sync';

class PlannerDB extends Dexie {
  constructor() {
    super(DB_NAME);
    this.version(1).stores({ kv: 'key' });
  }
}

const db = new PlannerDB();

function cloneForStore(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Load persisted state object or null. Migrates from localStorage once if IDB empty.
 */
export async function loadState() {
  let row = await db.kv.get('state');
  if (!row || row.value == null) {
    try {
      const raw = localStorage.getItem(LS_LEGACY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        await db.kv.put({ key: 'state', value: cloneForStore(parsed) });
        localStorage.removeItem(LS_LEGACY_KEY);
        row = await db.kv.get('state');
      }
    } catch (e) {
      /* ignore */
    }
  }
  if (!row || row.value == null) return null;
  return cloneForStore(row.value);
}

/**
 * Persist full app data object.
 */
export async function saveState(data) {
  await db.kv.put({ key: 'state', value: cloneForStore(data) });
}

let bcInstance = null;

/**
 * Broadcast after successful save so other tabs reload from IDB.
 */
export function initTabSync(onOtherTabSaved) {
  if (bcInstance) {
    try {
      bcInstance.close();
    } catch (e) {
      /* ignore */
    }
  }
  bcInstance = new BroadcastChannel(BC_NAME);
  bcInstance.onmessage = (ev) => {
    if (ev.data && ev.data.type === 'planner-idb-saved') {
      onOtherTabSaved();
    }
  };
  return {
    notifySaved() {
      try {
        bcInstance.postMessage({ type: 'planner-idb-saved', t: Date.now() });
      } catch (e) {
        /* ignore */
      }
    }
  };
}
