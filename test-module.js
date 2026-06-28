import {
  DEFAULT_ONA_PRODUCTS,
  STORAGE_KEYS_V2,
  makeOnaTest,
  makeOnaTestItem,
  uid,
  todayIsoDate
} from './data-model.js';

import {
  isSupabaseV2Ready,
  loadProducts,
  syncOnaTest
} from './supabase-v2.js';

import {
  enqueueSync,
  readSyncQueue,
  flushSyncQueue,
  clearCompletedSyncItems,
  readCachedRows,
  cacheRows,
  upsertCachedRow,
  getSyncStats
} from './sync-queue.js';

const TEST_STATUS_LABELS = {
  pending: 'Chưa thử',
  ok: 'OK',
  interested: 'Quan tâm',
  sample: 'Cần mẫu',
  follow: 'Báo lại',
  bad: 'Chưa tốt',
  retry: 'Thử lại'
};

let products = DEFAULT_ONA_PRODUCTS.map((item) => ({ ...item, source: 'fallback', active: true }));
let testPanel;
let testForm;
let testItemsEl;
let testListEl;

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function statusOptions(value = 'pending') {
  return Object.entries(TEST_STATUS_LABELS).map(([key, label]) => (
    `<option value="${key}" ${key === value ? 'selected' : ''}>${label}</option>`
  )).join('');
}

function readTestRows() {
  return readCachedRows(STORAGE_KEYS_V2.onaTests);
}

function writeTestRows(rows) {
  cacheRows(STORAGE_KEYS_V2.onaTests, rows);
}

function cacheTestRow(test, items) {
  upsertCachedRow(STORAGE_KEYS_V2.onaTests, { test, items });
}

function generateTestCode() {
  const ymd = todayIsoDate().replaceAll('-', '').slice(2);
  const count = readTestRows().length + 1;
  return `TS${ymd}${String(count).padStart(3, '0')}`;
}

async function refreshProducts() {
  try {
    if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
    const rows = await loadProducts();
    if (Array.isArray(rows) && rows.length) products = rows;
  } catch {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS_V2.products) || '[]');
    if (Array.isArray(cached) && cached.length) products = cached;
  }
  renderTestProductRows();
}

function ensureTestPanel() {
  const anchor = document.getElementById('orderFormPanel') || document.querySelector('.create-grid');
  if (!anchor || document.getElementById('testFormPanel')) return;

  anchor.insertAdjacentHTML('afterend', `
    <section class="panel-card test-form-card" id="testFormPanel" hidden>
      <div class="section-head test-head">
        <div>
          <h2>Tạo test sản phẩm</h2>
          <p>Phiếu test lưu riêng vào <code>ona_tests</code> và <code>ona_test_items</code>.</p>
        </div>
        <button type="button" id="closeTestFormBtn">Đóng</button>
      </div>

      <form id="onaTestForm" class="test-form">
        <div class="form-grid two">
          <label><span>Ngày test</span><input type="date" id="onaTestDate" required /></label>
          <label><span>Sales</span><input type="text" id="onaTestSales" placeholder="A Tân" value="A Tân" /></label>
        </div>

        <div class="form-grid two">
          <label><span>Khách hàng</span><input type="text" id="onaTestCustomerName" placeholder="Tên cửa hàng / đại lý" required /></label>
          <label><span>SĐT</span><input type="tel" id="onaTestCustomerPhone" placeholder="090..." /></label>
        </div>

        <div class="form-grid two">
          <label><span>Khu vực</span><input type="text" id="onaTestArea" placeholder="Gò Vấp / Q.10" /></label>
          <label><span>Loại điểm bán</span><input type="text" id="onaTestShopType" placeholder="Trà sữa / cafe / đại lý" /></label>
        </div>

        <div class="form-grid two">
          <label><span>Loại test</span><select id="onaTestType"><option>Trà ONA Test</option><option>Trà sữa / topping</option><option>Sản phẩm mới</option><option>Khác</option></select></label>
          <label><span>Hẹn lại</span><input type="date" id="onaTestFollowDate" /></label>
        </div>

        <label class="need-sample-row"><input type="checkbox" id="onaNeedSample" /> Cần gửi mẫu / hỗ trợ mẫu</label>

        <div class="section-head test-products-head">
          <div>
            <h2>Test từng sản phẩm</h2>
            <p>Chọn trạng thái và ghi chú nhanh cho từng sản phẩm.</p>
          </div>
        </div>

        <div class="test-summary-strip" id="testSummaryStrip">
          <div><strong>0</strong><small>OK</small></div>
          <div><strong>0</strong><small>Quan tâm</small></div>
          <div><strong>0</strong><small>Cần mẫu</small></div>
          <div><strong>0</strong><small>Vấn đề</small></div>
        </div>

        <div id="onaTestItems" class="test-items"></div>

        <label><span>Ghi chú tổng</span><textarea id="onaTestNote" rows="2" placeholder="VD: khách thích Olong Sen, cần mẫu lớn..."></textarea></label>

        <div class="sticky-actions">
          <button type="button" id="resetTestBtn">Xóa form</button>
          <button type="submit" class="primary">Lưu phiếu test</button>
        </div>
      </form>
    </section>
  `);

  testPanel = document.getElementById('testFormPanel');
  testForm = document.getElementById('onaTestForm');
  testItemsEl = document.getElementById('onaTestItems');
}

