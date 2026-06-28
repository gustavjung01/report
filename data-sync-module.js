import { STORAGE_KEYS_V2 } from './data-model.js';
import { readCachedRows } from './sync-queue.js';

const TEST_FORM_KEY = 'bepi-local-test-forms-v1';
const TEST_ROW_KEY = 'bepi-local-test-rows-v1';

function readJson(key) {
  try {
    const rows = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function setText(id, value) {
  const node = document.getElementById(id);
  if (node) node.textContent = String(value);
}

function countLocalRows() {
  const orders = readCachedRows(STORAGE_KEYS_V2.orders).length;
  const reports = readCachedRows(STORAGE_KEYS_V2.marketReports).length;
  const customers = readCachedRows(STORAGE_KEYS_V2.customers).length;
  const testForms = readJson(TEST_FORM_KEY).length;
  const testRows = readJson(TEST_ROW_KEY).length;
  setText('localRecordCount', orders + reports + customers + testForms + testRows);
  setText('pendingSyncCount', 0);
  setText('errorSyncCount', 0);
}

function removeOldDbToolbar() {
  document.getElementById('dataSyncToolbar')?.remove();
}

function initDataSyncModule() {
  removeOldDbToolbar();
  countLocalRows();
  window.addEventListener('storage', countLocalRows);
  document.addEventListener('click', () => setTimeout(countLocalRows, 0));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDataSyncModule, { once: true });
} else {
  initDataSyncModule();
}
