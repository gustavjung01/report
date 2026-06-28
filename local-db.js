const DB_NAME = 'bep-si-report-local-db';
const DB_VERSION = 1;

export const LOCAL_STORES = Object.freeze({
  meta: 'meta',
  products: 'products',
  customers: 'customers',
  orders: 'orders',
  orderItems: 'order_items',
  onaTests: 'ona_tests',
  onaTestItems: 'ona_test_items',
  marketReports: 'market_reports',
  marketReportProducts: 'market_report_products',
  marketReportCompetitors: 'market_report_competitors',
  aiSummaries: 'ai_summaries',
  syncQueue: 'sync_queue'
});

const BUSINESS_STORES = [
  LOCAL_STORES.products,
  LOCAL_STORES.customers,
  LOCAL_STORES.orders,
  LOCAL_STORES.orderItems,
  LOCAL_STORES.onaTests,
  LOCAL_STORES.onaTestItems,
  LOCAL_STORES.marketReports,
  LOCAL_STORES.marketReportProducts,
  LOCAL_STORES.marketReportCompetitors,
  LOCAL_STORES.aiSummaries
];

let dbPromise;

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function createStore(db, name, options = { keyPath: 'id' }) {
  if (!db.objectStoreNames.contains(name)) {
    return db.createObjectStore(name, options);
  }
  return null;
}

export function openLocalDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('Trình duyệt không hỗ trợ IndexedDB.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      createStore(db, LOCAL_STORES.meta, { keyPath: 'key' });
      BUSINESS_STORES.forEach((name) => {
        const store = createStore(db, name, { keyPath: 'id' });
        if (store && !store.indexNames.contains('sync_status')) store.createIndex('sync_status', 'sync_status', { unique: false });
        if (store && !store.indexNames.contains('updated_at')) store.createIndex('updated_at', 'updated_at', { unique: false });
      });
      const queue = createStore(db, LOCAL_STORES.syncQueue, { keyPath: 'id' });
      if (queue && !queue.indexNames.contains('status')) queue.createIndex('status', 'status', { unique: false });
      if (queue && !queue.indexNames.contains('source_id')) queue.createIndex('source_id', 'source_id', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Không mở được local DB.'));
  });
  return dbPromise;
}

export async function getAllLocal(storeName) {
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).getAll());
}

export async function getLocal(storeName, id) {
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readonly');
  return requestToPromise(tx.objectStore(storeName).get(id));
}

export async function putLocal(storeName, row) {
  if (!row?.id && storeName !== LOCAL_STORES.meta) throw new Error(`Dòng ${storeName} thiếu id.`);
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(row);
  await txDone(tx);
  return row;
}

export async function putManyLocal(storeName, rows = []) {
  if (!Array.isArray(rows) || !rows.length) return [];
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  rows.forEach((row) => {
    if (row?.id) store.put(row);
  });
  await txDone(tx);
  return rows;
}

export async function deleteLocal(storeName, id) {
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(id);
  await txDone(tx);
}

export async function deleteWhereLocal(storeName, predicate) {
  const rows = await getAllLocal(storeName);
  const targets = rows.filter(predicate);
  const db = await openLocalDb();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  targets.forEach((row) => store.delete(row.id));
  await txDone(tx);
  return targets.length;
}

export async function whereLocal(storeName, predicate) {
  const rows = await getAllLocal(storeName);
  return rows.filter(predicate);
}

export async function getMeta(key, fallback = null) {
  const db = await openLocalDb();
  const tx = db.transaction(LOCAL_STORES.meta, 'readonly');
  const row = await requestToPromise(tx.objectStore(LOCAL_STORES.meta).get(key));
  return row ? row.value : fallback;
}

export async function setMeta(key, value) {
  const db = await openLocalDb();
  const tx = db.transaction(LOCAL_STORES.meta, 'readwrite');
  tx.objectStore(LOCAL_STORES.meta).put({ key, value, updated_at: new Date().toISOString() });
  await txDone(tx);
  return value;
}

export async function enqueueLocalSync(type, sourceId, payload) {
  const existing = await getAllLocal(LOCAL_STORES.syncQueue);
  const duplicated = existing.find((job) => job.type === type && job.source_id === sourceId && job.status !== 'done');
  const now = new Date().toISOString();
  const job = {
    id: duplicated?.id || `sync-${type}-${sourceId}`,
    type,
    source_id: sourceId,
    payload,
    status: 'pending',
    attempts: duplicated?.attempts || 0,
    last_error: '',
    created_at: duplicated?.created_at || now,
    updated_at: now
  };
  await putLocal(LOCAL_STORES.syncQueue, job);
  return job;
}

export async function updateSyncJob(id, patch = {}) {
  const current = await getLocal(LOCAL_STORES.syncQueue, id);
  if (!current) return null;
  const next = { ...current, ...patch, updated_at: new Date().toISOString() };
  await putLocal(LOCAL_STORES.syncQueue, next);
  return next;
}

export async function getSyncQueue() {
  const rows = await getAllLocal(LOCAL_STORES.syncQueue);
  return rows.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
}

export async function clearDoneSyncJobs() {
  return deleteWhereLocal(LOCAL_STORES.syncQueue, (job) => job.status === 'done');
}

export async function clearBusinessData() {
  const db = await openLocalDb();
  const tx = db.transaction([...BUSINESS_STORES, LOCAL_STORES.syncQueue], 'readwrite');
  [...BUSINESS_STORES, LOCAL_STORES.syncQueue].forEach((name) => tx.objectStore(name).clear());
  await txDone(tx);
}

export async function localStats() {
  const [orders, tests, reports, customers, ai, queue] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.marketReports),
    getAllLocal(LOCAL_STORES.customers),
    getAllLocal(LOCAL_STORES.aiSummaries),
    getAllLocal(LOCAL_STORES.syncQueue)
  ]);
  const countByStatus = queue.reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, { pending: 0, syncing: 0, error: 0, done: 0 });
  return {
    records: orders.length + tests.length + reports.length + customers.length + ai.length,
    orders: orders.length,
    tests: tests.length,
    reports: reports.length,
    customers: customers.length,
    ai: ai.length,
    queue: countByStatus,
    pending: (countByStatus.pending || 0) + (countByStatus.syncing || 0),
    error: countByStatus.error || 0
  };
}