function ensureTestList() {
  const panel = document.querySelector('[data-data-panel="tests"]');
  if (!panel) return;
  panel.innerHTML = '<div id="onaTestList" class="test-list"></div>';
  testListEl = document.getElementById('onaTestList');
}

function renderTestProductRows() {
  if (!testItemsEl) return;
  testItemsEl.innerHTML = products.map((product) => `
    <article class="test-item-row" data-product-id="${escapeHtml(product.id)}">
      <header><strong>${escapeHtml(product.name)}</strong><small>${escapeHtml(product.category || product.sku || 'Sản phẩm')}</small></header>
      <div class="test-item-grid">
        <label><span>Trạng thái</span><select class="test-status-select">${statusOptions()}</select></label>
        <label><span>Ghi chú</span><input class="test-note" type="text" placeholder="Vị, giá, mẫu, phản hồi..." /></label>
      </div>
    </article>
  `).join('');
  updateTestSummary();
}

function resetTestForm() {
  if (!testForm) return;
  testForm.reset();
  document.getElementById('onaTestDate').value = todayIsoDate();
  document.getElementById('onaTestSales').value = 'A Tân';
  renderTestProductRows();
}

function openTestForm() {
  if (!testPanel) ensureTestPanel();
  testPanel.hidden = false;
  if (!testItemsEl?.children.length) resetTestForm();
  testPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeTestForm() {
  if (testPanel) testPanel.hidden = true;
}

function updateTestSummary() {
  const counts = { ok: 0, interested: 0, sample: 0, issue: 0 };
  document.querySelectorAll('.test-item-row').forEach((row) => {
    const status = row.querySelector('.test-status-select')?.value || 'pending';
    if (status === 'ok') counts.ok += 1;
    if (status === 'interested') counts.interested += 1;
    if (status === 'sample') counts.sample += 1;
    if (['bad', 'retry', 'follow'].includes(status)) counts.issue += 1;
  });
  const strip = document.getElementById('testSummaryStrip');
  if (!strip) return;
  const values = [counts.ok, counts.interested, counts.sample, counts.issue];
  strip.querySelectorAll('strong').forEach((node, index) => { node.textContent = values[index] || 0; });
}

function collectTest() {
  const code = generateTestCode();
  const test = makeOnaTest({
    id: uid('ona-test'),
    test_code: code,
    test_date: document.getElementById('onaTestDate').value || todayIsoDate(),
    sales: document.getElementById('onaTestSales').value,
    customer_name: document.getElementById('onaTestCustomerName').value,
    customer_phone: document.getElementById('onaTestCustomerPhone').value,
    area: document.getElementById('onaTestArea').value,
    shop_type: document.getElementById('onaTestShopType').value,
    test_type: document.getElementById('onaTestType').value,
    follow_date: document.getElementById('onaTestFollowDate').value || null,
    need_sample: document.getElementById('onaNeedSample').checked,
    overall_status: 'draft',
    overall_note: document.getElementById('onaTestNote').value,
    sync_status: 'pending',
    raw_payload: { test_code: code }
  });

  const items = Array.from(document.querySelectorAll('.test-item-row')).map((row) => {
    const product = products.find((item) => item.id === row.dataset.productId) || {};
    const status = row.querySelector('.test-status-select')?.value || 'pending';
    const note = row.querySelector('.test-note')?.value || '';
    return makeOnaTestItem({
      id: uid('ona-test-item'),
      test_id: test.id,
      product_id: product.id,
      product_name: product.name,
      status,
      note
    });
  }).filter((item) => item.status !== 'pending' || item.note);

  if (!test.customer_name) throw new Error('Thiếu tên khách hàng.');
  if (!items.length) throw new Error('Chọn ít nhất 1 sản phẩm có trạng thái hoặc ghi chú.');
  return { test, items };
}

async function saveTest(event) {
  event.preventDefault();
  const submit = testForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Đang lưu...';
  try {
    const { test, items } = collectTest();
    let savedTest = { ...test };
    try {
      if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
      await syncOnaTest(test, items);
      savedTest.sync_status = 'synced';
      savedTest.synced_at = new Date().toISOString();
      showToast('Đã lưu phiếu test lên Supabase.');
    } catch (syncError) {
      savedTest.sync_status = 'error';
      savedTest.raw_payload = { ...(savedTest.raw_payload || {}), sync_error: syncError.message };
      enqueueSync('ona_test', { test: savedTest, items });
      showToast('Đã lưu máy, chờ đồng bộ DB.');
    }
    cacheTestRow(savedTest, items);
    renderTests();
    renderRecentMixed();
    updateModuleStats();
    resetTestForm();
    closeTestForm();
    document.querySelector('[data-page-link="dataSection"]')?.click();
    document.querySelector('[data-data-view="tests"]')?.click();
  } catch (error) {
    showToast(error.message || 'Không lưu được phiếu test.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Lưu phiếu test';
  }
}

function countTestItems(items = []) {
  return items.reduce((acc, item) => {
    acc.total += 1;
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, { total: 0 });
}

function syncDot(status) {
  if (status === 'synced') return '<em class="sync-dot ok">Đã lưu DB</em>';
  if (status === 'error') return '<em class="sync-dot danger">Lỗi DB</em>';
  return '<em class="sync-dot warn">Chờ đồng bộ</em>';
}

function renderTests() {
  if (!testListEl) return;
  const rows = readTestRows().slice().sort((a, b) => String(b.test?.created_at || '').localeCompare(String(a.test?.created_at || '')));
  if (!rows.length) {
    testListEl.innerHTML = '<article class="record-card placeholder-card"><div><h3>Chưa có phiếu test</h3><p>Bấm Tạo → Test sản phẩm để tạo phiếu đầu tiên.</p><small>Dữ liệu sẽ lưu vào ona_tests và ona_test_items.</small></div></article>';
    return;
  }
  testListEl.innerHTML = rows.map(({ test, items }) => {
    const counts = countTestItems(items);
    const code = test.raw_payload?.test_code || test.id;
    return `
      <article class="record-card">
        <div>
          <h3>${escapeHtml(code)}</h3>
          <p>Khách: ${escapeHtml(test.customer_name || '-')} ${test.area ? `- ${escapeHtml(test.area)}` : ''}</p>
          <p>${counts.total} sản phẩm · OK ${counts.ok || 0} · Cần mẫu ${counts.sample || 0} · Vấn đề ${(counts.bad || 0) + (counts.retry || 0)}</p>
          <small>${escapeHtml(test.test_date || '')} · ${escapeHtml(test.sales || '')}</small>
        </div>
        <aside>
          <span class="status ${test.need_sample ? 'danger-soft' : 'ok'}">${test.need_sample ? 'Cần mẫu' : 'Đã test'}</span>
          <button type="button" data-open-test="${escapeHtml(test.id)}">Mở</button>
          ${syncDot(test.sync_status)}
        </aside>
      </article>`;
  }).join('');
}

function renderRecentMixed() {
  const recent = document.getElementById('recentList');
  if (!recent) return;
  const orders = readCachedRows(STORAGE_KEYS_V2.orders).map((row) => ({
    type: 'order', icon: '🛒', title: `Đơn hàng ${row.order?.order_code || row.order?.id || ''}`,
    sub: `${row.order?.order_date || ''} · ${row.order?.grand_total ? Math.round(row.order.grand_total).toLocaleString('vi-VN') + 'đ' : ''}`,
    status: row.order?.sync_status, at: row.order?.created_at || ''
  }));
  const tests = readTestRows().map((row) => ({
    type: 'test', icon: '🍵', title: `Test SP ${row.test?.raw_payload?.test_code || row.test?.id || ''}`,
    sub: `${row.test?.test_date || ''} · ${row.test?.customer_name || ''}`,
    status: row.test?.sync_status, at: row.test?.created_at || ''
  }));
  const rows = [...orders, ...tests].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 3);
  if (!rows.length) {
    recent.innerHTML = '<article class="mini-row"><span class="mini-icon">＋</span><div><strong>Chưa có dữ liệu</strong><small>Tạo đơn hoặc phiếu test đầu tiên.</small></div><em class="sync-dot warn">Local</em></article>';
    return;
  }
  recent.innerHTML = rows.map((row) => `<article class="mini-row"><span class="mini-icon">${row.icon}</span><div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.sub)}</small></div>${syncDot(row.status)}</article>`).join('');
}

function updateModuleStats() {
  const aiNumbers = document.querySelectorAll('.metric-row strong');
  if (aiNumbers[0]) aiNumbers[0].textContent = String(readCachedRows(STORAGE_KEYS_V2.orders).length);
  if (aiNumbers[1]) aiNumbers[1].textContent = String(readTestRows().length);
  const stats = getSyncStats();
  const total = readCachedRows(STORAGE_KEYS_V2.orders).length + readTestRows().length;
  const local = document.getElementById('localRecordCount');
  const pending = document.getElementById('pendingSyncCount');
  const error = document.getElementById('errorSyncCount');
  if (local) local.textContent = String(total);
  if (pending) pending.textContent = String((stats.pending || 0) + (stats.syncing || 0));
  if (error) error.textContent = String(stats.error || 0);
}

function openTestDetail(testId) {
  const found = readTestRows().find((row) => row.test?.id === testId);
  if (!found) return;
  const lines = found.items.map((item) => `${item.product_name}: ${TEST_STATUS_LABELS[item.status] || item.status}`).join(', ');
  showToast(lines || 'Phiếu test chưa có dòng chi tiết.');
}

async function retryTestQueue() {
  try {
    await flushSyncQueue({ stopOnError: false });
    const queue = readSyncQueue();
    const done = queue.filter((item) => item.status === 'done' && item.type === 'ona_test');
    if (done.length) {
      const rows = readTestRows();
      done.forEach((item) => {
        const id = item.payload?.test?.id;
        const found = rows.find((row) => row.test?.id === id);
        if (found) {
          found.test.sync_status = 'synced';
          found.test.synced_at = new Date().toISOString();
        }
      });
      writeTestRows(rows);
      clearCompletedSyncItems();
    }
    renderTests();
    renderRecentMixed();
    updateModuleStats();
  } catch (error) {
    showToast(error.message || 'Đồng bộ phiếu test thất bại.');
  }
}

function bindTestModule() {
  document.querySelector('[data-create-type="test"]')?.addEventListener('click', (event) => {
    event.preventDefault();
    openTestForm();
  });
  document.getElementById('closeTestFormBtn')?.addEventListener('click', closeTestForm);
  document.getElementById('resetTestBtn')?.addEventListener('click', resetTestForm);
  testForm?.addEventListener('submit', saveTest);
  testItemsEl?.addEventListener('change', (event) => {
    if (event.target.classList.contains('test-status-select')) {
      event.target.className = `test-status-select status-${event.target.value}`;
      updateTestSummary();
    }
  });
  testListEl?.addEventListener('click', (event) => {
    const open = event.target.closest('[data-open-test]');
    if (open) openTestDetail(open.dataset.openTest);
  });
  document.getElementById('syncQueueBtn')?.addEventListener('click', retryTestQueue);
}

async function initTestModule() {
  loadCss('order-module.css');
  loadCss('test-module.css');
  ensureTestPanel();
  ensureTestList();
  await refreshProducts();
  resetTestForm();
  bindTestModule();
  renderTests();
  renderRecentMixed();
  updateModuleStats();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTestModule, { once: true });
} else {
  initTestModule();
}
