import './record-remove-guard.js?v=record-remove-guard-1';
import { LOCAL_STORES, getAllLocal, putManyLocal, clearLocalStore, openLocalDb, localStats } from '../local-db.js';

const ALL_STORES = Object.values(LOCAL_STORES);
const BUSINESS_CLEAR_STORES = ALL_STORES;

function toast(message) {
  const el = document.querySelector('#toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2600);
}

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function saveJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(String(reader.result || '{}'))); }
      catch (error) { reject(error); }
    };
    reader.onerror = () => reject(reader.error || new Error('Không đọc được file backup.'));
    reader.readAsText(file, 'utf-8');
  });
}

function normalizeRestoreRows(rows = []) {
  return Array.isArray(rows) ? rows.filter((row) => row && typeof row === 'object') : [];
}

function validateBackupPayload(payload = {}) {
  if (!payload || typeof payload !== 'object') throw new Error('File backup không hợp lệ.');
  if (payload.kind !== 'local-indexeddb-backup') throw new Error('Không đúng loại backup của Bếp Sỉ Báo Cáo.');
  if (!payload.stores || typeof payload.stores !== 'object') throw new Error('Backup thiếu dữ liệu stores.');
  const rowsByStore = {};
  for (const store of ALL_STORES) rowsByStore[store] = normalizeRestoreRows(payload.stores[store]);
  const total = Object.values(rowsByStore).reduce((sum, rows) => sum + rows.length, 0);
  if (!total) throw new Error('Backup không có dòng dữ liệu để khôi phục.');
  return { rowsByStore, total };
}

async function backupLocalJson() {
  const stores = {};
  const counts = {};
  for (const store of ALL_STORES) {
    const rows = await getAllLocal(store).catch((error) => {
      console.warn('backup store failed', store, error);
      return [];
    });
    stores[store] = rows;
    counts[store] = rows.length;
  }
  const payload = {
    app: 'Bếp Sỉ Báo Cáo',
    kind: 'local-indexeddb-backup',
    schema: 1,
    exported_at: new Date().toISOString(),
    counts,
    stores
  };
  saveJson(`bep-si-backup-local-${stamp()}.json`, payload);
  const total = Object.values(counts).reduce((sum, value) => sum + Number(value || 0), 0);
  toast(`Đã tải backup JSON: ${total} dòng.`);
}

async function restoreBackupJson(file) {
  if (!file) return;
  const payload = await readJsonFile(file);
  const { rowsByStore, total } = validateBackupPayload(payload);
  const exportedAt = payload.exported_at ? `\nNgày backup: ${payload.exported_at}` : '';
  const step1 = window.confirm(`Khôi phục backup JSON vào máy này?\nTổng dữ liệu sẽ ghi/ghi đè theo ID: ${total} dòng.${exportedAt}\n\nThao tác này không tự xoá dữ liệu cũ. Muốn restore sạch thì Clear dữ liệu máy trước.`);
  if (!step1) return;
  const typed = window.prompt('Xác nhận lần 2: nhập đúng KHOI PHUC để import backup.');
  if (typed !== 'KHOI PHUC') return toast('Đã huỷ khôi phục backup.');
  let restored = 0;
  for (const store of ALL_STORES) {
    const rows = rowsByStore[store];
    if (!rows.length) continue;
    await putManyLocal(store, rows);
    restored += rows.length;
  }
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  window.dispatchEvent(new CustomEvent('order:changed'));
  window.dispatchEvent(new CustomEvent('report:changed'));
  window.dispatchEvent(new CustomEvent('test:changed'));
  await refreshStats(`Đã khôi phục backup: ${restored} dòng.`);
  toast(`Đã khôi phục ${restored} dòng từ backup.`);
}

async function refreshStats(extra = '') {
  const target = document.querySelector('#adminStats');
  if (!target) return;
  const stats = await localStats();
  const queue = await getAllLocal(LOCAL_STORES.syncQueue).catch(() => []);
  const queueError = queue.filter((row) => row.status === 'error').length;
  const lines = [
    `Tổng local: ${stats.records}`,
    `Hàng đợi sync: ${stats.pending}`,
    `Lỗi sync: ${Math.max(stats.error, queueError)}`,
    `Queue lỗi: ${queueError}`
  ];
  if (extra) lines.push(extra);
  target.innerHTML = lines.join('<br>');
}

async function clearErrorSyncQueue() {
  const db = await openLocalDb();
  const rows = await getAllLocal(LOCAL_STORES.syncQueue);
  const errors = rows.filter((row) => row.status === 'error');
  if (!errors.length) return toast('Không có queue lỗi để xoá.');
  const ok = window.confirm(`Xoá ${errors.length} dòng sync queue lỗi?\nChỉ xoá hàng đợi lỗi, không xoá dữ liệu nghiệp vụ.`);
  if (!ok) return;
  const tx = db.transaction(LOCAL_STORES.syncQueue, 'readwrite');
  const store = tx.objectStore(LOCAL_STORES.syncQueue);
  errors.forEach((row) => store.delete(row.id));
  await new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('Không xoá được queue lỗi.'));
    tx.onabort = () => reject(tx.error || new Error('Xoá queue lỗi bị huỷ.'));
  });
  await refreshStats(`Đã xoá queue lỗi: ${errors.length}`);
  toast(`Đã xoá ${errors.length} queue lỗi.`);
}

