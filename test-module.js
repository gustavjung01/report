import { DEFAULT_ONA_PRODUCTS, STORAGE_KEYS_V2, uid, todayIsoDate } from './data-model.js';

const FORM_KEY = 'bepi-local-test-forms-v1';
const ROW_KEY = 'bepi-local-test-rows-v1';

let products = [];
let activeFormId = '';
let panel;
let formEl;
let productBox;
let listEl;

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function readRows(key) {
  try {
    const raw = localStorage.getItem(key);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function writeRows(key, value) {
  localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
}

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
}

function nowIso() {
  return new Date().toISOString();
}

function normalize(value = '') {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function injectStyle() {
  if ($('#testMasterInlineStyle')) return;
  const style = document.createElement('style');
  style.id = 'testMasterInlineStyle';
  style.textContent = `
    .test-master-toolbar{display:grid;gap:10px;margin-bottom:12px}.test-master-toolbar-top{display:flex;justify-content:space-between;align-items:center;gap:10px}.test-master-toolbar h3{margin:0;font-size:18px}.test-master-toolbar p{margin:3px 0 0;color:#60736f;font-size:13px}.test-master-toolbar .primary{min-height:44px;border-radius:14px;font-weight:800}
    .test-master-modal[hidden]{display:none!important}.test-master-modal{position:fixed;inset:0;z-index:999;display:grid;place-items:center;background:rgba(13,38,36,.48);padding:14px;backdrop-filter:blur(4px)}.test-master-sheet{width:min(460px,100%);max-height:90vh;overflow:auto;border-radius:26px;background:#f7fbfa;box-shadow:0 28px 80px rgba(0,0,0,.32);border:1px solid rgba(255,255,255,.75)}
    .test-master-head{position:sticky;top:0;z-index:3;padding:16px;background:linear-gradient(135deg,#00796b,#009688);color:#fff;border-radius:26px 26px 0 0}.test-master-head-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.test-master-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.18);font-size:11px;font-weight:900;letter-spacing:.04em}.test-master-head h2{margin:8px 0 4px;font-size:22px;line-height:1.1}.test-master-head p{margin:0;color:rgba(255,255,255,.86);font-size:13px;line-height:1.35}.test-master-close{min-width:42px;height:42px;border:1px solid rgba(255,255,255,.55)!important;border-radius:14px!important;background:rgba(255,255,255,.13)!important;color:#fff!important;font-size:20px!important;font-weight:900!important}
    .test-master-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.test-master-step{display:grid;gap:2px;padding:9px;border-radius:14px;background:rgba(255,255,255,.14)}.test-master-step strong{font-size:12px}.test-master-step small{color:rgba(255,255,255,.76);font-size:11px}
    .test-master-body{display:grid;gap:12px;padding:14px 14px 96px}.test-section-card{display:grid;gap:12px;padding:14px;border:1px solid #d9ebe6;border-radius:20px;background:#fff;box-shadow:0 8px 24px rgba(9,91,82,.06)}.test-section-title{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.test-section-title h3{margin:0;font-size:16px}.test-section-title p{margin:3px 0 0;color:#60736f;font-size:12px;line-height:1.35}.test-add-product{min-height:40px;padding:0 12px!important;border-radius:12px!important;font-weight:900!important;white-space:nowrap}
    .test-field-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.test-field{display:grid!important;gap:6px;margin:0!important}.test-field span{font-size:12px!important;font-weight:800!important;color:#173d39}.test-field input,.test-field select,.test-field textarea{width:100%;min-height:44px;border:1px solid #cfe1dc!important;border-radius:13px!important;background:#fbfffe!important;padding:10px 12px!important;font-size:15px!important;box-sizing:border-box}.test-field textarea{min-height:82px;resize:vertical}
    .fixed-product-list{display:grid;gap:10px}.fixed-product-card{display:grid;gap:10px;padding:12px;border:1px solid #d7e7e3;border-radius:18px;background:linear-gradient(180deg,#ffffff,#f7fcfb)}.fixed-product-card-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.fixed-product-card-head strong{font-size:13px;color:#00796b}.fixed-product-remove{min-height:34px;padding:0 10px!important;border-radius:10px!important;color:#b42318!important;background:#fff5f5!important;border:1px solid #ffd1d1!important;font-weight:800!important}
    .test-master-footer{position:sticky;bottom:0;z-index:4;display:grid;grid-template-columns:1fr 1.3fr;gap:10px;padding:12px 14px calc(12px + env(safe-area-inset-bottom));background:rgba(247,251,250,.96);border-top:1px solid #d9ebe6;backdrop-filter:blur(8px)}.test-master-footer button{min-height:48px;border-radius:15px!important;font-weight:900!important}.test-master-footer .primary{box-shadow:0 10px 24px rgba(0,150,136,.24)}
    .test-master-popup{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;background:rgba(13,38,36,.42);padding:18px;backdrop-filter:blur(4px)}.test-master-popup-card{width:min(360px,100%);display:grid;gap:12px;border-radius:24px;background:#fff;padding:18px;box-shadow:0 20px 50px rgba(0,0,0,.24)}.test-master-popup-card h3{margin:0;color:#004d45}.test-master-popup-card p{margin:0;color:#60736f;line-height:1.45}.test-master-popup-actions{display:grid;grid-template-columns:1fr 1.2fr;gap:10px}.test-master-popup-actions button{min-height:44px;border-radius:14px!important;font-weight:900!important}.test-master-popup-actions .primary{width:100%}
    .test-detail-summary{display:grid;gap:10px;padding:14px;border-radius:20px;background:linear-gradient(135deg,#e8f7f4,#ffffff);border:1px solid #d5ece7}.test-detail-summary h2{margin:0}.test-product-chips{display:flex;flex-wrap:wrap;gap:6px}.test-product-chip{padding:7px 9px;border-radius:999px;background:#fff;border:1px solid #cae7e1;color:#00796b;font-size:12px;font-weight:800}.test-customer-card{display:grid;gap:12px;padding:14px;border:1px solid #d9ebe6;border-radius:20px;background:#fff}.test-record-list{display:grid;gap:10px}.test-record-card{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:start;padding:12px;border:1px solid #d9ebe6;border-radius:18px;background:#fff}.test-record-card h3{margin:0 0 4px}.test-record-card p{margin:2px 0;color:#38524e}.test-record-card small{color:#60736f}.test-record-status{padding:6px 9px;border-radius:999px;background:#e8f7f4;color:#00796b;font-size:12px;font-weight:900}.test-record-status.need{background:#fff0e8;color:#bd4b00}
    @media(max-width:420px){.test-master-modal{align-items:end;padding:0}.test-master-sheet{width:100%;max-height:94vh;border-radius:24px 24px 0 0}.test-master-head{border-radius:24px 24px 0 0}.test-master-steps{grid-template-columns:1fr}.test-field-grid{grid-template-columns:1fr}.test-master-toolbar-top{align-items:stretch;flex-direction:column}.test-master-toolbar .primary{width:100%}}
  `;
  document.head.appendChild(style);
}

function showCreatedPopup(form) {
  document.querySelector('.test-master-popup')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'test-master-popup';
  wrap.innerHTML = `
    <article class="test-master-popup-card">
      <h3>Đã tạo bản test tổng</h3>
      <p><b>${escapeHtml(form.title)}</b></p>
      <p>Đã mở chi tiết bản test. Bây giờ nhập khách test trực tiếp trong màn này.</p>
      <div class="test-master-popup-actions">
        <button type="button" data-close-test-popup>Đóng</button>
        <button type="button" class="primary" data-close-test-popup>Nhập khách ngay</button>
      </div>
    </article>`;
  wrap.addEventListener('click', (event) => {
    if (event.target === wrap || event.target.closest('[data-close-test-popup]')) wrap.remove();
  });
  document.body.appendChild(wrap);
}

function loadProducts() {
  const cached = readRows(STORAGE_KEYS_V2.products);
  const source = cached.length ? cached : DEFAULT_ONA_PRODUCTS;
  products = source.filter((item) => item && item.name).map((item) => ({
    id: item.id || item.product_key || uid('prod'),
    sku: item.sku || '',
    name: item.name || '',
    category: item.category || '',
    brand: item.brand || ''
  }));
}

function productName(product = {}) {
  return [product.sku, product.name].filter(Boolean).join(' - ') || product.name || '';
}

function productOptions(filter = '') {
  const query = normalize(filter).trim();
  return products
    .filter((product) => !query || normalize([product.sku, product.name, product.category, product.brand].join(' ')).includes(query))
    .slice(0, 30)
    .map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(productName(product))}</option>`)
    .join('');
}

function productById(id) {
  return products.find((product) => product.id === id) || null;
}

function fixedProductRowHtml() {
  return `
    <article class="fixed-product-card">
      <div class="fixed-product-card-head">
        <strong class="fixed-product-index">Sản phẩm test</strong>
        <button type="button" class="fixed-product-remove">Bỏ dòng</button>
      </div>
      <label class="test-field">
        <span>Tìm nhanh</span>
        <input class="fixed-product-filter" type="text" placeholder="Gõ mã hoặc tên sản phẩm" autocomplete="off" />
      </label>
      <label class="test-field">
        <span>Chọn sản phẩm</span>
        <select class="fixed-product-select">${productOptions()}</select>
      </label>
    </article>`;
}

function renumberProducts() {
  $$('.fixed-product-card', productBox).forEach((row, index) => {
    const label = $('.fixed-product-index', row);
    if (label) label.textContent = `Sản phẩm test #${index + 1}`;
  });
}

