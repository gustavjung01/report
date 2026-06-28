import { STORAGE_KEYS_V2, nowIso } from './data-model.js';
import { configureSupabaseV2, isSupabaseV2Ready, sbSelect, sbInsert, sbUpsert } from './supabase-v2.js';
import { readCachedRows, cacheRows, flushSyncQueue, getSyncStats } from './sync-queue.js';

const ROUTE_LOCAL_KEY = 'bepi-v2-market-routes';
const ROUTE_DB_KEY = 'bepi-v2-market-routes-db';
const ROUTE_CUSTOMERS_DB_KEY = 'bepi-v2-market-route-customers-db';
const state = { q: '', area: '', sales: '', sync: '' };

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function money(value = 0) { return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`; }
function badge(status) { return status === 'db' || status === 'synced' ? '<em class="sync-dot ok">DB</em>' : status === 'error' ? '<em class="sync-dot danger">Lỗi</em>' : '<em class="sync-dot warn">Local</em>'; }
function source(status) { return `<span class="source-badge">${status === 'db' ? 'DB' : 'Local'}</span>`; }
function slug(value = '') { return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'route'; }

function installToolbar() {
  const page = document.getElementById('dataSection');
  if (!page || document.getElementById('dataSyncToolbar')) return;
  page.querySelector('.page-title')?.insertAdjacentHTML('afterend', `
    <section class="data-sync-toolbar" id="dataSyncToolbar">
      <div class="data-sync-actions">
        <button class="primary" type="button" id="loadDbDataBtn">↻ Tải DB</button>
        <button type="button" id="flushAllQueueBtn">⇡ Sync queue</button>
      </div>
      <div class="data-filter-box">
        <div class="data-filter-grid">
          <label><span>Tìm khách / mã</span><input id="dataFilterQ" placeholder="Tên khách, mã phiếu..." /></label>
          <label><span>Khu vực</span><input id="dataFilterArea" placeholder="Gò Vấp, Q.10..." /></label>
          <label><span>Sales</span><input id="dataFilterSales" placeholder="A Tân" /></label>
          <label><span>Sync</span><select id="dataFilterSync"><option value="">Tất cả</option><option value="db">DB</option><option value="synced">Synced</option><option value="error">Lỗi</option><option value="pending">Local</option></select></label>
        </div>
        <div class="data-filter-actions"><button class="primary" type="button" id="applyDataFilterBtn">Lọc</button><button type="button" id="clearDataFilterBtn">Xóa lọc</button></div>
      </div>
      <div class="data-sync-meta" id="dataSyncMeta"><span>DB: chưa tải</span></div>
    </section>`);
}

function matchText(...values) { return !state.q || values.join(' ').toLowerCase().includes(state.q.toLowerCase()); }
function matchArea(value = '') { return !state.area || String(value || '').toLowerCase().includes(state.area.toLowerCase()); }
function matchSales(value = '') { return !state.sales || String(value || '').toLowerCase().includes(state.sales.toLowerCase()); }
function matchSync(value = '') { return !state.sync || (state.sync === 'pending' ? !['db', 'synced', 'error'].includes(value) : value === state.sync); }

function updateMeta(extra = '') {
  const stats = getSyncStats();
  const counts = {
    orders: readCachedRows(STORAGE_KEYS_V2.orders).length,
    tests: readCachedRows(STORAGE_KEYS_V2.onaTests).length,
    reports: readCachedRows(STORAGE_KEYS_V2.marketReports).length,
    customers: readCachedRows(STORAGE_KEYS_V2.customers).length,
    routes: readJson(ROUTE_DB_KEY, []).length
  };
  const meta = document.getElementById('dataSyncMeta');
  if (meta) meta.innerHTML = `<span>Đơn: ${counts.orders}</span><span>Test: ${counts.tests}</span><span>Báo cáo: ${counts.reports}</span><span>Khách: ${counts.customers}</span><span>Tuyến: ${counts.routes}</span><span>Queue: ${(stats.pending || 0) + (stats.syncing || 0)} / lỗi ${stats.error || 0}</span>${extra ? `<span>${esc(extra)}</span>` : ''}`;
  const local = document.getElementById('localRecordCount');
  const pending = document.getElementById('pendingSyncCount');
  const error = document.getElementById('errorSyncCount');
  if (local) local.textContent = String(counts.orders + counts.tests + counts.reports + counts.customers + counts.routes);
  if (pending) pending.textContent = String((stats.pending || 0) + (stats.syncing || 0));
  if (error) error.textContent = String(stats.error || 0);
}

function renderOrders() {
  const el = document.getElementById('orderList') || document.querySelector('[data-data-panel="orders"]');
  if (!el) return;
  const rows = readCachedRows(STORAGE_KEYS_V2.orders).filter(({ order = {} }) => matchText(order.order_code, order.customer_name, order.id) && matchArea(order.area) && matchSales(order.sales) && matchSync(order.sync_status));
  el.innerHTML = rows.length ? rows.map(({ order = {}, items = [] }) => `<article class="record-card"><div><h3>${esc(order.order_code || order.id)} ${source(order.sync_status)}</h3><p>Khách: ${esc(order.customer_name || '-')} ${order.area ? `- ${esc(order.area)}` : ''}</p><p>${items.length} sản phẩm · ${money(order.grand_total)}</p><small>${esc(order.order_date || '')} · ${esc(order.sales || '')}</small></div><aside>${badge(order.sync_status)}</aside></article>`).join('') : '<article class="empty-sync-card">Không có đơn hàng theo bộ lọc hiện tại.</article>';
}

function renderTests() {
  const panel = document.querySelector('[data-data-panel="tests"]');
  if (!panel) return;
  const rows = readCachedRows(STORAGE_KEYS_V2.onaTests).filter(({ test = {} }) => matchText(test.raw_payload?.test_code, test.customer_name, test.id) && matchArea(test.area) && matchSales(test.sales) && matchSync(test.sync_status));
  panel.innerHTML = rows.length ? rows.map(({ test = {}, items = [] }) => `<article class="record-card"><div><h3>${esc(test.raw_payload?.test_code || test.id)} ${source(test.sync_status)}</h3><p>Khách: ${esc(test.customer_name || '-')} ${test.area ? `- ${esc(test.area)}` : ''}</p><p>${items.length} sản phẩm · OK ${items.filter((x) => x.status === 'ok').length} · Mẫu ${items.filter((x) => x.status === 'sample').length}</p><small>${esc(test.test_date || '')} · ${esc(test.sales || '')}</small></div><aside>${badge(test.sync_status)}</aside></article>`).join('') : '<article class="empty-sync-card">Không có phiếu test theo bộ lọc hiện tại.</article>';
}

function renderReports() {
  const panel = document.querySelector('[data-data-panel="reports"]');
  if (!panel) return;
  const routes = readJson(ROUTE_DB_KEY, []);
  const routeCustomers = readJson(ROUTE_CUSTOMERS_DB_KEY, []);
  const routeHtml = routes.length ? `<div class="route-list">${routes.map((route) => { const cs = routeCustomers.filter((c) => c.route_id === route.id); return `<article class="route-card"><header><strong>${esc(route.route_day || '')} · ${esc(route.route_name || route.id)}</strong><span class="source-badge">Tuyến DB</span></header><p>${esc(route.market_area || '')} ${route.sales ? `· ${esc(route.sales)}` : ''}</p><div class="route-customer-tags">${cs.slice(0, 10).map((c) => `<span>${esc(c.customer_name)}</span>`).join('') || '<span>Chưa gắn khách</span>'}</div></article>`; }).join('')}</div>` : '';
  const rows = readCachedRows(STORAGE_KEYS_V2.marketReports).filter(({ report = {} }) => matchText(report.raw_payload?.report_code, report.selected_customer_name, report.raw_payload?.selected_customer, report.route_name, report.id) && matchArea(report.market_area) && matchSales(report.sales) && matchSync(report.sync_status));
  const reportHtml = rows.length ? rows.map(({ report = {}, products = [], competitors = [] }) => `<article class="record-card"><div><h3>${esc(report.raw_payload?.report_code || report.id)} ${source(report.sync_status)}</h3><p>${esc(report.route_day || report.raw_payload?.route_day || '')} · ${esc(report.route_name || report.market_area || '-')} ${report.selected_customer_name || report.raw_payload?.selected_customer ? `· Khách: ${esc(report.selected_customer_name || report.raw_payload?.selected_customer)}` : ''}</p><p>${products.length} sản phẩm · ${competitors.length} đối thủ · ${esc(report.opportunity_summary || report.demand_summary || 'Đã ghi nhận thị trường')}</p><small>${esc(report.report_date || '')} · ${esc(report.sales || '')}</small></div><aside>${badge(report.sync_status)}</aside></article>`).join('') : '<article class="empty-sync-card">Không có báo cáo thị trường theo bộ lọc hiện tại.</article>';
  panel.innerHTML = routeHtml + reportHtml;
}

function renderCustomers() {
  const panel = document.querySelector('[data-data-panel="customers"]');
  if (!panel) return;
  const rows = readCachedRows(STORAGE_KEYS_V2.customers).filter((row = {}) => matchText(row.name, row.phone, row.id) && matchArea(row.area));
  panel.innerHTML = rows.length ? rows.map((row) => `<article class="record-card customer-record"><div><h3>${esc(row.name || row.id)} ${source('db')}</h3><p>${esc(row.area || '-')} ${row.phone ? `· ${esc(row.phone)}` : ''}</p><small>${esc(row.shop_type || row.address || row.note || 'Khách hàng dùng chung')}</small></div><aside><span class="status ok">Khách</span></aside></article>`).join('') : '<article class="empty-sync-card">Chưa có khách hàng trong cache/DB.</article>';
}

function renderAll() { renderOrders(); renderTests(); renderReports(); renderCustomers(); updateMeta(); }
function groupBy(rows, key) { return rows.reduce((acc, row) => { const id = row[key]; if (!acc[id]) acc[id] = []; acc[id].push(row); return acc; }, {}); }

async function loadDbData() {
  configureSupabaseV2();
  if (!isSupabaseV2Ready()) return toast('Chưa cấu hình Supabase URL/key.');
  updateMeta('Đang tải DB...');
  try {
    const [orders, orderItems, tests, testItems, reports, reportProducts, reportCompetitors, customers, routes, routeCustomers] = await Promise.all([
      sbSelect('orders', 'select=*&order=order_date.desc,created_at.desc&limit=300'),
      sbSelect('order_items', 'select=*&order=created_at.desc&limit=1000'),
      sbSelect('ona_tests', 'select=*&order=test_date.desc,created_at.desc&limit=300'),
      sbSelect('ona_test_items', 'select=*&order=created_at.desc&limit=1500'),
      sbSelect('market_reports', 'select=*&order=report_date.desc,created_at.desc&limit=300'),
      sbSelect('market_report_products', 'select=*&order=created_at.desc&limit=1000'),
      sbSelect('market_report_competitors', 'select=*&order=created_at.desc&limit=1000'),
      sbSelect('customers_master', 'select=*&order=name.asc&limit=500'),
      sbSelect('market_routes', 'select=*&active=eq.true&order=route_day.asc,route_name.asc&limit=100'),
      sbSelect('market_route_customers', 'select=*&active=eq.true&order=sort_order.asc,customer_name.asc&limit=1000')
    ]);
    const orderItemMap = groupBy(orderItems, 'order_id');
    const testItemMap = groupBy(testItems, 'test_id');
    const productMap = groupBy(reportProducts, 'market_report_id');
    const competitorMap = groupBy(reportCompetitors, 'market_report_id');
    cacheRows(STORAGE_KEYS_V2.orders, orders.map((order) => ({ order: { ...order, sync_status: 'db' }, items: orderItemMap[order.id] || [] })));
    cacheRows(STORAGE_KEYS_V2.onaTests, tests.map((test) => ({ test: { ...test, sync_status: 'db' }, items: testItemMap[test.id] || [] })));
    cacheRows(STORAGE_KEYS_V2.marketReports, reports.map((report) => ({ report: { ...report, sync_status: 'db' }, products: productMap[report.id] || [], competitors: competitorMap[report.id] || [] })));
    cacheRows(STORAGE_KEYS_V2.customers, customers);
    writeJson(ROUTE_DB_KEY, routes);
    writeJson(ROUTE_CUSTOMERS_DB_KEY, routeCustomers);
    renderAll();
    toast('Đã tải dữ liệu từ Supabase.');
  } catch (error) {
    updateMeta('Tải DB lỗi');
    toast(error.message || 'Không tải được dữ liệu DB.');
  }
}

async function syncLocalRoutesToDb() {
  const routeMap = readJson(ROUTE_LOCAL_KEY, {});
  const rows = Object.values(routeMap || {});
  let count = 0;
  for (const row of rows) {
    const day = row.route_day || 'T2';
    const routeName = row.route_name || `${day} - ${row.market_area || 'Tuyến MCP'}`;
    const routeId = row.id || `route-${day.toLowerCase()}-${slug(routeName)}`;
    await sbUpsert('market_routes', [{ id: routeId, route_day: day, route_name: routeName, market_area: row.market_area || '', sales: row.sales || '', note: row.note || '', active: true, raw_payload: row.raw_payload || {}, updated_at: nowIso() }]);
    const customers = Array.isArray(row.customers) ? row.customers : [];
    const customerRows = customers.map((name, index) => ({ id: `mrc-${routeId}-${index + 1}`, route_id: routeId, customer_name: String(name || '').trim(), market_area: row.market_area || '', sort_order: index + 1, active: true, raw_payload: { source: 'local_route_cache' }, updated_at: nowIso() })).filter((item) => item.customer_name);
    if (customerRows.length) await sbUpsert('market_route_customers', customerRows);
    count += 1;
  }
  return count;
}

async function flushAllQueue() {
  configureSupabaseV2();
  if (!isSupabaseV2Ready()) return toast('Chưa cấu hình Supabase URL/key.');
  try {
    updateMeta('Đang đồng bộ...');
    const routeCount = await syncLocalRoutesToDb();
    const results = await flushSyncQueue({ stopOnError: false });
    await loadDbData();
    const ok = results.filter((item) => item.ok).length;
    const fail = results.filter((item) => !item.ok).length;
    toast(`Đồng bộ xong: ${ok} phiếu, ${routeCount} tuyến, ${fail} lỗi.`);
  } catch (error) {
    renderAll();
    toast(error.message || 'Đồng bộ thất bại.');
  }
}

function bindToolbar() {
  document.getElementById('loadDbDataBtn')?.addEventListener('click', loadDbData);
  document.getElementById('flushAllQueueBtn')?.addEventListener('click', flushAllQueue);
  document.getElementById('applyDataFilterBtn')?.addEventListener('click', () => {
    state.q = document.getElementById('dataFilterQ')?.value?.trim() || '';
    state.area = document.getElementById('dataFilterArea')?.value?.trim() || '';
    state.sales = document.getElementById('dataFilterSales')?.value?.trim() || '';
    state.sync = document.getElementById('dataFilterSync')?.value || '';
    renderAll();
  });
  document.getElementById('clearDataFilterBtn')?.addEventListener('click', () => {
    state.q = state.area = state.sales = state.sync = '';
    ['dataFilterQ', 'dataFilterArea', 'dataFilterSales'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
    const sync = document.getElementById('dataFilterSync');
    if (sync) sync.value = '';
    renderAll();
  });
}

async function initDataSyncModule() {
  loadCss('data-sync-module.css');
  installToolbar();
  bindToolbar();
  renderAll();
  if (isSupabaseV2Ready()) await loadDbData();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initDataSyncModule, { once: true });
else initDataSyncModule();
