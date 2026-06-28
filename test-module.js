import { DEFAULT_ONA_PRODUCTS, STORAGE_KEYS_V2, uid, todayIsoDate } from './data-model.js';

const FORM_KEY = 'bepi-local-test-forms-v1';
const ROW_KEY = 'bepi-local-test-rows-v1';
let products = [];
let activeFormId = '';
let panel, formEl, productBox, listEl;

function $(s, r = document) { return r.querySelector(s); }
function $$(s, r = document) { return Array.from(r.querySelectorAll(s)); }
function html(v = '') { return String(v ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function read(key) { try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : []; } catch { return []; } }
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function toast(message) { const t = $('#toast'); if (!t) return; t.textContent = message; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }
function now() { return new Date().toISOString(); }
function norm(v = '') { return String(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function ensureInlineStyle() {
  if ($('#testMasterInlineStyle')) return;
  const style = document.createElement('style');
  style.id = 'testMasterInlineStyle';
  style.textContent = `
    .test-master-toolbar{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:12px}.test-master-toolbar h3{margin:0}.test-master-toolbar p{margin:2px 0 0;color:#60736f;font-size:13px}
    .test-master-modal[hidden]{display:none!important}.test-master-modal{position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:rgba(0,0,0,.42);padding:14px}.test-master-modal-card{width:min(430px,100%);max-height:88vh;overflow:auto;border-radius:22px;background:#fff;padding:14px;box-shadow:0 24px 60px rgba(0,0,0,.28)}.test-master-modal-card .section-head{position:sticky;top:0;z-index:2;background:#fff;padding-bottom:10px}.test-master-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;position:sticky;bottom:0;background:#fff;padding-top:10px}.test-master-actions .primary{width:100%}.test-master-popup{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(0,0,0,.36);padding:18px}.test-master-popup-card{width:min(360px,100%);display:grid;gap:12px;border-radius:22px;background:#fff;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.22)}.test-master-popup-card h3{margin:0}.test-master-popup-card p{margin:0;color:#60736f}.test-master-popup-actions{display:grid;grid-template-columns:1fr 1fr;gap:10px}.test-master-popup-actions .primary{width:100%}
    @media(max-width:420px){.test-master-toolbar{align-items:stretch;flex-direction:column}.test-master-toolbar button{width:100%}.test-master-modal{align-items:end;padding:0}.test-master-modal-card{width:100%;max-height:92vh;border-radius:22px 22px 0 0;padding:14px 14px calc(14px + env(safe-area-inset-bottom))}}
  `;
  document.head.appendChild(style);
}

function showCreatedPopup(row) {
  document.querySelector('.test-master-popup')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'test-master-popup';
  wrap.innerHTML = `<article class="test-master-popup-card"><h3>Đã tạo bản test tổng</h3><p>${html(row.title)}</p><p>Đã mở Dữ liệu → Test SP → Chi tiết. Nhập khách test trực tiếp trong bản này.</p><div class="test-master-popup-actions"><button type="button" data-close-test-popup>Đóng</button><button type="button" class="primary" data-close-test-popup>Nhập khách ngay</button></div></article>`;
  wrap.addEventListener('click', (event) => { if (event.target === wrap || event.target.closest('[data-close-test-popup]')) wrap.remove(); });
  document.body.appendChild(wrap);
}

function loadProducts() {
  const cached = read(STORAGE_KEYS_V2.products);
  const source = Array.isArray(cached) && cached.length ? cached : DEFAULT_ONA_PRODUCTS;
  products = source.filter((p) => p && p.name).map((p) => ({ id: p.id || p.product_key || uid('prod'), sku: p.sku || '', name: p.name || '', category: p.category || '', brand: p.brand || '' }));
}

function productName(p) { return [p.sku, p.name].filter(Boolean).join(' - ') || p.name || ''; }
function productOptions(filter = '') {
  const q = norm(filter).trim();
  return products.filter((p) => !q || norm([p.sku, p.name, p.category, p.brand].join(' ')).includes(q)).slice(0, 30).map((p) => `<option value="${html(p.id)}">${html(productName(p))}</option>`).join('');
}
function productById(id) { return products.find((p) => p.id === id) || null; }

function productRow() {
  return `<article class="test-item-row fixed-test-product"><label><span>Lọc sản phẩm</span><input class="fixed-product-filter" type="text" placeholder="Gõ mã/tên sản phẩm" /></label><label><span>Sản phẩm test</span><select class="fixed-product-select">${productOptions()}</select></label><button type="button" class="remove-fixed-product">Xóa</button></article>`;
}

function ensurePanel() {
  if ($('#testFormPanel')) return;
  document.body.insertAdjacentHTML('beforeend', `<section class="test-master-modal" id="testFormPanel" hidden>
    <div class="test-master-modal-card">
      <div class="section-head test-head"><div><h2>Tạo bản test tổng</h2><p>Bản test tổng theo ngày/tuyến. Tạo xong sẽ qua Dữ liệu để nhập khách test.</p></div><button type="button" id="closeTestFormBtn">Đóng</button></div>
      <form id="onaTestForm" class="test-form">
        <div class="form-grid two"><label><span>Ngày test tổng</span><input type="date" id="onaTestDate" required /></label><label><span>Sales</span><input id="onaTestSales" value="A Tân" /></label></div>
        <label><span>Tên bản test tổng</span><input id="onaTestTitle" required placeholder="VD: Test ONA Olong Sen - tuyến Gò Vấp" /></label>
        <div class="section-head test-products-head"><div><h2>Sản phẩm test cố định</h2><p>Thêm đúng sản phẩm cần test, không hiện cả kho dài.</p></div><button type="button" id="addFixedProductBtn">＋ Sản phẩm</button></div>
        <div id="onaFixedProducts" class="test-items"></div>
        <label><span>Ghi chú bản test</span><textarea id="onaTestNote" rows="2" placeholder="Mục tiêu test, mẫu, tuyến..."></textarea></label>
        <div class="test-master-actions"><button type="button" id="resetTestBtn">Xóa form</button><button type="submit" class="primary">Lưu bản test tổng</button></div>
      </form>
    </div>
  </section>`);
  panel = $('#testFormPanel');
  formEl = $('#onaTestForm');
  productBox = $('#onaFixedProducts');
}

function ensureList() {
  const dataPanel = document.querySelector('[data-data-panel="tests"]');
  if (!dataPanel) return;
  dataPanel.innerHTML = '<div id="onaTestList" class="test-list"></div>';
  listEl = $('#onaTestList');
}

function resetForm() {
  if (!formEl) return;
  formEl.reset();
  $('#onaTestDate').value = todayIsoDate();
  $('#onaTestSales').value = 'A Tân';
  productBox.innerHTML = productRow();
}

function openForm() {
  loadProducts();
  panel.hidden = false;
  document.body.style.overflow = 'hidden';
  if (!productBox.children.length) resetForm();
}
function closeForm() { if (panel) panel.hidden = true; document.body.style.overflow = ''; }

function collectProducts() {
  return $$('.fixed-test-product').map((row) => productById($('.fixed-product-select', row).value)).filter(Boolean).map((p) => ({ id: p.id, sku: p.sku, name: p.name, category: p.category, brand: p.brand }));
}

function saveForm(e) {
  e.preventDefault();
  const title = $('#onaTestTitle').value.trim();
  const fixed = collectProducts();
  if (!title) return toast('Thiếu tên bản test tổng.');
  if (!fixed.length) return toast('Chọn ít nhất 1 sản phẩm test.');
  const rows = read(FORM_KEY);
  const row = { id: uid('test-form'), title, test_date: $('#onaTestDate').value || todayIsoDate(), sales: $('#onaTestSales').value.trim(), products: fixed, note: $('#onaTestNote').value.trim(), created_at: now(), sync_status: 'local' };
  rows.unshift(row);
  write(FORM_KEY, rows);
  activeFormId = row.id;
  resetForm();
  closeForm();
  document.querySelector('[data-page-link="dataSection"]')?.click();
  document.querySelector('[data-data-view="tests"]')?.click();
  renderTests();
  setTimeout(() => showCreatedPopup(row), 120);
}

function resultsOf(formId) { return read(ROW_KEY).filter((r) => r.form_id === formId); }
function toolbarHtml() {
  return `<div class="test-master-toolbar"><div><h3>Test sản phẩm</h3><p>Tạo bản test tổng trước, sau đó chọn bản để nhập khách.</p></div><button type="button" class="primary" data-create-test-master>＋ Thêm bản test tổng</button></div>`;
}
function formListHtml() {
  const forms = read(FORM_KEY).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!forms.length) return `${toolbarHtml()}<article class="record-card placeholder-card"><div><h3>Chưa có bản test tổng</h3><p>Bấm “＋ Thêm bản test tổng” để tạo bản test của ngày/tuyến trước.</p><small>Đang local-first, chưa ghi Supabase.</small></div></article>`;
  return `${toolbarHtml()}${forms.map((f) => `<article class="record-card"><div><h3>${html(f.title)}</h3><p>${f.products.map(productName).map(html).join(', ')}</p><small>${html(f.test_date)} · ${html(f.sales)} · ${resultsOf(f.id).length} khách test</small></div><aside><span class="status ok">Bản test tổng</span><button type="button" data-open-test-detail="${html(f.id)}">Chọn / nhập khách</button><em class="sync-dot warn">Local</em></aside></article>`).join('')}`;
}

function customerFormHtml(f) {
  const options = f.products.map((p) => `<option value="${html(p.id)}">${html(productName(p))}</option>`).join('');
  return `<form id="testCustomerForm" data-form-id="${html(f.id)}" class="test-form"><h3>Thêm khách test vào bản này</h3><div class="form-grid two"><label><span>Khách hàng</span><input id="testCustomerName" required /></label><label><span>SĐT</span><input id="testCustomerPhone" /></label></div><div class="form-grid two"><label><span>Khu vực</span><input id="testCustomerArea" /></label><label><span>Loại điểm bán</span><input id="testShopType" /></label></div><div class="form-grid two"><label><span>Sản phẩm test</span><select id="testProductId">${options}</select></label><label><span>Kết quả</span><select id="testResult"><option value="interested">Quan tâm</option><option value="ok">OK</option><option value="sample">Cần mẫu</option><option value="follow">Hẹn lại</option><option value="bad">Chưa phù hợp</option></select></label></div><div class="form-grid two"><label><span>Hẹn lại</span><input type="date" id="testFollowDate" /></label><label class="need-sample-row"><input type="checkbox" id="testNeedSample" /> Cần gửi mẫu</label></div><label><span>Thử như nào / phản hồi</span><textarea id="testFeedback" rows="2"></textarea></label><label><span>Hành động tiếp theo</span><input id="testNextAction" /></label><button class="primary" type="submit">Lưu khách test</button></form>`;
}

function detailHtml(f) {
  const rows = resultsOf(f.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return `<section class="test-detail"><div class="test-master-toolbar"><button type="button" id="backToTestList">‹ Danh sách bản test</button><button type="button" class="primary" data-create-test-master>＋ Thêm bản test tổng</button></div><article class="panel-card"><h2>${html(f.title)}</h2><p><b>Sản phẩm cố định:</b> ${f.products.map(productName).map(html).join(', ')}</p><small>${html(f.test_date)} · ${html(f.sales)}</small></article>${customerFormHtml(f)}<h3>Khách đã test</h3>${rows.length ? rows.map((r) => `<article class="record-card"><div><h3>${html(r.customer_name)}</h3><p>${html(r.product_name)} · ${html(r.result_label)}</p><p>${html(r.feedback || '-')}</p><small>${html(r.area || '')}${r.need_sample ? ' · Cần mẫu' : ''}</small></div><aside><span class="status ${r.need_sample ? 'danger-soft' : 'ok'}">${r.need_sample ? 'Cần mẫu' : 'Đã test'}</span><em class="sync-dot warn">Local</em></aside></article>`).join('') : '<article class="empty-sync-card">Chưa có khách test.</article>'}</section>`;
}

function renderTests() {
  if (!listEl) return;
  const form = activeFormId ? read(FORM_KEY).find((f) => f.id === activeFormId) : null;
  listEl.innerHTML = form ? detailHtml(form) : formListHtml();
}

function saveCustomer(e) {
  e.preventDefault();
  const formId = e.target.dataset.formId;
  const form = read(FORM_KEY).find((f) => f.id === formId);
  if (!form) return toast('Không tìm thấy bản test tổng.');
  const product = form.products.find((p) => p.id === $('#testProductId').value) || form.products[0];
  const name = $('#testCustomerName').value.trim();
  if (!name) return toast('Thiếu tên khách test.');
  const labels = { interested: 'Quan tâm', ok: 'OK', sample: 'Cần mẫu', follow: 'Hẹn lại', bad: 'Chưa phù hợp' };
  const result = $('#testResult').value;
  const rows = read(ROW_KEY);
  rows.unshift({ id: uid('test-row'), form_id: formId, customer_name: name, customer_phone: $('#testCustomerPhone').value.trim(), area: $('#testCustomerArea').value.trim(), shop_type: $('#testShopType').value.trim(), product_id: product.id, product_name: productName(product), result, result_label: labels[result] || result, need_sample: $('#testNeedSample').checked, follow_date: $('#testFollowDate').value || null, feedback: $('#testFeedback').value.trim(), next_action: $('#testNextAction').value.trim(), created_at: now(), sync_status: 'local' });
  write(ROW_KEY, rows);
  renderTests();
  toast('Đã lưu khách test.');
}

function bind() {
  document.querySelector('[data-create-type="test"]')?.addEventListener('click', (e) => { e.preventDefault(); openForm(); });
  $('#closeTestFormBtn')?.addEventListener('click', closeForm);
  panel?.addEventListener('click', (e) => { if (e.target === panel) closeForm(); });
  $('#resetTestBtn')?.addEventListener('click', resetForm);
  $('#addFixedProductBtn')?.addEventListener('click', () => productBox.insertAdjacentHTML('beforeend', productRow()));
  formEl?.addEventListener('submit', saveForm);
  productBox?.addEventListener('click', (e) => { if (e.target.closest('.remove-fixed-product')) e.target.closest('.fixed-test-product')?.remove(); });
  productBox?.addEventListener('input', (e) => { const input = e.target.closest('.fixed-product-filter'); if (!input) return; const row = input.closest('.fixed-test-product'); $('.fixed-product-select', row).innerHTML = productOptions(input.value); });
  listEl?.addEventListener('click', (e) => { if (e.target.closest('[data-create-test-master]')) { activeFormId = ''; openForm(); return; } const open = e.target.closest('[data-open-test-detail]'); if (open) { activeFormId = open.dataset.openTestDetail; renderTests(); } if (e.target.closest('#backToTestList')) { activeFormId = ''; renderTests(); } });
  listEl?.addEventListener('submit', (e) => { if (e.target?.id === 'testCustomerForm') saveCustomer(e); });
}

function init() {
  loadCss('order-module.css');
  loadCss('test-module.css');
  ensureInlineStyle();
  loadProducts();
  ensurePanel();
  ensureList();
  resetForm();
  bind();
  renderTests();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
