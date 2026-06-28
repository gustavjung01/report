import {
  STORAGE_KEYS_V2,
  uid,
  nowIso
} from './data-model.js';

import {
  syncCustomerMaster,
  syncOrder,
  syncOnaTest,
  syncMarketReport,
  syncAiSummary,
  syncExport
} from './supabase-v2.js';

const SYNC_HANDLERS = Object.freeze({
  customer_master: syncCustomerMaster,
  order: syncOrder,
  ona_test: syncOnaTest,
  market_report: syncMarketReport,
  ai_summary: syncAiSummary,
  export: syncExport
});

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Không đọc được localStorage', key, error);
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function cacheIdentity(row = {}) {
  return row.id || row.order?.id || row.test?.id || row.report?.id || row.customer?.id || '';
}

export function readSyncQueue() {
  const rows = readJson(STORAGE_KEYS_V2.syncQueue, []);
  return Array.isArray(rows) ? rows : [];
}

export function writeSyncQueue(rows) {
  writeJson(STORAGE_KEYS_V2.syncQueue, Array.isArray(rows) ? rows : []);
}

export function enqueueSync(type, payload, options = {}) {
  if (!SYNC_HANDLERS[type]) throw new Error(`Không hỗ trợ sync type: ${type}`);
  const item = {
    id: options.id || uid('sync'),
    type,
    payload,
    status: 'pending',
    attempts: 0,
    last_error: '',
    created_at: nowIso(),
    updated_at: nowIso()
  };
  const queue = readSyncQueue();
  queue.unshift(item);
  writeSyncQueue(queue);
  return item;
}

export function removeSyncItem(id) {
  writeSyncQueue(readSyncQueue().filter((item) => item.id !== id));
}

export function clearCompletedSyncItems() {
  const next = readSyncQueue().filter((item) => item.status !== 'done');
  writeSyncQueue(next);
  return next;
}

async function runSyncItem(item) {
  const handler = SYNC_HANDLERS[item.type];
  if (!handler) throw new Error(`Không có handler cho sync type: ${item.type}`);

  const payload = item.payload || {};
  if (item.type === 'order') {
    return handler(payload.order || payload, payload.items || []);
  }
  if (item.type === 'ona_test') {
    return handler(payload.test || payload, payload.items || []);
  }
  if (item.type === 'market_report') {
    return handler(payload.report || payload, payload.products || [], payload.competitors || []);
  }
  return handler(payload.customer || payload);
}

export async function flushSyncQueue({ stopOnError = false } = {}) {
  const queue = readSyncQueue();
  const results = [];

  for (const item of queue) {
    if (item.status === 'done') continue;
    item.status = 'syncing';
    item.updated_at = nowIso();
    item.attempts = Number(item.attempts || 0) + 1;
    writeSyncQueue(queue);

    try {
      const result = await runSyncItem(item);
      item.status = 'done';
      item.last_error = '';
      item.updated_at = nowIso();
      results.push({ id: item.id, ok: true, result });
    } catch (error) {
      item.status = 'error';
      item.last_error = error.message || String(error);
      item.updated_at = nowIso();
      results.push({ id: item.id, ok: false, error: item.last_error });
      writeSyncQueue(queue);
      if (stopOnError) break;
    }

    writeSyncQueue(queue);
  }

  return results;
}

export function cacheRows(key, rows) {
  writeJson(key, Array.isArray(rows) ? rows : []);
}

export function readCachedRows(key) {
  const rows = readJson(key, []);
  return Array.isArray(rows) ? rows : [];
}

export function upsertCachedRow(key, row) {
  const rows = readCachedRows(key);
  const id = cacheIdentity(row);
  if (!id) throw new Error('Không thể cache dòng thiếu id.');
  const index = rows.findIndex((item) => cacheIdentity(item) === id);
  if (index >= 0) rows[index] = row;
  else rows.unshift(row);
  cacheRows(key, rows);
  return row;
}

export function deleteCachedRow(key, id) {
  const rows = readCachedRows(key).filter((item) => cacheIdentity(item) !== id);
  cacheRows(key, rows);
  return rows;
}

export function getSyncStats() {
  const queue = readSyncQueue();
  return queue.reduce((stats, item) => {
    stats.total += 1;
    stats[item.status] = (stats[item.status] || 0) + 1;
    return stats;
  }, { total: 0, pending: 0, syncing: 0, done: 0, error: 0 });
}
