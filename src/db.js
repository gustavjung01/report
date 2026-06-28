export const DB_NAME = 'bep-si-report-clean-db';
export const DB_VERSION = 1;

export const STORES = Object.freeze({
  meta: 'meta',
  testFiles: 'test_files',
  testProducts: 'test_products',
  testCustomers: 'test_customers',
  testResults: 'test_results',
  syncQueue: 'sync_queue'
});

let dbPromise;

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB request failed'));
  });
}

function done(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'));
  });
}

function store(db, name, options = { keyPath: 'id' }) {
  if (!db.objectStoreNames.contains(name)) return db.createObjectStore(name, options);
  return null;
}

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      store(db, STORES.meta, { keyPath: 'key' });
      [STORES.testFiles, STORES.testProducts, STORES.testCustomers, STORES.testResults].forEach((name) => {
        const s = store(db, name, { keyPath: 'id' });
        if (s) {
          s.createIndex('updated_at', 'updated_at', { unique: false });
          s.createIndex('sync_status', 'sync_status', { unique: false });
        }
      });
      const q = store(db, STORES.syncQueue, { keyPath: 'id' });
      if (q) q.createIndex('status', 'status', { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Cannot open local DB'));
  });
  return dbPromise;
}

export async function all(storeName) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return req(tx.objectStore(storeName).getAll());
}

export async function get(storeName, id) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readonly');
  return req(tx.objectStore(storeName).get(id));
}

export async function put(storeName, row) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).put(row);
  await done(tx);
  return row;
}

export async function putMany(storeName, rows) {
  if (!rows?.length) return [];
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  const s = tx.objectStore(storeName);
  rows.forEach((row) => s.put(row));
  await done(tx);
  return rows;
}

export async function remove(storeName, id) {
  const db = await openDb();
  const tx = db.transaction(storeName, 'readwrite');
  tx.objectStore(storeName).delete(id);
  await done(tx);
}

export async function enqueue(type, sourceId, payload) {
  const now = new Date().toISOString();
  const job = {
    id: `sync-${type}-${sourceId}`,
    type,
    source_id: sourceId,
    payload,
    status: 'pending',
    attempts: 0,
    created_at: now,
    updated_at: now,
    last_error: ''
  };
  await put(STORES.syncQueue, job);
  return job;
}

export async function updateJob(id, patch) {
  const current = await get(STORES.syncQueue, id);
  if (!current) return null;
  return put(STORES.syncQueue, { ...current, ...patch, updated_at: new Date().toISOString() });
}

export async function clearDoneJobs() {
  const rows = await all(STORES.syncQueue);
  const doneRows = rows.filter((row) => row.status === 'done');
  await Promise.all(doneRows.map((row) => remove(STORES.syncQueue, row.id)));
}

export async function stats() {
  const [files, customers, queue] = await Promise.all([
    all(STORES.testFiles),
    all(STORES.testCustomers),
    all(STORES.syncQueue)
  ]);
  return {
    files: files.length,
    customers: customers.length,
    pending: queue.filter((job) => job.status !== 'done').length,
    errors: queue.filter((job) => job.status === 'error').length
  };
}
