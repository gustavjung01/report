import { DEFAULT_ONA_PRODUCTS, STORAGE_KEYS_V2, uid, todayIsoDate } from './data-model.js';

const FORM_KEY = 'bepi-local-test-forms-v1';
const ROW_KEY = 'bepi-local-test-rows-v1';

let products = [];
let draftProducts = [];
let activeFormId = '';
let modal;
let formEl;
let listEl;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v = '') => String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const read = (key) => { try { const rows = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(rows) ? rows : []; } catch { return []; } };
const write = (key, rows) => localStorage.setItem(key, JSON.stringify(Array.isArray(rows) ? rows : []));
const clean = (v = '') => String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const now = () => new Date().toISOString();

function toast(message) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function productName(p = {}) {
  return [p.sku, p.name].filter(Boolean).join(' - ') || p.name || '';
}

function shortDate(date = '') {
  const parts = String(date).split('-');
  return parts.length === 3 ? `${parts[2]}-${parts[1]}` : todayIsoDate().slice(5).split('-').reverse().join('-');
}

function injectStyle() {
  if ($('#testFlowStyle')) return;
  const style = document.createElement('style');
  style.id = 'testFlowStyle';
  style.textContent = `
    .test-modal[hidden]{display:none!important}.test-modal{position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:rgba(10,35,32,.48);padding:14px;backdrop-filter:blur(4px)}.test-sheet{width:min(460px,100%);max-height:92vh;overflow:auto;border-radius:24px;background:#f7fbfa;box-shadow:0 24px 70px rgba(0,0,0,.3)}.test-head{padding:16px;background:linear-gradient(135deg,#00796b,#009688);color:#fff;border-radius:24px 24px 0 0}.test-head-top{display:flex;justify-content:space-between;gap:12px}.test-head h2{margin:8px 0 4px}.test-badge{display:inline-flex;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;font-weight:900}.test-close{width:42px;height:42px;border-radius:14px!important;color:#fff!important;background:rgba(255,255,255,.14)!important;border:1px solid rgba(255,255,255,.45)!important}.test-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}.test-steps span{padding:8px;border-radius:13px;background:rgba(255,255,255,.14);font-size:12px;font-weight:800}.test-body{display:grid;gap:12px;padding:14px 14px 94px}.test-card{display:grid;gap:12px;padding:14px;border:1px solid #d8ebe6;border-radius:20px;background:#fff}.test-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.test-field{display:grid!important;gap:6px;margin:0!important}.test-field span{font-size:12px!important;font-weight:800!important;color:#173d39}.test-field input,.test-field select,.test-field textarea{width:100%;min-height:44px;border:1px solid #cfe1dc!important;border-radius:13px!important;background:#fbfffe!important;padding:10px 12px!important;font-size:15px!important;box-sizing:border-box}.test-field textarea{min-height:76px}.compact-add{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end}.selected-products{display:flex;flex-wrap:wrap;gap:8px;min-height:38px}.selected-products .empty{color:#60736f;font-size:13px}.product-pill{display:inline-flex;align-items:center;gap:8px;padding:8px 10px;border-radius:999px;background:#eaf8f5;color:#006f61;border:1px solid #b9e4dd;font-size:13px;font-weight:800}.product-pill button{min-height:24px!important;width:24px!important;padding:0!important;border-radius:999px!important;color:#b42318!important;background:#fff!important;border:1px solid #ffd1d1!important}.test-footer{position:sticky;bottom:0;display:grid;grid-template-columns:1fr 1.3fr;gap:10px;padding:12px 14px;background:rgba(247,251,250,.96);border-top:1px solid #d8ebe6}.test-footer button{min-height:48px;border-radius:15px!important;font-weight:900!important}.test-files-head{display:grid;gap:3px;margin-bottom:12px}.test-files-head h3{margin:0}.test-files-head p{margin:0;color:#60736f;font-size:13px}.test-file-card{cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center}.test-file-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.test-file-meta span,.test-chip{padding:6px 9px;border-radius:999px;background:#eaf8f5;color:#00796b;font-size:12px;font-weight:800}.test-detail-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.test-summary{display:grid;gap:10px;padding:14px;border:1px solid #d5ece7;border-radius:20px;background:linear-gradient(135deg,#e8f7f4,#fff)}.test-chips{display:flex;flex-wrap:wrap;gap:6px}.test-customer-form{display:grid;gap:12px;padding:14px;border:1px solid #d8ebe6;border-radius:20px;background:#fff}.test-product-eval{display:grid;gap:10px;padding:12px;border:1px solid #d7e7e3;border-radius:18px;background:#fff}.test-product-eval h4{margin:0;color:#00796b}.test-checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}.test-checks label{display:flex;align-items:center;gap:7px;padding:9px;border:1px solid #d8ebe6;border-radius:12px;background:#f7fcfb;font-size:13px;font-weight:800}.test-checks input{width:auto!important;min-height:auto!important}.test-result-card{display:grid;grid-template-columns:1fr auto;gap:10px;padding:12px;border:1px solid #d8ebe6;border-radius:18px;background:#fff}.test-result-card h3{margin:0}.test-result-card p{margin:3px 0}.test-status-pill{padding:6px 9px;border-radius:999px;background:#eaf8f5;color:#00796b;font-size:12px;font-weight:900}.test-status-pill.need{background:#fff0e8;color:#bd4b00}.test-product-lines{display:grid;gap:6px;margin-top:8px}.test-product-line{padding:8px;border-radius:12px;background:#f7fcfb;border:1px solid #d8ebe6}.test-product-line b{color:#00796b}.test-ok-pop{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(10,35,32,.42);padding:18px}.test-ok-card{width:min(360px,100%);display:grid;gap:12px;padding:18px;border-radius:22px;background:#fff;box-shadow:0 18px 45px rgba(0,0,0,.24)}@media(max-width:420px){.test-modal{align-items:end;padding:0}.test-sheet{width:100%;max-height:94vh;border-radius:24px 24px 0 0}.test-grid,.test-steps,.test-checks,.compact-add{grid-template-columns:1fr}.test-file-card{grid-template-columns:1fr}.test-detail-top{align-items:stretch;flex-direction:column}.test-detail-top button{width:100%}}
  `;
  document.head.appendChild(style);
}

