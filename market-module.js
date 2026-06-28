import {
  DEFAULT_ONA_PRODUCTS,
  STORAGE_KEYS_V2,
  makeMarketReport,
  makeMarketReportProduct,
  makeMarketReportCompetitor,
  uid,
  todayIsoDate
} from './data-model.js';

import {
  isSupabaseV2Ready,
  loadProducts,
  syncMarketReport
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

const ROUTE_KEY = 'bepi-v2-market-routes';
const ROUTE_DAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

let products = DEFAULT_ONA_PRODUCTS.map((item) => ({ ...item, source: 'fallback', active: true }));
let marketPanel;
let marketForm;
let productRowsEl;
let competitorRowsEl;
let reportListEl;

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

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function routeDayForDate(dateValue = todayIsoDate()) {
  const day = new Date(`${dateValue}T00:00:00`).getDay();
  return ({ 1: 'T2', 2: 'T3', 3: 'T4', 4: 'T5', 5: 'T6', 6: 'T7' }[day]) || 'T2';
}

function readRouteConfig() {
  const rows = readJson(ROUTE_KEY, {});
  return rows && typeof rows === 'object' ? rows : {};
}

function writeRouteConfig(rows) {
  writeJson(ROUTE_KEY, rows || {});
}

function currentRouteDay() {
  return document.querySelector('input[name="marketRouteDay"]:checked')?.value || 'T2';
}

function routeCustomersFromText() {
  return String(document.getElementById('marketRouteCustomers')?.value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function readMarketRows() {
  return readCachedRows(STORAGE_KEYS_V2.marketReports);
}

function writeMarketRows(rows) {
  cacheRows(STORAGE_KEYS_V2.marketReports, rows);
}

function cacheMarketRow(report, productsRows, competitors) {
  upsertCachedRow(STORAGE_KEYS_V2.marketReports, { report, products: productsRows, competitors });
}

function generateReportCode() {
  const ymd = todayIsoDate().replaceAll('-', '').slice(2);
  const count = readMarketRows().length + 1;
  return `BC${ymd}${String(count).padStart(3, '0')}`;
}

async function refreshProducts() {
  try {
    if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
    const rows = await loadProducts();
    if (Array.isArray(rows) && rows.length) products = rows;
  } catch {
    const cached = readJson(STORAGE_KEYS_V2.products, []);
    if (Array.isArray(cached) && cached.length) products = cached;
  }
  refreshProductSelects();
}

function productOptions(selectedId = '') {
  return products.map((product) => `<option value="${escapeHtml(product.id)}" ${product.id === selectedId ? 'selected' : ''}>${escapeHtml(product.name)}</option>`).join('');
}

function selectedProduct(id) {
  return products.find((product) => product.id === id) || products[0];
}

function ensureMarketPanel() {
  const anchor = document.getElementById('testFormPanel') || document.getElementById('orderFormPanel') || document.querySelector('.create-grid');
  if (!anchor || document.getElementById('marketFormPanel')) return;

  anchor.insertAdjacentHTML('afterend', `
    <section class="panel-card market-form-card" id="marketFormPanel" hidden>
      <div class="section-head market-head">
        <div>
          <h2>Tạo báo cáo thị trường</h2>
          <p>Báo cáo đi theo tuyến MCP T2-T7, có thể gắn khách hàng cũ vào tuyến.</p>
        </div>
        <button type="button" id="closeMarketFormBtn">Đóng</button>
      </div>

      <form id="marketReportForm" class="market-form">
        <div class="form-grid two">
          <label><span>Ngày báo cáo</span><input type="date" id="marketReportDate" required /></label>
          <label><span>Sales</span><input type="text" id="marketSales" placeholder="A Tân" value="A Tân" /></label>
        </div>

        <div class="section-head market-route-head">
          <div>
            <h2>Tuyến MCP</h2>
            <p>Chọn T2-T7. Mỗi tuyến lưu danh sách khách riêng trên máy để mở lại nhanh.</p>
          </div>
        </div>
        <div class="route-day-grid" id="routeDayGrid">
          ${ROUTE_DAYS.map((day) => `<label><input type="radio" name="marketRouteDay" value="${day}" />${day}</label>`).join('')}
        </div>

        <div class="form-grid two">
          <label><span>Tên tuyến</span><input type="text" id="marketRouteName" placeholder="VD: T2 - Gò Vấp" /></label>
          <label><span>Khu vực</span><input type="text" id="marketArea" placeholder="Gò Vấp / Q.10" /></label>
        </div>

        <label class="route-customer-box"><span>Khách trong tuyến, mỗi dòng 1 khách</span><textarea id="marketRouteCustomers" rows="3" placeholder="Cửa hàng A\nĐại lý B\nQuán C"></textarea><div class="route-chip-list" id="routeCustomerChips"></div></label>

        <div class="form-grid two">
          <label><span>Chọn khách đã lưu trong tuyến</span><select id="marketSelectedCustomer"><option value="">Không chọn khách cụ thể</option></select></label>
          <label><span>Loại thị trường</span><input type="text" id="marketType" placeholder="Trà sữa / đại lý / chợ" /></label>
        </div>

        <label><span>Tổng điểm bán khảo sát</span><input type="number" id="marketTotalShops" inputmode="numeric" min="0" value="0" /></label>

        <section class="market-summary-grid">
          <label><span>Tóm tắt đối thủ</span><textarea id="competitorSummary" rows="2" placeholder="Đối thủ đang mạnh, giá, combo..."></textarea></label>
          <label><span>Tóm tắt giá</span><textarea id="priceSummary" rows="2" placeholder="Mức giá chung, chênh lệch so với công ty..."></textarea></label>
          <label><span>Nhu cầu thị trường</span><textarea id="demandSummary" rows="2" placeholder="Khách hỏi sản phẩm nào, xu hướng..."></textarea></label>
          <label><span>Sản phẩm công ty</span><textarea id="companyProductSummary" rows="2" placeholder="Sản phẩm công ty đang có mặt / bán tốt / khó bán..."></textarea></label>
          <label><span>Cơ hội</span><textarea id="opportunitySummary" rows="2" placeholder="Khách có khả năng mở, sản phẩm nên đẩy..."></textarea></label>
          <label><span>Rủi ro</span><textarea id="riskSummary" rows="2" placeholder="Giá đối thủ, phản hồi xấu, thiếu mẫu..."></textarea></label>
          <label><span>Hành động tiếp theo</span><textarea id="nextAction" rows="2" placeholder="Gửi mẫu, báo giá, hẹn lại, chốt đơn..."></textarea></label>
          <label><span>Ghi chú thêm</span><textarea id="marketNote" rows="2" placeholder="Ghi chú tự do..."></textarea></label>
        </section>

        <div class="section-head market-subhead">
          <div><h2>Sản phẩm công ty</h2><p>Ghi nhận vị thế/cơ hội/rủi ro theo sản phẩm.</p></div>
          <button type="button" id="addMarketProductBtn">＋ SP</button>
        </div>
        <div id="marketProductRows" class="market-dynamic-list"></div>

        <div class="section-head market-subhead">
          <div><h2>Đối thủ</h2><p>Ghi nhận đối thủ, dòng sản phẩm và giá.</p></div>
          <button type="button" id="addCompetitorBtn">＋ Đối thủ</button>
        </div>
        <div id="competitorRows" class="market-dynamic-list"></div>

        <div class="sticky-actions">
          <button type="button" id="resetMarketBtn">Xóa form</button>
          <button type="submit" class="primary">Lưu báo cáo</button>
        </div>
      </form>
    </section>
  `);

  marketPanel = document.getElementById('marketFormPanel');
  marketForm = document.getElementById('marketReportForm');
  productRowsEl = document.getElementById('marketProductRows');
  competitorRowsEl = document.getElementById('competitorRows');
}

function ensureMarketList() {
  const panel = document.querySelector('[data-data-panel="reports"]');
  if (!panel) return;
  panel.innerHTML = '<div id="marketReportList" class="market-report-list"></div>';
  reportListEl = document.getElementById('marketReportList');
}

function refreshProductSelects() {
  document.querySelectorAll('.market-product-select').forEach((select) => {
    const value = select.value;
    select.innerHTML = productOptions(value);
  });
}

function addMarketProductRow(input = {}) {
  if (!productRowsEl) return;
  const productId = input.product_id || products[0]?.id || '';
  const product = selectedProduct(productId) || {};
  const row = document.createElement('article');
  row.className = 'market-product-row';
  row.innerHTML = `
    <label><span>Sản phẩm</span><select class="market-product-select">${productOptions(product.id)}</select></label>
    <div class="market-row-grid">
      <label><span>Vị thế</span><input class="market-position" placeholder="VD: bán tốt / mới test" value="${escapeHtml(input.market_position || '')}" /></label>
      <label><span>Cơ hội</span><input class="opportunity-level" placeholder="cao / vừa / thấp" value="${escapeHtml(input.opportunity_level || '')}" /></label>
      <label><span>Rủi ro</span><input class="risk-level" placeholder="giá / phản hồi / đối thủ" value="${escapeHtml(input.risk_level || '')}" /></label>
      <label><span>Phản hồi</span><input class="product-feedback" placeholder="khách nói gì" value="${escapeHtml(input.feedback || '')}" /></label>
    </div>
    <label><span>Ghi chú</span><input class="product-note" value="${escapeHtml(input.note || '')}" /></label>
    <div class="market-row-footer"><small>Sản phẩm công ty</small><button type="button" class="remove-market-row">Xóa</button></div>
  `;
  productRowsEl.appendChild(row);
}

function addCompetitorRow(input = {}) {
  if (!competitorRowsEl) return;
  const row = document.createElement('article');
  row.className = 'market-competitor-row';
  row.innerHTML = `
    <div class="market-row-grid">
      <label><span>Tên đối thủ</span><input class="competitor-name" placeholder="Tên hãng / nhà cung cấp" value="${escapeHtml(input.competitor_name || '')}" /></label>
      <label><span>Dòng sản phẩm</span><input class="competitor-line" placeholder="trà / topping / syrup" value="${escapeHtml(input.product_line || '')}" /></label>
      <label><span>Khoảng giá</span><input class="competitor-price" placeholder="VD: 90k-120k" value="${escapeHtml(input.price_range || '')}" /></label>
      <label><span>Điểm mạnh</span><input class="competitor-strength" placeholder="giá / thương hiệu / chiết khấu" value="${escapeHtml(input.strength || '')}" /></label>
    </div>
    <label><span>Điểm yếu / ghi chú</span><input class="competitor-note" value="${escapeHtml(input.note || '')}" /></label>
    <div class="market-row-footer"><small>Đối thủ thị trường</small><button type="button" class="remove-market-row">Xóa</button></div>
  `;
  competitorRowsEl.appendChild(row);
}

function renderRouteCustomers() {
  const customers = routeCustomersFromText();
  const select = document.getElementById('marketSelectedCustomer');
  const chips = document.getElementById('routeCustomerChips');
  if (select) {
    const old = select.value;
    select.innerHTML = '<option value="">Không chọn khách cụ thể</option>' + customers.map((name) => `<option value="${escapeHtml(name)}" ${old === name ? 'selected' : ''}>${escapeHtml(name)}</option>`).join('');
  }
  if (chips) chips.innerHTML = customers.slice(0, 12).map((name) => `<span>${escapeHtml(name)}</span>`).join('');
}

function saveCurrentRouteConfig() {
  const day = currentRouteDay();
  const routes = readRouteConfig();
  routes[day] = {
    route_day: day,
    route_name: document.getElementById('marketRouteName')?.value || '',
    market_area: document.getElementById('marketArea')?.value || '',
    customers: routeCustomersFromText(),
    updated_at: new Date().toISOString()
  };
  writeRouteConfig(routes);
}

function loadRouteConfig(day = currentRouteDay()) {
  const routes = readRouteConfig();
  const row = routes[day] || {};
  const routeName = document.getElementById('marketRouteName');
  const area = document.getElementById('marketArea');
  const customers = document.getElementById('marketRouteCustomers');
  if (routeName) routeName.value = row.route_name || `${day} - `;
  if (area) area.value = row.market_area || '';
  if (customers) customers.value = Array.isArray(row.customers) ? row.customers.join('\n') : '';
  renderRouteCustomers();
}

function resetMarketForm() {
  if (!marketForm) return;
  marketForm.reset();
  const date = document.getElementById('marketReportDate');
  if (date) date.value = todayIsoDate();
  document.getElementById('marketSales').value = 'A Tân';
  const routeDay = routeDayForDate(date?.value || todayIsoDate());
  const radio = document.querySelector(`input[name="marketRouteDay"][value="${routeDay}"]`);
  if (radio) radio.checked = true;
  loadRouteConfig(routeDay);
  productRowsEl.innerHTML = '';
  competitorRowsEl.innerHTML = '';
  addMarketProductRow();
  addCompetitorRow();
}

function openMarketForm() {
  marketPanel.hidden = false;
  if (!productRowsEl?.children.length) resetMarketForm();
  marketPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeMarketForm() {
  if (marketPanel) marketPanel.hidden = true;
}

function collectMarketReport() {
  saveCurrentRouteConfig();
  const code = generateReportCode();
  const routeDay = currentRouteDay();
  const routeCustomers = routeCustomersFromText();
  const selectedCustomer = document.getElementById('marketSelectedCustomer').value || '';

  const report = makeMarketReport({
    id: uid('market-report'),
    report_date: document.getElementById('marketReportDate').value || todayIsoDate(),
    sales: document.getElementById('marketSales').value,
    market_area: document.getElementById('marketArea').value,
    route_name: document.getElementById('marketRouteName').value,
    market_type: document.getElementById('marketType').value,
    total_shops: document.getElementById('marketTotalShops').value,
    competitor_summary: document.getElementById('competitorSummary').value,
    price_summary: document.getElementById('priceSummary').value,
    demand_summary: document.getElementById('demandSummary').value,
    company_product_summary: document.getElementById('companyProductSummary').value,
    opportunity_summary: document.getElementById('opportunitySummary').value,
    risk_summary: document.getElementById('riskSummary').value,
    next_action: document.getElementById('nextAction').value,
    note: document.getElementById('marketNote').value,
    sync_status: 'pending',
    raw_payload: { report_code: code, route_day: routeDay, route_customers: routeCustomers, selected_customer: selectedCustomer }
  });

  const productRows = Array.from(document.querySelectorAll('.market-product-row')).map((row) => {
    const product = selectedProduct(row.querySelector('.market-product-select')?.value) || {};
    return makeMarketReportProduct({
      id: uid('market-product'),
      market_report_id: report.id,
      product_id: product.id,
      product_name: product.name,
      company_product: true,
      market_position: row.querySelector('.market-position')?.value,
      feedback: row.querySelector('.product-feedback')?.value,
      opportunity_level: row.querySelector('.opportunity-level')?.value,
      risk_level: row.querySelector('.risk-level')?.value,
      note: row.querySelector('.product-note')?.value
    });
  }).filter((item) => item.product_name && (item.market_position || item.feedback || item.opportunity_level || item.risk_level || item.note));

  const competitors = Array.from(document.querySelectorAll('.market-competitor-row')).map((row) => makeMarketReportCompetitor({
    id: uid('market-competitor'),
    market_report_id: report.id,
    competitor_name: row.querySelector('.competitor-name')?.value,
    product_line: row.querySelector('.competitor-line')?.value,
    price_range: row.querySelector('.competitor-price')?.value,
    strength: row.querySelector('.competitor-strength')?.value,
    weakness: '',
    note: row.querySelector('.competitor-note')?.value
  })).filter((item) => item.competitor_name || item.product_line || item.price_range || item.strength || item.note);

  if (!report.market_area && !report.route_name) throw new Error('Thiếu khu vực hoặc tên tuyến.');
  if (!report.competitor_summary && !report.demand_summary && !report.opportunity_summary && !productRows.length && !competitors.length) {
    throw new Error('Báo cáo cần có ít nhất một nội dung thị trường.');
  }

  return { report, products: productRows, competitors };
}

async function saveMarketReport(event) {
  event.preventDefault();
  const submit = marketForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Đang lưu...';
  try {
    const { report, products: productRows, competitors } = collectMarketReport();
    let savedReport = { ...report };
    try {
      if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
      await syncMarketReport(report, productRows, competitors);
      savedReport.sync_status = 'synced';
      savedReport.synced_at = new Date().toISOString();
      showToast('Đã lưu báo cáo thị trường lên Supabase.');
    } catch (syncError) {
      savedReport.sync_status = 'error';
      savedReport.raw_payload = { ...(savedReport.raw_payload || {}), sync_error: syncError.message };
      enqueueSync('market_report', { report: savedReport, products: productRows, competitors });
      showToast('Đã lưu máy, chờ đồng bộ DB.');
    }
    cacheMarketRow(savedReport, productRows, competitors);
    renderMarketReports();
    renderRecentMixed();
    updateModuleStats();
    resetMarketForm();
    closeMarketForm();
    document.querySelector('[data-page-link="dataSection"]')?.click();
    document.querySelector('[data-data-view="reports"]')?.click();
  } catch (error) {
    showToast(error.message || 'Không lưu được báo cáo thị trường.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Lưu báo cáo';
  }
}

function syncDot(status) {
  if (status === 'synced') return '<em class="sync-dot ok">Đã lưu DB</em>';
  if (status === 'error') return '<em class="sync-dot danger">Lỗi DB</em>';
  return '<em class="sync-dot warn">Chờ đồng bộ</em>';
}

function renderMarketReports() {
  if (!reportListEl) return;
  const rows = readMarketRows().slice().sort((a, b) => String(b.report?.created_at || '').localeCompare(String(a.report?.created_at || '')));
  if (!rows.length) {
    reportListEl.innerHTML = '<article class="record-card placeholder-card"><div><h3>Chưa có báo cáo thị trường</h3><p>Bấm Tạo → Báo cáo thị trường để tạo báo cáo theo tuyến MCP.</p><small>Dữ liệu sẽ lưu vào market_reports.</small></div></article>';
    return;
  }
  reportListEl.innerHTML = rows.map(({ report, products: productRows, competitors }) => {
    const code = report.raw_payload?.report_code || report.id;
    const day = report.raw_payload?.route_day || '';
    const customer = report.raw_payload?.selected_customer || '';
    return `
      <article class="record-card">
        <div>
          <h3>${escapeHtml(code)} <span class="route-badge">${escapeHtml(day || 'MCP')}</span></h3>
          <p>${escapeHtml(report.route_name || report.market_area || '-')} ${customer ? `· Khách: ${escapeHtml(customer)}` : ''}</p>
          <p>${productRows.length} sản phẩm · ${competitors.length} đối thủ · ${escapeHtml(report.opportunity_summary || report.demand_summary || 'Đã ghi nhận thị trường')}</p>
          <small>${escapeHtml(report.report_date || '')} · ${escapeHtml(report.sales || '')}</small>
        </div>
        <aside>
          <span class="status ok">Báo cáo</span>
          <button type="button" data-open-market="${escapeHtml(report.id)}">Mở</button>
          ${syncDot(report.sync_status)}
        </aside>
      </article>`;
  }).join('');
}

function renderRecentMixed() {
  const recent = document.getElementById('recentList');
  if (!recent) return;
  const orders = readCachedRows(STORAGE_KEYS_V2.orders).map((row) => ({
    icon: '🛒', title: `Đơn hàng ${row.order?.order_code || row.order?.id || ''}`,
    sub: `${row.order?.order_date || ''} · ${row.order?.grand_total ? Math.round(row.order.grand_total).toLocaleString('vi-VN') + 'đ' : ''}`,
    status: row.order?.sync_status, at: row.order?.created_at || ''
  }));
  const tests = readCachedRows(STORAGE_KEYS_V2.onaTests).map((row) => ({
    icon: '🍵', title: `Test SP ${row.test?.raw_payload?.test_code || row.test?.id || ''}`,
    sub: `${row.test?.test_date || ''} · ${row.test?.customer_name || ''}`,
    status: row.test?.sync_status, at: row.test?.created_at || ''
  }));
  const reports = readMarketRows().map((row) => ({
    icon: '📊', title: `Báo cáo ${row.report?.raw_payload?.report_code || row.report?.id || ''}`,
    sub: `${row.report?.raw_payload?.route_day || ''} · ${row.report?.route_name || row.report?.market_area || ''}`,
    status: row.report?.sync_status, at: row.report?.created_at || ''
  }));
  const rows = [...orders, ...tests, ...reports].sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 3);
  if (!rows.length) {
    recent.innerHTML = '<article class="mini-row"><span class="mini-icon">＋</span><div><strong>Chưa có dữ liệu</strong><small>Tạo đơn, test hoặc báo cáo đầu tiên.</small></div><em class="sync-dot warn">Local</em></article>';
    return;
  }
  recent.innerHTML = rows.map((row) => `<article class="mini-row"><span class="mini-icon">${row.icon}</span><div><strong>${escapeHtml(row.title)}</strong><small>${escapeHtml(row.sub)}</small></div>${syncDot(row.status)}</article>`).join('');
}

function updateModuleStats() {
  const numbers = document.querySelectorAll('.metric-row strong');
  if (numbers[0]) numbers[0].textContent = String(readCachedRows(STORAGE_KEYS_V2.orders).length);
  if (numbers[1]) numbers[1].textContent = String(readCachedRows(STORAGE_KEYS_V2.onaTests).length);
  if (numbers[2]) numbers[2].textContent = String(readMarketRows().length);
  const stats = getSyncStats();
  const total = readCachedRows(STORAGE_KEYS_V2.orders).length + readCachedRows(STORAGE_KEYS_V2.onaTests).length + readMarketRows().length;
  const local = document.getElementById('localRecordCount');
  const pending = document.getElementById('pendingSyncCount');
  const error = document.getElementById('errorSyncCount');
  if (local) local.textContent = String(total);
  if (pending) pending.textContent = String((stats.pending || 0) + (stats.syncing || 0));
  if (error) error.textContent = String(stats.error || 0);
}

function openMarketDetail(reportId) {
  const found = readMarketRows().find((row) => row.report?.id === reportId);
  if (!found) return;
  const day = found.report.raw_payload?.route_day || '';
  const customer = found.report.raw_payload?.selected_customer || 'không chọn khách';
  showToast(`${day} ${found.report.route_name || found.report.market_area}: ${customer}`);
}

async function retryMarketQueue() {
  try {
    await flushSyncQueue({ stopOnError: false });
    const done = readSyncQueue().filter((item) => item.status === 'done' && item.type === 'market_report');
    if (done.length) {
      const rows = readMarketRows();
      done.forEach((item) => {
        const id = item.payload?.report?.id;
        const found = rows.find((row) => row.report?.id === id);
        if (found) {
          found.report.sync_status = 'synced';
          found.report.synced_at = new Date().toISOString();
        }
      });
      writeMarketRows(rows);
      clearCompletedSyncItems();
    }
    renderMarketReports();
    renderRecentMixed();
    updateModuleStats();
  } catch (error) {
    showToast(error.message || 'Đồng bộ báo cáo thị trường thất bại.');
  }
}

function bindMarketModule() {
  document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-create-type="market"]');
    if (!card) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openMarketForm();
  }, true);

  document.getElementById('closeMarketFormBtn')?.addEventListener('click', closeMarketForm);
  document.getElementById('resetMarketBtn')?.addEventListener('click', resetMarketForm);
  document.getElementById('addMarketProductBtn')?.addEventListener('click', () => addMarketProductRow());
  document.getElementById('addCompetitorBtn')?.addEventListener('click', () => addCompetitorRow());
  document.getElementById('marketRouteCustomers')?.addEventListener('input', renderRouteCustomers);
  document.getElementById('marketReportDate')?.addEventListener('change', (event) => {
    const day = routeDayForDate(event.target.value || todayIsoDate());
    const radio = document.querySelector(`input[name="marketRouteDay"][value="${day}"]`);
    if (radio) radio.checked = true;
    loadRouteConfig(day);
  });
  document.querySelectorAll('input[name="marketRouteDay"]').forEach((radio) => {
    radio.addEventListener('change', () => loadRouteConfig(radio.value));
  });
  marketForm?.addEventListener('submit', saveMarketReport);
  productRowsEl?.addEventListener('click', (event) => {
    const remove = event.target.closest('.remove-market-row');
    if (remove) remove.closest('.market-product-row')?.remove();
  });
  competitorRowsEl?.addEventListener('click', (event) => {
    const remove = event.target.closest('.remove-market-row');
    if (remove) remove.closest('.market-competitor-row')?.remove();
  });
  reportListEl?.addEventListener('click', (event) => {
    const open = event.target.closest('[data-open-market]');
    if (open) openMarketDetail(open.dataset.openMarket);
  });
  document.getElementById('syncQueueBtn')?.addEventListener('click', retryMarketQueue);
}

async function initMarketModule() {
  loadCss('market-module.css');
  ensureMarketPanel();
  ensureMarketList();
  await refreshProducts();
  resetMarketForm();
  bindMarketModule();
  renderMarketReports();
  renderRecentMixed();
  updateModuleStats();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMarketModule, { once: true });
} else {
  initMarketModule();
}