async function clearAllLocalData() {
  const stats = await localStats();
  const queue = await getAllLocal(LOCAL_STORES.syncQueue).catch(() => []);
  const total = stats.records + queue.length;
  const step1 = window.confirm(`Xoá TOÀN BỘ dữ liệu máy này?\nTổng local hiện có khoảng ${total} dòng.\n\nNên bấm Backup JSON trước. Thao tác này không xoá dữ liệu đã ở đám mây.`);
  if (!step1) return;
  const typed = window.prompt('Xác nhận lần 2: nhập đúng XOA DU LIEU để xoá dữ liệu máy.');
  if (typed !== 'XOA DU LIEU') return toast('Đã huỷ xoá dữ liệu máy.');
  for (const store of BUSINESS_CLEAR_STORES) await clearLocalStore(store);
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  window.dispatchEvent(new CustomEvent('order:changed'));
  window.dispatchEvent(new CustomEvent('report:changed'));
  window.dispatchEvent(new CustomEvent('test:changed'));
  await refreshStats('Đã clear dữ liệu máy.');
  toast('Đã xoá dữ liệu máy.');
}

function installStyle() {
  let style = document.querySelector('style[data-admin-data-tools]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.adminDataTools = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    .admin-data-tools{margin:0 0 12px!important;border:1px solid #dce8e5!important;border-radius:18px!important;background:#fff!important;padding:12px!important;box-shadow:0 8px 20px rgba(12,55,50,.05)!important;display:grid!important;gap:9px!important}
    .admin-data-tools b{font-size:14px!important;color:#082337!important}.admin-data-tools small{font-size:11px!important;color:#63727c!important;line-height:1.25!important}.admin-data-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}.admin-data-actions button{min-height:40px!important;border-radius:12px!important;font-size:12px!important;font-weight:950!important}.admin-clear-danger{border:1px solid #fecaca!important;background:#fff7f7!important;color:#b91c1c!important}.admin-clear-warn{border:1px solid #fed7aa!important;background:#fff7ed!important;color:#b45309!important}.admin-restore-safe{border:1px solid #bbf7d0!important;background:#f0fdf4!important;color:#15803d!important}@media(max-width:380px){.admin-data-actions{grid-template-columns:1fr!important}}
  `;
}

function mountTools() {
  installStyle();
  const page = document.querySelector('section.page[data-page="admin"]');
  if (!page || page.querySelector('[data-admin-data-tools]')) return;
  const firstCard = page.querySelector('article.admin');
  const block = document.createElement('article');
  block.className = 'admin-data-tools';
  block.dataset.adminDataTools = '1';
  block.innerHTML = `<div><b>Backup / dữ liệu máy</b><br><small>Backup JSON trước khi xoá. Import backup sẽ ghi/ghi đè theo ID, không tự xoá dữ liệu cũ.</small></div><div class="admin-data-actions"><button type="button" class="secondary" data-admin-backup-json>Backup JSON</button><button type="button" class="secondary admin-restore-safe" data-admin-restore-json>Import backup</button><button type="button" class="secondary admin-clear-warn" data-admin-clear-queue-errors>Xoá queue lỗi</button><button type="button" class="secondary admin-clear-danger" data-admin-clear-local>Clear dữ liệu máy</button></div><input type="file" accept="application/json,.json" data-admin-restore-file hidden>`;
  if (firstCard) firstCard.insertAdjacentElement('afterend', block);
  else page.appendChild(block);
  refreshStats().catch(() => null);
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-admin-backup-json]')) { event.preventDefault(); backupLocalJson().catch((error) => { console.warn(error); toast('Backup JSON lỗi.'); }); return; }
  if (event.target.closest('[data-admin-restore-json]')) { event.preventDefault(); document.querySelector('[data-admin-restore-file]')?.click(); return; }
  if (event.target.closest('[data-admin-clear-queue-errors]')) { event.preventDefault(); clearErrorSyncQueue().catch((error) => { console.warn(error); toast('Xoá queue lỗi thất bại.'); }); return; }
  if (event.target.closest('[data-admin-clear-local]')) { event.preventDefault(); clearAllLocalData().catch((error) => { console.warn(error); toast('Clear dữ liệu máy thất bại.'); }); }
}, true);

document.addEventListener('change', (event) => {
  const input = event.target.closest('[data-admin-restore-file]');
  if (!input) return;
  const file = input.files?.[0];
  input.value = '';
  restoreBackupJson(file).catch((error) => { console.warn(error); toast(error.message || 'Import backup thất bại.'); });
}, true);

window.addEventListener('DOMContentLoaded', mountTools);
document.addEventListener('click', () => setTimeout(mountTools, 120));
mountTools();