function ensurePanel() {
  if ($('#testFormPanel')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <section class="test-master-modal" id="testFormPanel" hidden>
      <div class="test-master-sheet">
        <div class="test-master-head">
          <div class="test-master-head-row">
            <div>
              <span class="test-master-badge">FORM TEST TỔNG</span>
              <h2>Tạo bản test theo ngày/tuyến</h2>
              <p>Chọn sản phẩm test cố định trước. Lưu xong app chuyển sang Dữ liệu để nhập từng khách test.</p>
            </div>
            <button type="button" class="test-master-close" id="closeTestFormBtn" aria-label="Đóng">×</button>
          </div>
          <div class="test-master-steps">
            <div class="test-master-step"><strong>1. Bản test</strong><small>Ngày, sales, tuyến</small></div>
            <div class="test-master-step"><strong>2. Sản phẩm</strong><small>Danh sách cố định</small></div>
            <div class="test-master-step"><strong>3. Khách test</strong><small>Nhập ở Dữ liệu</small></div>
          </div>
        </div>
        <form id="onaTestForm" class="test-form">
          <div class="test-master-body">
            <section class="test-section-card">
              <div class="test-section-title">
                <div><h3>Thông tin bản test</h3><p>Mỗi ngày/tuyến nên tạo một bản riêng để dễ tổng hợp.</p></div>
              </div>
              <div class="test-field-grid">
                <label class="test-field"><span>Ngày test tổng</span><input type="date" id="onaTestDate" required /></label>
                <label class="test-field"><span>Sales</span><input id="onaTestSales" value="A Tân" /></label>
              </div>
              <label class="test-field"><span>Tên bản test tổng</span><input id="onaTestTitle" required placeholder="VD: Test ONA Olong Sen - tuyến Gò Vấp" /></label>
              <label class="test-field"><span>Ghi chú</span><textarea id="onaTestNote" placeholder="Mục tiêu test, mẫu, tuyến, lưu ý cho sales..."></textarea></label>
            </section>
            <section class="test-section-card">
              <div class="test-section-title">
                <div><h3>Sản phẩm test cố định</h3><p>Chỉ thêm đúng sản phẩm cần test, không bung toàn bộ kho.</p></div>
                <button type="button" class="test-add-product" id="addFixedProductBtn">＋ Thêm</button>
              </div>
              <div id="onaFixedProducts" class="fixed-product-list"></div>
            </section>
          </div>
          <div class="test-master-footer">
            <button type="button" id="resetTestBtn">Xóa form</button>
            <button type="submit" class="primary">Lưu & nhập khách</button>
          </div>
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
  if (!formEl || !productBox) return;
  formEl.reset();
  $('#onaTestDate').value = todayIsoDate();
  $('#onaTestSales').value = 'A Tân';
  productBox.innerHTML = fixedProductRowHtml();
  renumberProducts();
}

function openForm() {
  loadProducts();
  panel.hidden = false;
  document.body.style.overflow = 'hidden';
  if (!productBox.children.length) resetForm();
}

function closeForm() {
  if (panel) panel.hidden = true;
  document.body.style.overflow = '';
}

function collectProducts() {
  const picked = $$('.fixed-product-card', productBox)
    .map((row) => productById($('.fixed-product-select', row)?.value))
    .filter(Boolean)
    .map((product) => ({ id: product.id, sku: product.sku, name: product.name, category: product.category, brand: product.brand }));
  const seen = new Set();
  return picked.filter((product) => {
    if (seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });
}

function saveForm(event) {
  event.preventDefault();
  const title = $('#onaTestTitle').value.trim();
  const fixedProducts = collectProducts();
  if (!title) return toast('Thiếu tên bản test tổng.');
  if (!fixedProducts.length) return toast('Chọn ít nhất 1 sản phẩm test.');

  const form = {
    id: uid('test-form'),
    title,
    test_date: $('#onaTestDate').value || todayIsoDate(),
    sales: $('#onaTestSales').value.trim(),
    products: fixedProducts,
    note: $('#onaTestNote').value.trim(),
    created_at: nowIso(),
    sync_status: 'local'
  };
  const rows = readRows(FORM_KEY);
  rows.unshift(form);
  writeRows(FORM_KEY, rows);
  activeFormId = form.id;
  resetForm();
  closeForm();
  document.querySelector('[data-page-link="dataSection"]')?.click();
  document.querySelector('[data-data-view="tests"]')?.click();
  renderTests();
  setTimeout(() => showCreatedPopup(form), 100);
}

function resultsOf(formId) {
  return readRows(ROW_KEY).filter((row) => row.form_id === formId);
}

function toolbarHtml() {
  return `
    <div class="test-master-toolbar">
      <div class="test-master-toolbar-top">
        <div><h3>Test sản phẩm</h3><p>Tạo bản test tổng trước, sau đó chọn bản để nhập khách.</p></div>
        <button type="button" class="primary" data-create-test-master>＋ Thêm bản test tổng</button>
      </div>
    </div>`;
}

function formListHtml() {
  const forms = readRows(FORM_KEY).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  if (!forms.length) {
    return `${toolbarHtml()}<article class="record-card placeholder-card"><div><h3>Chưa có bản test tổng</h3><p>Bấm “＋ Thêm bản test tổng” để tạo bản test của ngày/tuyến trước.</p><small>Đang local-first, chưa ghi Supabase.</small></div></article>`;
  }
  return `${toolbarHtml()}${forms.map((form) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(form.title)}</h3>
        <p>${form.products.map(productName).map(escapeHtml).join(', ')}</p>
        <small>${escapeHtml(form.test_date)} · ${escapeHtml(form.sales)} · ${resultsOf(form.id).length} khách test</small>
      </div>
      <aside>
        <span class="status ok">Bản test tổng</span>
        <button type="button" data-open-test-detail="${escapeHtml(form.id)}">Chọn / nhập khách</button>
        <em class="sync-dot warn">Local</em>
      </aside>
    </article>`).join('')}`;
}

function customerFormHtml(form) {
  const options = form.products.map((product) => `<option value="${escapeHtml(product.id)}">${escapeHtml(productName(product))}</option>`).join('');
  return `
    <form id="testCustomerForm" data-form-id="${escapeHtml(form.id)}" class="test-customer-card">
      <div class="test-section-title"><div><h3>Thêm khách test</h3><p>Nhập từng khách trong bản test tổng đang chọn.</p></div></div>
      <div class="test-field-grid">
        <label class="test-field"><span>Khách hàng</span><input id="testCustomerName" required placeholder="Tên cửa hàng / đại lý" /></label>
        <label class="test-field"><span>SĐT</span><input id="testCustomerPhone" placeholder="090..." /></label>
      </div>
      <div class="test-field-grid">
        <label class="test-field"><span>Khu vực</span><input id="testCustomerArea" placeholder="Gò Vấp / Q.10" /></label>
        <label class="test-field"><span>Loại điểm bán</span><input id="testShopType" placeholder="Trà sữa / cafe / đại lý" /></label>
      </div>
      <div class="test-field-grid">
        <label class="test-field"><span>Sản phẩm test</span><select id="testProductId">${options}</select></label>
        <label class="test-field"><span>Kết quả</span><select id="testResult"><option value="interested">Quan tâm</option><option value="ok">OK</option><option value="sample">Cần mẫu</option><option value="follow">Hẹn lại</option><option value="bad">Chưa phù hợp</option></select></label>
      </div>
      <div class="test-field-grid">
        <label class="test-field"><span>Hẹn lại</span><input type="date" id="testFollowDate" /></label>
        <label class="test-field"><span>Cần gửi mẫu</span><select id="testNeedSample"><option value="false">Không</option><option value="true">Có</option></select></label>
      </div>
      <label class="test-field"><span>Thử như nào / phản hồi</span><textarea id="testFeedback" placeholder="Khách pha thử ra sao, vị, màu, giá, vấn đề..."></textarea></label>
      <label class="test-field"><span>Hành động tiếp theo</span><input id="testNextAction" placeholder="Gửi mẫu, báo giá, hẹn lại, chốt đơn..." /></label>
      <button class="primary" type="submit">Lưu khách test</button>
    </form>`;
}

function detailHtml(form) {
  const rows = resultsOf(form.id).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return `
    <section class="test-detail">
      <div class="test-master-toolbar-top" style="margin-bottom:12px">
        <button type="button" id="backToTestList">‹ Danh sách bản test</button>
        <button type="button" class="primary" data-create-test-master>＋ Thêm bản test tổng</button>
      </div>
      <article class="test-detail-summary">
        <h2>${escapeHtml(form.title)}</h2>
        <small>${escapeHtml(form.test_date)} · ${escapeHtml(form.sales)} · ${rows.length} khách test</small>
        <div class="test-product-chips">${form.products.map((product) => `<span class="test-product-chip">${escapeHtml(productName(product))}</span>`).join('')}</div>
      </article>
      ${customerFormHtml(form)}
      <h3>Khách đã test</h3>
      <div class="test-record-list">
        ${rows.length ? rows.map((row) => `
          <article class="test-record-card">
            <div>
              <h3>${escapeHtml(row.customer_name)}</h3>
              <p>${escapeHtml(row.product_name)} · ${escapeHtml(row.result_label)}</p>
              <p>${escapeHtml(row.feedback || '-')}</p>
              <small>${escapeHtml(row.area || '')}${row.need_sample ? ' · Cần mẫu' : ''}</small>
            </div>
            <span class="test-record-status ${row.need_sample ? 'need' : ''}">${row.need_sample ? 'Cần mẫu' : 'Đã test'}</span>
          </article>`).join('') : '<article class="empty-sync-card">Chưa có khách test.</article>'}
      </div>
    </section>`;
}

function renderTests() {
  if (!listEl) return;
  const form = activeFormId ? readRows(FORM_KEY).find((item) => item.id === activeFormId) : null;
  listEl.innerHTML = form ? detailHtml(form) : formListHtml();
}

function saveCustomer(event) {
  event.preventDefault();
  const formId = event.target.dataset.formId;
  const form = readRows(FORM_KEY).find((item) => item.id === formId);
  if (!form) return toast('Không tìm thấy bản test tổng.');
  const product = form.products.find((item) => item.id === $('#testProductId').value) || form.products[0];
  const name = $('#testCustomerName').value.trim();
  if (!name) return toast('Thiếu tên khách test.');
  const labels = { interested: 'Quan tâm', ok: 'OK', sample: 'Cần mẫu', follow: 'Hẹn lại', bad: 'Chưa phù hợp' };
  const result = $('#testResult').value;
  const rows = readRows(ROW_KEY);
  rows.unshift({
    id: uid('test-row'),
    form_id: formId,
    customer_name: name,
    customer_phone: $('#testCustomerPhone').value.trim(),
    area: $('#testCustomerArea').value.trim(),
    shop_type: $('#testShopType').value.trim(),
    product_id: product.id,
    product_name: productName(product),
    result,
    result_label: labels[result] || result,
    need_sample: $('#testNeedSample').value === 'true',
    follow_date: $('#testFollowDate').value || null,
    feedback: $('#testFeedback').value.trim(),
    next_action: $('#testNextAction').value.trim(),
    created_at: nowIso(),
    sync_status: 'local'
  });
  writeRows(ROW_KEY, rows);
  renderTests();
  toast('Đã lưu khách test.');
}

function bind() {
  document.querySelector('[data-create-type="test"]')?.addEventListener('click', (event) => {
    event.preventDefault();
    openForm();
  });
  $('#closeTestFormBtn')?.addEventListener('click', closeForm);
  panel?.addEventListener('click', (event) => {
    if (event.target === panel) closeForm();
  });
  $('#resetTestBtn')?.addEventListener('click', resetForm);
  $('#addFixedProductBtn')?.addEventListener('click', () => {
    productBox.insertAdjacentHTML('beforeend', fixedProductRowHtml());
    renumberProducts();
  });
  formEl?.addEventListener('submit', saveForm);
  productBox?.addEventListener('click', (event) => {
    if (event.target.closest('.fixed-product-remove')) {
      event.target.closest('.fixed-product-card')?.remove();
      if (!productBox.children.length) productBox.insertAdjacentHTML('beforeend', fixedProductRowHtml());
      renumberProducts();
    }
  });
  productBox?.addEventListener('input', (event) => {
    const input = event.target.closest('.fixed-product-filter');
    if (!input) return;
    const row = input.closest('.fixed-product-card');
    const select = $('.fixed-product-select', row);
    if (select) select.innerHTML = productOptions(input.value);
  });
  listEl?.addEventListener('click', (event) => {
    if (event.target.closest('[data-create-test-master]')) {
      activeFormId = '';
      openForm();
      return;
    }
    const open = event.target.closest('[data-open-test-detail]');
    if (open) {
      activeFormId = open.dataset.openTestDetail;
      renderTests();
    }
    if (event.target.closest('#backToTestList')) {
      activeFormId = '';
      renderTests();
    }
  });
  listEl?.addEventListener('submit', (event) => {
    if (event.target?.id === 'testCustomerForm') saveCustomer(event);
  });
}

function init() {
  loadCss('order-module.css');
  loadCss('test-module.css');
  injectStyle();
  loadProducts();
  ensurePanel();
  ensureList();
  resetForm();
  bind();
  renderTests();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
