import { STORAGE_KEYS_V2, makeAiSummary, uid, todayIsoDate } from './data-model.js';
import { configureSupabaseV2, isSupabaseV2Ready, syncAiSummary, loadAiSummaries } from './supabase-v2.js';
import { readCachedRows, cacheRows, upsertCachedRow } from './sync-queue.js';

const ROUTE_DB_KEY = 'bepi-v2-market-routes-db';
const ROUTE_CUSTOMERS_DB_KEY = 'bepi-v2-market-route-customers-db';

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

function countBy(rows, getter) {
  return rows.reduce((acc, row) => {
    const key = getter(row) || 'Khác';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function topPairs(obj, limit = 5) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit);
}

function getFilters() {
  return {
    orders: document.getElementById('aiUseOrders')?.checked !== false,
    tests: document.getElementById('aiUseTests')?.checked !== false,
    reports: document.getElementById('aiUseReports')?.checked !== false,
    routes: document.getElementById('aiUseRoutes')?.checked !== false,
    dateFrom: document.getElementById('aiDateFrom')?.value || '',
    dateTo: document.getElementById('aiDateTo')?.value || '',
    sales: document.getElementById('aiSalesFilter')?.value?.trim() || '',
    area: document.getElementById('aiAreaFilter')?.value?.trim() || ''
  };
}

function dateInRange(dateValue, filters) {
  if (!dateValue) return true;
  if (filters.dateFrom && dateValue < filters.dateFrom) return false;
  if (filters.dateTo && dateValue > filters.dateTo) return false;
  return true;
}

function textMatch(value, filter) {
  if (!filter) return true;
  return String(value || '').toLowerCase().includes(filter.toLowerCase());
}

function readSources(filters = getFilters()) {
  const orders = filters.orders ? readCachedRows(STORAGE_KEYS_V2.orders).filter(({ order = {} }) => dateInRange(order.order_date, filters) && textMatch(order.sales, filters.sales) && textMatch(order.area, filters.area)) : [];
  const tests = filters.tests ? readCachedRows(STORAGE_KEYS_V2.onaTests).filter(({ test = {} }) => dateInRange(test.test_date, filters) && textMatch(test.sales, filters.sales) && textMatch(test.area, filters.area)) : [];
  const reports = filters.reports ? readCachedRows(STORAGE_KEYS_V2.marketReports).filter(({ report = {} }) => dateInRange(report.report_date, filters) && textMatch(report.sales, filters.sales) && textMatch(report.market_area, filters.area)) : [];
  const routes = filters.routes ? readJson(ROUTE_DB_KEY, []).filter((route) => textMatch(route.sales, filters.sales) && textMatch(route.market_area, filters.area)) : [];
  const routeCustomers = filters.routes ? readJson(ROUTE_CUSTOMERS_DB_KEY, []) : [];
  return { orders, tests, reports, routes, routeCustomers };
}

function ensureAiShell() {
  const page = document.getElementById('aiSection');
  if (!page || document.getElementById('aiSummaryModule')) return;
  page.innerHTML = `
    <div class="page-title">
      <h1>AI tổng hợp</h1>
      <p>Chọn dữ liệu đã tạo để tổng hợp báo cáo trình công ty. Bản này chạy nội bộ, chưa gọi AI backend.</p>
    </div>
    <section class="ai-summary-module" id="aiSummaryModule">
      <section class="panel-card">
        <h2>Chọn nguồn dữ liệu</h2>
        <div class="ai-source-grid">
          <label class="check-row"><input id="aiUseOrders" type="checkbox" checked /><span>🛒</span>Đơn hàng</label>
          <label class="check-row"><input id="aiUseTests" type="checkbox" checked /><span>🍵</span>Test sản phẩm</label>
          <label class="check-row"><input id="aiUseReports" type="checkbox" checked /><span>📊</span>Báo cáo thị trường</label>
          <label class="check-row"><input id="aiUseRoutes" type="checkbox" checked /><span>🗺️</span>Tuyến MCP / khách tuyến</label>
        </div>
        <p class="ai-source-note">AI chỉ đọc dữ liệu đã tạo, không sửa dữ liệu gốc.</p>
      </section>
      <section class="panel-card">
        <h2>Bộ lọc</h2>
        <div class="ai-filter-grid">
          <label><span>Từ ngày</span><input type="date" id="aiDateFrom" /></label>
          <label><span>Đến ngày</span><input type="date" id="aiDateTo" /></label>
          <label><span>Sales</span><input id="aiSalesFilter" placeholder="A Tân" /></label>
          <label><span>Khu vực</span><input id="aiAreaFilter" placeholder="Gò Vấp / Q.10" /></label>
        </div>
      </section>
      <section class="panel-card">
        <h2>Dữ liệu sẽ phân tích</h2>
        <div class="ai-count-grid" id="aiSourceCounts"></div>
        <div class="ai-action-row">
          <button class="primary" type="button" id="runAiSummaryBtn">✦ Tạo báo cáo AI</button>
          <button type="button" id="loadAiHistoryBtn">↻ Tải lịch sử AI</button>
        </div>
      </section>
      <section class="panel-card ai-result-card" id="aiResultPanel">
        <h2>Kết quả AI</h2>
        <div class="empty-sync-card">Chọn dữ liệu rồi bấm “Tạo báo cáo AI”.</div>
      </section>
      <section class="panel-card">
        <h2>Lịch sử báo cáo AI</h2>
        <div class="ai-history-list" id="aiHistoryList"></div>
      </section>
    </section>`;
}

function updateCounts() {
  const { orders, tests, reports, routes, routeCustomers } = readSources();
  const box = document.getElementById('aiSourceCounts');
  if (!box) return;
  box.innerHTML = `
    <div><strong>${orders.length}</strong><small>Đơn hàng</small></div>
    <div><strong>${tests.length}</strong><small>Phiếu test</small></div>
    <div><strong>${reports.length}</strong><small>Báo cáo</small></div>
    <div><strong>${routes.length}</strong><small>Tuyến · ${routeCustomers.length} khách</small></div>`;
}

function buildSummaryResult(sources) {
  const { orders, tests, reports, routes, routeCustomers } = sources;
  const totalRevenue = orders.reduce((sum, row) => sum + Number(row.order?.grand_total || 0), 0);
  const orderAreas = topPairs(countBy(orders, (row) => row.order?.area));
  const testStatuses = {};
  const productSignals = {};
  tests.forEach(({ items = [] }) => items.forEach((item) => {
    testStatuses[item.status || 'pending'] = (testStatuses[item.status || 'pending'] || 0) + 1;
    if (['ok', 'interested', 'sample'].includes(item.status)) productSignals[item.product_name] = (productSignals[item.product_name] || 0) + 1;
  }));
  const reportAreas = topPairs(countBy(reports, (row) => row.report?.market_area || row.report?.route_name));
  const routeDays = topPairs(countBy(routes, (route) => route.route_day));
  const risks = reports.map((row) => row.report?.risk_summary).filter(Boolean).slice(0, 8);
  const opportunities = reports.map((row) => row.report?.opportunity_summary).filter(Boolean).slice(0, 8);
  const customerActions = [
    ...tests.filter(({ test }) => test.need_sample).map(({ test }) => `${test.customer_name}: gửi mẫu / hỗ trợ mẫu`),
    ...orders.filter(({ order }) => ['draft', 'pending_confirm'].includes(order.status)).map(({ order }) => `${order.customer_name}: xác nhận đơn ${order.order_code || ''}`)
  ].slice(0, 10);

  return {
    executive_summary: `Tổng hợp ${orders.length} đơn hàng, ${tests.length} phiếu test, ${reports.length} báo cáo thị trường và ${routes.length} tuyến MCP. Doanh số ghi nhận khoảng ${Math.round(totalRevenue).toLocaleString('vi-VN')}đ.`,
    market_insights: [
      reportAreas.length ? `Khu vực/tuyến có nhiều báo cáo: ${reportAreas.map(([k, v]) => `${k} (${v})`).join(', ')}.` : 'Chưa có đủ báo cáo thị trường để xếp hạng khu vực.',
      opportunities.length ? `Cơ hội thị trường nổi bật: ${opportunities.join(' | ')}` : 'Chưa ghi nhận cơ hội thị trường rõ ràng.'
    ],
    product_insights: [
      topPairs(productSignals).length ? `Sản phẩm có tín hiệu tốt: ${topPairs(productSignals).map(([k, v]) => `${k} (${v})`).join(', ')}.` : 'Chưa có tín hiệu sản phẩm đủ mạnh từ phiếu test.',
      `Tình trạng test: ${Object.entries(testStatuses).map(([k, v]) => `${k}: ${v}`).join(', ') || 'chưa có dữ liệu'}.`
    ],
    sales_opportunities: [
      orders.length ? `Có ${orders.length} đơn hàng trong tập dữ liệu; cần ưu tiên đơn nháp/chờ xác nhận.` : 'Chưa có đơn hàng trong tập dữ liệu.',
      orderAreas.length ? `Khu vực có đơn hàng: ${orderAreas.map(([k, v]) => `${k} (${v})`).join(', ')}.` : 'Chưa có khu vực đơn hàng nổi bật.'
    ],
    customer_actions: customerActions.length ? customerActions : ['Chưa có danh sách khách cần xử lý rõ; cần nhập thêm test/đơn/báo cáo.'],
    route_insights: [
      routeDays.length ? `Tuyến MCP có dữ liệu: ${routeDays.map(([k, v]) => `${k} (${v})`).join(', ')}.` : 'Chưa có tuyến MCP trong dữ liệu.',
      routeCustomers.length ? `Đã có ${routeCustomers.length} khách được gắn tuyến.` : 'Chưa có khách gắn tuyến MCP.'
    ],
    risks: risks.length ? risks : ['Chưa có rủi ro thị trường được ghi rõ.'],
    next_steps: [
      'Chốt hoặc xác nhận lại các đơn đang nháp/chờ xác nhận.',
      'Gửi mẫu cho khách có trạng thái cần mẫu.',
      'Bổ sung báo cáo thị trường theo tuyến T2-T7 để AI đọc đủ bối cảnh.',
      'Dùng Edge Function/backend để gọi AI thật ở phase sau.'
    ]
  };
}

function renderResult(result) {
  const panel = document.getElementById('aiResultPanel');
  if (!panel) return;
  const block = (title, value) => `<section class="ai-block"><h3>${esc(title)}</h3>${Array.isArray(value) ? `<ul>${value.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : `<p>${esc(value)}</p>`}</section>`;
  panel.innerHTML = `
    <h2>Kết quả AI</h2>
    ${block('Tóm tắt điều hành', result.executive_summary)}
    ${block('Insight thị trường', result.market_insights)}
    ${block('Insight sản phẩm', result.product_insights)}
    ${block('Cơ hội bán hàng', result.sales_opportunities)}
    ${block('Khách cần xử lý', result.customer_actions)}
    ${block('Tuyến MCP', result.route_insights)}
    ${block('Rủi ro', result.risks)}
    ${block('Bước tiếp theo', result.next_steps)}`;
}

function readAiRows() { return readCachedRows(STORAGE_KEYS_V2.aiSummaries); }

function renderHistory() {
  const list = document.getElementById('aiHistoryList');
  if (!list) return;
  const rows = readAiRows().slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  if (!rows.length) {
    list.innerHTML = '<article class="empty-sync-card">Chưa có báo cáo AI đã lưu.</article>';
    return;
  }
  list.innerHTML = rows.map((row) => `<article class="ai-history-card"><header><div><h3>${esc(row.title || row.id)}</h3><small>${esc(row.created_at || '')}</small></div><span class="ai-pill">${esc(row.status || 'draft')}</span></header><p class="ai-source-note">${esc(row.result?.executive_summary || 'Đã lưu summary.')}</p><button type="button" data-open-ai-summary="${esc(row.id)}">Mở lại</button></article>`).join('');
}

async function runSummary() {
  const filters = getFilters();
  const sources = readSources(filters);
  const total = sources.orders.length + sources.tests.length + sources.reports.length + sources.routes.length;
  if (!total) return toast('Chưa có dữ liệu để AI tổng hợp. Bấm Dữ liệu → Tải DB trước.');
  const result = buildSummaryResult(sources);
  const summary = makeAiSummary({
    id: uid('ai-summary'),
    title: `Báo cáo AI ${todayIsoDate()}`,
    summary_type: 'company_report',
    date_from: filters.dateFrom || null,
    date_to: filters.dateTo || null,
    sales: filters.sales,
    market_area: filters.area,
    source_filters: filters,
    source_refs: [
      ...sources.orders.map(({ order }) => ({ type: 'order', id: order.id })),
      ...sources.tests.map(({ test }) => ({ type: 'ona_test', id: test.id })),
      ...sources.reports.map(({ report }) => ({ type: 'market_report', id: report.id })),
      ...sources.routes.map((route) => ({ type: 'market_route', id: route.id }))
    ],
    result,
    status: 'draft',
    agent_id: 'local-summary-v1',
    agent_name: 'Local Summary Engine',
    note: 'Generated locally in PWA; no source data modified.'
  });
  try {
    configureSupabaseV2();
    if (isSupabaseV2Ready()) {
      const saved = await syncAiSummary(summary);
      upsertCachedRow(STORAGE_KEYS_V2.aiSummaries, saved || summary);
      toast('Đã tạo và lưu báo cáo AI lên Supabase.');
    } else {
      upsertCachedRow(STORAGE_KEYS_V2.aiSummaries, summary);
      toast('Đã tạo báo cáo AI local. Chưa cấu hình DB.');
    }
  } catch (error) {
    upsertCachedRow(STORAGE_KEYS_V2.aiSummaries, { ...summary, status: 'local_error', note: error.message });
    toast('Đã lưu local, sync AI summary lỗi.');
  }
  renderResult(result);
  renderHistory();
}

async function loadHistory() {
  try {
    configureSupabaseV2();
    if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
    const rows = await loadAiSummaries();
    cacheRows(STORAGE_KEYS_V2.aiSummaries, rows);
    renderHistory();
    toast('Đã tải lịch sử AI từ Supabase.');
  } catch (error) {
    renderHistory();
    toast(error.message || 'Không tải được lịch sử AI.');
  }
}

function bindAi() {
  document.getElementById('runAiSummaryBtn')?.addEventListener('click', runSummary);
  document.getElementById('loadAiHistoryBtn')?.addEventListener('click', loadHistory);
  ['aiUseOrders', 'aiUseTests', 'aiUseReports', 'aiUseRoutes', 'aiDateFrom', 'aiDateTo', 'aiSalesFilter', 'aiAreaFilter'].forEach((id) => {
    document.getElementById(id)?.addEventListener('input', updateCounts);
    document.getElementById(id)?.addEventListener('change', updateCounts);
  });
  document.getElementById('aiHistoryList')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-open-ai-summary]');
    if (!button) return;
    const row = readAiRows().find((item) => item.id === button.dataset.openAiSummary);
    if (row?.result) renderResult(row.result);
  });
}

async function initAiSummaryModule() {
  loadCss('ai-summary-module.css');
  ensureAiShell();
  bindAi();
  updateCounts();
  renderHistory();
  if (isSupabaseV2Ready()) loadHistory();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAiSummaryModule, { once: true });
else initAiSummaryModule();
