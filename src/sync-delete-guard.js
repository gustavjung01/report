import { LOCAL_STORES, getAllLocal, putManyLocal } from '../local-db.js';
import { syncBusinessNow } from './supabase-sync.js';

const GUARDED_STORES = [
  LOCAL_STORES.mcpRoutes,
  LOCAL_STORES.mcpRouteCustomers,
  LOCAL_STORES.mcpRouteSessions,
  LOCAL_STORES.mcpVisits,
  LOCAL_STORES.orders,
  LOCAL_STORES.orderItems,
  LOCAL_STORES.onaTests,
  LOCAL_STORES.onaTestItems,
  LOCAL_STORES.marketReports,
  LOCAL_STORES.marketReportProducts,
  LOCAL_STORES.marketReportCompetitors,
  LOCAL_STORES.aiSummaries
].filter(Boolean);

let tombstoneSnapshot = new Map();
let guardedRunning = false;
let pushingRestored = false;

function nowIso() {
  return new Date().toISOString();
}

function status(row = {}) {
  return String(row.status || '').trim().toLowerCase();
}

function deletedAt(row = {}) {
  return row.deleted_at || row.raw_payload?.deleted_at || null;
}

function inactiveAt(row = {}) {
  return row.raw_payload?.inactive_at || row.raw_payload?.active_changed_at || null;
}

function isDeleted(row = {}) {
  return Boolean(status(row) === 'deleted' || deletedAt(row) || row.raw_payload?.delete_reason);
}

function isInactive(row = {}) {
  return Boolean(row.active === false && (inactiveAt(row) || row.raw_payload?.inactive_reason || row.raw_payload?.delete_reason));
}

function isTombstone(row = {}) {
  return isDeleted(row) || isInactive(row);
}

function tombstoneClock(row = {}) {
  return String(deletedAt(row) || inactiveAt(row) || row.updated_at || row.synced_at || row.created_at || '');
}

function shouldRestoreTombstone(saved = {}, current = null) {
  if (!saved?.id || !isTombstone(saved)) return false;
  if (!current) return true;
  if (isTombstone(saved) && !isTombstone(current)) return true;
  if (isTombstone(saved) && isTombstone(current)) return tombstoneClock(saved) > tombstoneClock(current);
  return false;
}

function markForPush(row = {}) {
  const now = nowIso();
  return {
    ...row,
    sync_status: 'local',
    updated_at: row.updated_at || now,
    raw_payload: {
      ...(row.raw_payload || {}),
      delete_guard_at: now
    }
  };
}

async function snapshotTombstones() {
  const next = new Map();
  for (const store of GUARDED_STORES) {
    const rows = await getAllLocal(store).catch(() => []);
    const deleted = rows.filter(isTombstone);
    if (deleted.length) next.set(store, new Map(deleted.map((row) => [row.id, row])));
  }
  tombstoneSnapshot = next;
  return next;
}

async function restorePulledOverTombstones() {
  let restored = 0;
  for (const [store, savedById] of tombstoneSnapshot.entries()) {
    const currentRows = await getAllLocal(store).catch(() => []);
    const currentById = new Map(currentRows.map((row) => [row.id, row]));
    const patches = [];
    savedById.forEach((saved, id) => {
      const current = currentById.get(id) || null;
      if (!shouldRestoreTombstone(saved, current)) return;
      patches.push(markForPush({ ...(current || {}), ...saved }));
    });
    if (patches.length) {
      await putManyLocal(store, patches);
      restored += patches.length;
    }
  }
  if (restored) {
    window.dispatchEvent(new CustomEvent('sync:delete-guard-restored', { detail: { restored } }));
  }
  return restored;
}

async function guardedSyncBusinessNow(options = {}) {
  if (guardedRunning) return syncBusinessNow(options);
  guardedRunning = true;
  try {
    await snapshotTombstones();
    const result = await syncBusinessNow(options);
    const restored = await restorePulledOverTombstones();
    if (restored && !pushingRestored) {
      pushingRestored = true;
      try {
        await syncBusinessNow({ silent: true });
      } finally {
        pushingRestored = false;
      }
    }
    return { ...(result || {}), delete_guard_restored: restored };
  } finally {
    guardedRunning = false;
  }
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('#syncBtn');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  guardedSyncBusinessNow().then((result) => {
    if (result?.delete_guard_restored) toast(`Đã giữ ${result.delete_guard_restored} dòng đã xoá, không cho cloud hồi lại.`);
  }).catch((error) => {
    console.warn('guarded sync failed', error);
    syncBusinessNow().catch(console.warn);
  });
}, true);

window.bepSiSyncBusiness = guardedSyncBusinessNow;
window.bepSiSnapshotDeletes = snapshotTombstones;
window.bepSiRestoreDeletes = restorePulledOverTombstones;
