import { makeOnaTest, makeOnaTestItem, uid, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal, putManyLocal, enqueueLocalSync } from '../local-db.js';

const STATUS = [
  ['pending', 'Chưa thử'],
  ['ok', 'OK'],
  ['interested', 'Quan tâm'],
  ['sample', 'Cần mẫu'],
  ['follow', 'Báo sau'],
  ['bad', 'Chưa tốt'],
  ['retry', 'Thử lại']
];

let state = { fileId: '', file: null, products: [], selected: new Map() };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const activeRow = (row = {}) => row.status !== 'deleted' && !row.deleted_at && !row.raw_payload?.deleted_at && !row.raw_payload?.delete_reason;

function toast(message) {
  const element = $('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function ensureCss() {
  if ($('style[data-test-customer-picker-ui]')) return;
  const style = document.createElement('style');
  style.dataset.testCustomerPickerUi = '1';
  style.textContent = `
    #modal[data-type="test-customer-picker"]{width:min(400px,calc(100vw - 18px))!important;max-height:calc(100dvh - 18px)!important;overflow:hidden!important;padding:0!important;border-radius:20px!important}
    #modal[data-type="test-customer-picker"] .modal{max-height:calc(100dvh - 18px)!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:0!important;padding:0!important;overflow:hidden!important;background:#fbfffd!important}
    #modal[data-type="test-customer-picker"] header{position:sticky!important;top:0!important;z-index:2!important;display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:12px!important;background:#fff!important;border-bottom:1px solid #edf3f1!important}
    #modal[data-type="test-customer-picker"] header h2{margin:0!important;font-size:18px!important;line-height:1.15!important;min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    #modal[data-type="test-customer-picker"] header button{border:1px solid #dce8e5!important;background:#fff!important;color:#007866!important;border-radius:999px!important;min-height:36px!important;padding:0 12px!important;font-weight:900!important}
    .test-customer-form{min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding:12px!important;display:grid!important;gap:10px!important}
    .test-customer-form .grid{display:grid!important;grid-template-columns:1fr!important;gap:9px!important}.test-customer-form label{display:grid!important;gap:5px!important}.test-customer-form label span{font-size:12px!important;font-weight:950!important;color:#425863!important}
    .test-customer-form input,.test-customer-form textarea{width:100%!important;min-height:42px!important;border:1px solid #cad7d4!important;border-radius:13px!important;background:#fff!important;padding:0 10px!important;font-size:16px!important;box-sizing:border-box!important}.test-customer-form textarea{padding:9px 10px!important;min-height:68px!important}
    .test-picker-summary{display:grid!important;gap:8px!important;border:1px solid #dce8e5!important;border-radius:16px!important;background:#fff!important;padding:10px!important}.test-picker-summary-top{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important}.test-picker-summary b{font-size:14px!important}.test-picker-summary small{display:block!important;color:#63727c!important;font-size:11.5px!important;line-height:1.3!important}.test-picker-open{border:1px solid #9bdccd!important;background:#eafff8!important;color:#007866!important;border-radius:12px!important;min-height:38px!important;padding:0 11px!important;font-weight:950!important;white-space:nowrap!important}.test-picker-selected{display:flex!important;gap:6px!important;overflow-x:auto!important;padding-bottom:1px!important;scrollbar-width:none!important}.test-picker-selected::-webkit-scrollbar{display:none}.test-picker-chip{flex:0 0 auto!important;border-radius:999px!important;border:1px solid #dce8e5!important;background:#fbfffd!important;padding:5px 8px!important;font-size:11px!important;font-weight:850!important;color:#17343d!important;max-width:160px!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    .test-picker-sheet{position:fixed!important;left:50%!important;bottom:calc(10px + env(safe-area-inset-bottom))!important;transform:translateX(-50%)!important;z-index:95!important;width:min(390px,calc(100vw - 20px))!important;max-height:min(76dvh,620px)!important;display:grid!important;grid-template-rows:auto minmax(0,1fr) auto!important;border:1px solid #cfe2dc!important;border-radius:20px!important;background:#fff!important;box-shadow:0 22px 64px rgba(4,34,38,.24)!important;overflow:hidden!important}.test-picker-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;padding:12px!important;border-bottom:1px solid #edf3f1!important}.test-picker-head b{font-size:15px!important}.test-picker-head button{border:0!important;background:#f2f7f5!important;border-radius:12px!important;min-height:36px!important;padding:0 12px!important;font-weight:900!important;color:#17343d!important}.test-picker-list{min-height:0!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;background:#f8fbfa!important;padding:9px!important}.test-picker-item{display:grid!important;grid-template-columns:auto minmax(0,1fr)!important;gap:9px!important;align-items:start!important;border:1px solid #dce8e5!important;border-radius:15px!important;background:#fff!important;padding:10px!important;margin-bottom:8px!important}.test-picker-check{width:24px!important;height:24px!important;accent-color:#00957f!important}.test-picker-item-main{min-width:0!important;display:grid!important;gap:7px!important}.test-picker-name{font-size:14px!important;font-weight:950!important;color:#102a33!important;line-height:1.2!important}.test-picker-controls{display:grid!important;grid-template-columns:1fr!important;gap:7px!important}.test-picker-controls select,.test-picker-controls input{width:100%!important;min-height:38px!important;border:1px solid #d7e6e2!important;border-radius:12px!important;background:#fff!important;padding:0 10px!important;font-size:14px!important;box-sizing:border-box!important}.test-picker-controls input{font-size:15px!important}.test-picker-foot{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;padding:10px 12px!important;border-top:1px solid #edf3f1!important;background:#fff!important}.test-picker-foot small{font-weight:900!important;color:#49646a!important}.test-picker-foot button{border:0!important;border-radius:14px!important;min-height:42px!important;padding:0 14px!important;background:#00957f!important;color:#fff!important;font-weight:950!important}
  `;
  document.head.appendChild(style);
}

function statusOptions(value = 'pending') {
  return STATUS.map(([key, label]) => `<option value="${esc(key)}" ${key === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function renderSelectedSummary() {
  const box = $('[data-test-picker-summary]');
  if (!box) return;
  const entries = [...state.selected.values()];
  const chips = entries.map((entry) => `<span class="test-picker-chip">${esc(entry.product.product_name)} · ${esc(STATUS.find(([key]) => key === entry.status)?.[1] || entry.status)}</span>`).join('');
  box.innerHTML = `<div class="test-picker-summary-top"><div><b>Sản phẩm test</b><small>${entries.length ? `Đã chọn ${entries.length}/${state.products.length} sản phẩm` : `Bấm chọn để tick sản phẩm, không kéo trong card hẹp.`}</small></div><button type="button" class="test-picker-open" data-test-products-open>Chọn</button></div>${entries.length ? `<div class="test-picker-selected">${chips}</div>` : ''}`;
}

function renderSheet() {
  let sheet = $('[data-test-picker-sheet]');
  if (!sheet) {
    sheet = document.createElement('div');
    sheet.className = 'test-picker-sheet';
    sheet.setAttribute('data-test-picker-sheet', '');
    $('#modal')?.appendChild(sheet);
  }
  const rows = state.products.map((product) => {
    const entry = state.selected.get(product.product_id) || { product, status: 'pending', note: '' };
    const checked = state.selected.has(product.product_id);
    return `<article class="test-picker-item" data-test-picker-product="${esc(product.product_id)}"><input class="test-picker-check" type="checkbox" data-test-picker-toggle ${checked ? 'checked' : ''}><div class="test-picker-item-main"><div class="test-picker-name">${esc(product.product_name)}</div><div class="test-picker-controls"><select data-test-picker-status>${statusOptions(entry.status)}</select><input data-test-picker-note placeholder="Ghi chú sản phẩm" value="${esc(entry.note)}"></div></div></article>`;
  }).join('');
  sheet.innerHTML = `<div class="test-picker-head"><b>Tick sản phẩm test</b><button type="button" data-test-picker-close>Đóng</button></div><div class="test-picker-list">${rows || '<p class="empty">File chưa có sản phẩm.</p>'}</div><div class="test-picker-foot"><small>Đã chọn: ${state.selected.size}</small><button type="button" data-test-picker-done>Xong</button></div>`;
}

function syncRowFromControls(row) {
  const productId = row?.dataset.testPickerProduct || '';
  const product = state.products.find((item) => item.product_id === productId);
  if (!product) return;
  const checked = row.querySelector('[data-test-picker-toggle]')?.checked;
  if (!checked) {
    state.selected.delete(productId);
    return;
  }
  state.selected.set(productId, {
    product,
    status: row.querySelector('[data-test-picker-status]')?.value || 'pending',
    note: row.querySelector('[data-test-picker-note]')?.value || ''
  });
}

function closeSheet() {
  $('[data-test-picker-sheet]')?.remove();
  renderSelectedSummary();
}

async function openCustomerPicker(fileId) {
  ensureCss();
  await openLocalDb();
  const [allTests, allItems] = await Promise.all([getAllLocal(LOCAL_STORES.onaTests), getAllLocal(LOCAL_STORES.onaTestItems)]);
  const tests = allTests.filter(activeRow);
  const items = allItems.filter(activeRow);
  const file = tests.find((row) => row.id === fileId);
  const products = items.filter((row) => row.test_id === fileId).map((row) => ({ product_id: row.product_id, product_name: row.product_name }));
  state = { fileId, file, products, selected: new Map(products.map((product) => [product.product_id, { product, status: 'pending', note: '' }])) };
  const modal = $('#modal');
  modal.dataset.type = 'test-customer-picker';
  modal.dataset.fileId = fileId;
  modal.innerHTML = `<form class="modal" data-test-customer-form><header><h2>Thêm khách</h2><button type="button" data-test-customer-close>Đóng</button></header><div class="test-customer-form"><div class="total"><b>${esc(file?.customer_name || 'File test')}</b><br><small>${products.length} sản phẩm trong file</small></div><div class="grid"><label><span>Khách</span><input id="cusName" autocomplete="name"></label><label><span>SĐT</span><input id="cusPhone" inputmode="tel"></label></div><label><span>Khu vực</span><input id="cusArea"></label><section class="test-picker-summary" data-test-picker-summary></section><label><span>Ghi chú khách</span><textarea id="cusNote" rows="2"></textarea></label><button class="primary" data-save-test-customer-picker>Lưu khách test</button></div></form>`;
  modal.showModal();
  renderSelectedSummary();
  setTimeout(() => $('#cusName')?.focus(), 80);
}

function summaryStatus(entries = []) {
  return entries.find((entry) => entry.status && entry.status !== 'pending')?.status || 'pending';
}

async function saveCustomer(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const name = $('#cusName')?.value.trim();
  if (!name) return toast('Thiếu tên khách');
  const entries = [...state.selected.values()];
  if (!entries.length) return toast('Tick ít nhất 1 sản phẩm test');
  const test = makeOnaTest({
    id: uid('test-customer'),
    test_date: todayIsoDate(),
    sales: 'A Tân',
    customer_name: name,
    customer_phone: $('#cusPhone')?.value || '',
    area: $('#cusArea')?.value || '',
    overall_status: summaryStatus(entries),
    overall_note: $('#cusNote')?.value || '',
    sync_status: 'pending',
    raw_payload: { kind: 'test_customer', file_id: state.fileId }
  });
  const items = entries.map((entry) => makeOnaTestItem({
    id: uid('test-result'),
    test_id: test.id,
    product_id: entry.product.product_id,
    product_name: entry.product.product_name,
    status: entry.status,
    note: entry.note
  }));
  await putLocal(LOCAL_STORES.onaTests, test);
  await putManyLocal(LOCAL_STORES.onaTestItems, items);
  await enqueueLocalSync('test_customer', test.id, { test, items });
  $('#modal')?.close();
  $('[data-page="data"]')?.click();
  setTimeout(() => $('#syncBtn')?.click(), 80);
  toast('Đã lưu khách test');
}

document.addEventListener('click', (event) => {
  const add = event.target.closest('[data-add-customer]');
  if (add) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openCustomerPicker(add.dataset.addCustomer);
    return;
  }
  if (!$('#modal[data-type="test-customer-picker"]')) return;
  if (event.target.closest('[data-test-customer-close]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    $('#modal')?.close();
    return;
  }
  if (event.target.closest('[data-test-products-open]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    renderSheet();
    return;
  }
  if (event.target.closest('[data-test-picker-close], [data-test-picker-done]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    closeSheet();
    return;
  }
}, true);

document.addEventListener('change', (event) => {
  const row = event.target.closest('[data-test-picker-product]');
  if (!row || !$('#modal[data-type="test-customer-picker"]')) return;
  syncRowFromControls(row);
  renderSheet();
}, true);

document.addEventListener('input', (event) => {
  const row = event.target.closest('[data-test-picker-product]');
  if (!row || !$('#modal[data-type="test-customer-picker"]')) return;
  syncRowFromControls(row);
}, true);

document.addEventListener('submit', (event) => {
  if (!event.target.closest('[data-test-customer-form]')) return;
  saveCustomer(event);
}, true);