function loadProducts() {
  const cached = read(STORAGE_KEYS_V2.products);
  const source = cached.length ? cached : DEFAULT_ONA_PRODUCTS;
  products = source.filter((p) => p && p.name).map((p) => ({ id: p.id || p.product_key || uid('prod'), sku: p.sku || '', name: p.name || '', category: p.category || '', brand: p.brand || '' }));
}

function productOptions(filter = '') {
  const q = clean(filter);
  return products.filter((p) => !q || clean([p.sku, p.name, p.category, p.brand].join(' ')).includes(q)).slice(0, 30).map((p) => `<option value="${esc(p.id)}">${esc(productName(p))}</option>`).join('');
}

function productById(id) {
  return products.find((p) => p.id === id) || null;
}

function ensureModal() {
  if ($('#testFormPanel')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <section class="test-modal" id="testFormPanel" hidden>
      <div class="test-sheet">
        <div class="test-head">
          <div class="test-head-top"><div><span class="test-badge">FORM TEST TỔNG</span><h2>Tạo file test theo ngày/tuyến</h2><p>Chọn sản phẩm một lần. Sản phẩm đã chọn nằm gọn bên dưới.</p></div><button type="button" class="test-close" id="closeTestFormBtn">×</button></div>
          <div class="test-steps"><span>1. File tổng</span><span>2. Chọn SP</span><span>3. Nhập khách</span></div>
        </div>
        <form id="onaTestForm">
          <div class="test-body">
            <section class="test-card"><h3>Thông tin file</h3><div class="test-grid"><label class="test-field"><span>Ngày test</span><input type="date" id="onaTestDate" required /></label><label class="test-field"><span>Sales</span><input id="onaTestSales" value="A Tân" /></label></div><label class="test-field"><span>Khu vực / tuyến</span><input id="onaTestRoute" required placeholder="VD: Bến Tre" /></label><label class="test-field"><span>Tên file test tổng</span><input id="onaTestTitle" placeholder="Để trống sẽ tự tạo: Bến Tre-16-08" /></label><label class="test-field"><span>Ghi chú</span><textarea id="onaTestNote" placeholder="Mục tiêu test, mẫu, tuyến..."></textarea></label></section>
            <section class="test-card"><h3>Sản phẩm test cố định</h3><label class="test-field"><span>Tìm nhanh</span><input id="productFilter" placeholder="Gõ mã hoặc tên sản phẩm" /></label><div class="compact-add"><label class="test-field"><span>Chọn sản phẩm</span><select id="productSelect"></select></label><button type="button" class="primary" id="addSelectedProductBtn">＋ Thêm</button></div><div class="selected-products" id="selectedProducts"></div></section>
          </div>
          <div class="test-footer"><button type="button" id="resetTestBtn">Xóa form</button><button type="submit" class="primary">Lưu file tổng</button></div>
        </form>
      </div>
    </section>`);
  modal = $('#testFormPanel');
  formEl = $('#onaTestForm');
}

function ensureList() {
  const panel = document.querySelector('[data-data-panel="tests"]');
  if (!panel) return;
  panel.innerHTML = '<div id="onaTestList" class="test-list"></div>';
  listEl = $('#onaTestList');
}

function renderSelectedProducts() {
  const box = $('#selectedProducts');
  if (!box) return;
  box.innerHTML = draftProducts.length ? draftProducts.map((p) => `<span class="product-pill">${esc(productName(p))}<button type="button" data-remove-selected-product="${esc(p.id)}">×</button></span>`).join('') : '<span class="empty">Chưa chọn sản phẩm test.</span>';
}

function refreshProductSelect(filter = '') {
  const select = $('#productSelect');
  if (select) select.innerHTML = productOptions(filter);
}

function resetForm() {
  formEl.reset();
  $('#onaTestDate').value = todayIsoDate();
  $('#onaTestSales').value = 'A Tân';
  draftProducts = [];
  refreshProductSelect('');
  renderSelectedProducts();
}

function openForm() {
  loadProducts();
  refreshProductSelect('');
  modal.hidden = false;
  document.body.style.overflow = 'hidden';
  renderSelectedProducts();
}

function closeForm() {
  modal.hidden = true;
  document.body.style.overflow = '';
}

function activateData() {
  document.querySelectorAll('.app-page').forEach((page) => page.classList.toggle('is-active', page.id === 'dataSection'));
  document.querySelectorAll('[data-page-link]').forEach((link) => link.classList.toggle('is-active', link.dataset.pageLink === 'dataSection'));
  document.querySelectorAll('[data-data-view]').forEach((button) => button.classList.toggle('is-active', button.dataset.dataView === 'tests'));
  document.querySelectorAll('[data-data-panel]').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.dataPanel === 'tests'));
}

function showSaved(form) {
  const popup = document.createElement('div');
  popup.className = 'test-ok-pop';
  popup.innerHTML = `<article class="test-ok-card"><h3>Đã lưu file test tổng</h3><p><b>${esc(form.title)}</b></p><p>Đang ở tab Test SP. Chọn card file để vào trang chi tiết và thêm khách.</p><button class="primary" type="button">Đã hiểu</button></article>`;
  popup.addEventListener('click', (e) => { if (e.target === popup || e.target.tagName === 'BUTTON') popup.remove(); });
  document.body.appendChild(popup);
}

function saveForm(event) {
  event.preventDefault();
  const route = $('#onaTestRoute').value.trim();
  const date = $('#onaTestDate').value || todayIsoDate();
  if (!route) return toast('Thiếu khu vực / tuyến.');
  if (!draftProducts.length) return toast('Chọn ít nhất 1 sản phẩm test.');
  const form = { id: uid('test-form'), route, title: $('#onaTestTitle').value.trim() || `${route}-${shortDate(date)}`, test_date: date, sales: $('#onaTestSales').value.trim(), products: draftProducts, note: $('#onaTestNote').value.trim(), created_at: now(), sync_status: 'local' };
  const rows = read(FORM_KEY);
  rows.unshift(form);
  write(FORM_KEY, rows);
  activeFormId = '';
  resetForm();
  closeForm();
  activateData();
  renderTests();
  setTimeout(() => showSaved(form), 100);
}

function resultsOf(id) {
  return read(ROW_KEY).filter((row) => row.form_id === id);
}

function listHtml() {
  const forms = read(FORM_KEY).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!forms.length) return '<div class="test-files-head"><h3>Test SP</h3><p>Tab này chỉ lưu card tổng. Tạo file từ màn Tạo.</p></div><article class="record-card placeholder-card"><div><h3>Chưa có file test</h3><p>Tạo file tổng trước, sau đó chọn card để vào chi tiết.</p><small>Local-first.</small></div></article>';
  return `<div class="test-files-head"><h3>Test SP</h3><p>Chỉ hiển thị card tổng. Chọn card để vào trang chi tiết thao tác.</p></div>${forms.map((f) => `<article class="record-card test-file-card" data-open-test-detail="${esc(f.id)}"><div><h3>${esc(f.title)}</h3><p>${f.products.map(productName).map(esc).join(', ')}</p><div class="test-file-meta"><span>${esc(f.test_date)}</span><span>${esc(f.sales || '-')}</span><span>${resultsOf(f.id).length} khách</span></div></div><button type="button" class="test-open-file">Mở file</button></article>`).join('')}`;
}

function productEvalHtml(product, index) {
  return `<article class="test-product-eval" data-product-id="${esc(product.id)}" data-product-name="${esc(productName(product))}"><h4>${index + 1}. ${esc(productName(product))}</h4><div class="test-checks"><label><input type="checkbox" class="eval-tried" /> Đã thử</label><label><input type="checkbox" class="eval-liked" /> Khách thích</label><label><input type="checkbox" class="eval-need-sample" /> Cần gửi mẫu</label><label><input type="checkbox" class="eval-price-ok" /> Giá chấp nhận</label></div><label class="test-field"><span>Kết quả sản phẩm này</span><select class="eval-result"><option value="interested">Quan tâm</option><option value="ok">OK</option><option value="sample">Cần mẫu</option><option value="follow">Hẹn lại</option><option value="bad">Chưa phù hợp</option></select></label><label class="test-field"><span>Ý kiến khác riêng sản phẩm này</span><textarea class="eval-other" placeholder="Ghi ý kiến khác, vị, màu, giá, lý do khách thích/không thích..."></textarea></label><label class="test-field"><span>Việc cần làm cho sản phẩm này</span><input class="eval-next" placeholder="Gửi mẫu, báo giá, hẹn lại..." /></label></article>`;
}

function customerForm(form) {
  return `<form id="testCustomerForm" data-form-id="${esc(form.id)}" class="test-customer-form"><h3>Thêm khách vào file này</h3><div class="test-grid"><label class="test-field"><span>Khách hàng</span><input id="testCustomerName" required /></label><label class="test-field"><span>SĐT</span><input id="testCustomerPhone" /></label></div><div class="test-grid"><label class="test-field"><span>Khu vực</span><input id="testCustomerArea" value="${esc(form.route || '')}" /></label><label class="test-field"><span>Loại điểm bán</span><input id="testShopType" /></label></div><h3>Kết quả theo từng sản phẩm</h3>${form.products.map(productEvalHtml).join('')}<label class="test-field"><span>Ghi chú chung của khách</span><textarea id="testGeneralNote" placeholder="Thông tin chung không thuộc riêng sản phẩm nào..."></textarea></label><button class="primary" type="submit">Lưu khách test</button></form>`;
}

function productSummary(row) {
  const items = Array.isArray(row.product_results) ? row.product_results : [];
  return `<div class="test-product-lines">${items.map((item) => `<div class="test-product-line"><b>${esc(item.product_name)}</b> · ${esc(item.result_label || item.result || '-')} ${item.need_sample ? '· Cần mẫu' : ''}${item.other_feedback ? `<br><small>${esc(item.other_feedback)}</small>` : ''}</div>`).join('')}</div>`;
}

function detailHtml(form) {
  const rows = resultsOf(form.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return `<section><div class="test-detail-top"><button type="button" id="backToTestList">‹ Quay lại Test SP</button><strong>Trang chi tiết file</strong></div><article class="test-summary"><h2>${esc(form.title)}</h2><small>${esc(form.test_date)} · ${esc(form.sales)} · ${rows.length} khách test</small><div class="test-chips">${form.products.map((p) => `<span class="test-chip">${esc(productName(p))}</span>`).join('')}</div></article>${customerForm(form)}<h3>Khách đã test</h3>${rows.length ? rows.map((row) => `<article class="test-result-card"><div><h3>${esc(row.customer_name)}</h3><small>${esc(row.area || '')} ${row.need_sample ? '· Có sản phẩm cần mẫu' : ''}</small>${productSummary(row)}</div><span class="test-status-pill ${row.need_sample ? 'need' : ''}">${row.product_results?.length || 0} SP</span></article>`).join('') : '<article class="empty-sync-card">Chưa có khách test trong file này.</article>'}</section>`;
}

function renderTests() {
  if (!listEl) ensureList();
  if (!listEl) return;
  const form = activeFormId ? read(FORM_KEY).find((f) => f.id === activeFormId) : null;
  listEl.innerHTML = form ? detailHtml(form) : listHtml();
}

function saveCustomer(event) {
  event.preventDefault();
  const form = read(FORM_KEY).find((item) => item.id === event.target.dataset.formId);
  if (!form) return toast('Không tìm thấy file test.');
  const name = $('#testCustomerName').value.trim();
  if (!name) return toast('Thiếu tên khách test.');
  const labels = { interested: 'Quan tâm', ok: 'OK', sample: 'Cần mẫu', follow: 'Hẹn lại', bad: 'Chưa phù hợp' };
  const product_results = $$('.test-product-eval', event.target).map((card) => {
    const result = $('.eval-result', card).value;
    return { product_id: card.dataset.productId, product_name: card.dataset.productName, tried: $('.eval-tried', card).checked, liked: $('.eval-liked', card).checked, need_sample: $('.eval-need-sample', card).checked, price_ok: $('.eval-price-ok', card).checked, result, result_label: labels[result] || result, other_feedback: $('.eval-other', card).value.trim(), next_action: $('.eval-next', card).value.trim() };
  });
  const rows = read(ROW_KEY);
  rows.unshift({ id: uid('test-row'), form_id: form.id, customer_name: name, customer_phone: $('#testCustomerPhone').value.trim(), area: $('#testCustomerArea').value.trim(), shop_type: $('#testShopType').value.trim(), general_note: $('#testGeneralNote').value.trim(), product_results, need_sample: product_results.some((item) => item.need_sample), created_at: now(), sync_status: 'local' });
  write(ROW_KEY, rows);
  renderTests();
  toast('Đã lưu khách test đủ từng sản phẩm.');
}

function bind() {
  document.querySelector('[data-create-type="test"]')?.addEventListener('click', (e) => { e.preventDefault(); openForm(); });
  $('#closeTestFormBtn')?.addEventListener('click', closeForm);
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeForm(); });
  $('#productFilter')?.addEventListener('input', (e) => refreshProductSelect(e.target.value));
  $('#addSelectedProductBtn')?.addEventListener('click', () => {
    const product = productById($('#productSelect')?.value);
    if (!product) return toast('Chọn sản phẩm trước.');
    if (draftProducts.some((item) => item.id === product.id)) return toast('Sản phẩm này đã có trong file test.');
    draftProducts.push({ id: product.id, sku: product.sku, name: product.name, category: product.category, brand: product.brand });
    renderSelectedProducts();
  });
  $('#selectedProducts')?.addEventListener('click', (e) => {
    const remove = e.target.closest('[data-remove-selected-product]');
    if (!remove) return;
    draftProducts = draftProducts.filter((item) => item.id !== remove.dataset.removeSelectedProduct);
    renderSelectedProducts();
  });
  $('#resetTestBtn')?.addEventListener('click', resetForm);
  formEl?.addEventListener('submit', saveForm);
  listEl?.addEventListener('click', (e) => {
    const open = e.target.closest('[data-open-test-detail]');
    if (open) { activeFormId = open.dataset.openTestDetail; activateData(); renderTests(); }
    if (e.target.closest('#backToTestList')) { activeFormId = ''; activateData(); renderTests(); }
  });
  listEl?.addEventListener('submit', (e) => { if (e.target?.id === 'testCustomerForm') saveCustomer(e); });
  document.querySelector('[data-data-view="tests"]')?.addEventListener('click', () => setTimeout(renderTests, 0));
}

function init() {
  loadCss('order-module.css');
  loadCss('test-module.css');
  injectStyle();
  loadProducts();
  ensureModal();
  ensureList();
  resetForm();
  bind();
  renderTests();
  setTimeout(renderTests, 700);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
