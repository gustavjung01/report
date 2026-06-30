import { todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, getSyncQueue, localStats } from '../local-db.js';
import { getOrderRevenueDataset, summarizeOrders } from './order-summary.js';
import { isActiveBusinessRow, isActiveRouteCustomer, isActiveTestRow } from './soft-delete.js';

const VISIT_DONE_STATUSES = new Set(['done', 'checked_in', 'order', 'test', 'report', 'no', 'no_buy', 'follow_up']);
const ORDER_ACTION_STATUSES = new Set(['draft', 'pending_confirm']);
const TEST_ACTION_STATUSES = new Set(['draft', 'pending', 'follow', 'retry', 'sample']);
const UNSYNCED_STATUSES = new Set(['pending', 'local', 'error', 'syncing']);
let refreshTimer = null;

function number(value = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clean(value = '') {
  return String(value ?? '').trim();
}

function dateOf(row = {}, fields = []) {
  for (const field of fields) {
    const value = clean(row[field] || row.raw_payload?.[field]);
    if (value) return value.slice(0, 10);
  }
  return '';
}

function addDaysIso(dateIso, delta) {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

function inRange(row = {}, fields = [], from = '', to = '') {
  const date = dateOf(row, fields);
  return Boolean(date && (!from || date >= from) && (!to || date <= to));
}

function activeBusinessRow(row = {}) {
  return isActiveBusinessRow(row);
}

function activeTestRow(row = {}) {
  return isActiveTestRow(row);
}

function formatCompactMoney(value = 0) {
  const amount = Math.round(number(value));
  const abs = Math.abs(amount);
  const oneDecimal = (n) => (Math.round(n * 10) / 10).toLocaleString('vi-VN', { maximumFractionDigits: 1 });
  if (!amount) return '0đ';
  if (abs >= 1_000_000_000) return `${oneDecimal(amount / 1_000_000_000)}tỷ`;
  if (abs >= 1_000_000) return `${oneDecimal(amount / 1_000_000)}tr`;
  if (abs >= 1_000) return `${Math.round(amount / 1_000).toLocaleString('vi-VN')}k`;
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function installStyle() {
  let style = document.querySelector('style[data-home-today-dashboard]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.homeTodayDashboard = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="create"]{overflow:hidden!important;display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:8px!important;padding-bottom:0!important}
    section.page[data-page="create"] .grid-actions{margin-bottom:0!important;gap:8px!important}
    section.page[data-page="create"] .home-card{min-height:124px!important}
    .home-today-dashboard{position:relative!important;z-index:1!important;min-height:0!important;overflow:hidden!important;border:1px solid rgba(220,232,229,.92)!important;border-radius:18px!important;background:rgba(255,255,255,.82)!important;box-shadow:0 10px 24px rgba(12,55,50,.06)!important;padding:8px!important;backdrop-filter:blur(10px)!important;display:grid!important;grid-template-rows:auto auto auto!important;gap:7px!important}
    .home-today-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin-bottom:5px!important}
    .home-today-head b{display:block!important;font-size:14px!important;line-height:1.05!important;color:#082337!important}
    .home-today-head small{display:block!important;margin-top:1px!important;font-size:10px!important;color:#63727c!important;font-weight:750!important}
    .home-today-refresh{border:0!important;border-radius:999px!important;background:#e6f8f3!important;color:#007866!important;min-width:28px!important;height:28px!important;padding:0!important;font-size:13px!important;font-weight:950!important;display:grid!important;place-items:center!important}
    .home-today-grid{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:5px!important}
    .home-today-kpi{min-width:0!important;border:1px solid #dce8e5!important;border-radius:13px!important;background:#fbfffd!important;padding:6px 3px!important;text-align:center!important;box-shadow:0 5px 12px rgba(12,55,50,.035)!important}
    .home-today-kpi span{display:block!important;font-size:9px!important;line-height:1!important;color:#63727c!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-today-kpi b{display:block!important;margin-top:3px!important;font-size:16px!important;line-height:1!important;color:#082337!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-today-kpi small{display:block!important;margin-top:3px!important;font-size:8.5px!important;line-height:1!important;color:#63727c!important;font-weight:750!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-today-kpi.revenue b{font-size:15px!important;color:#007866!important}
    .home-actions-panel{min-height:0!important;border-top:1px solid rgba(220,232,229,.78)!important;padding-top:6px!important;overflow:hidden!important}
    .home-actions-title{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin-bottom:5px!important}
    .home-actions-title b,.home-extra-title b{font-size:13px!important;color:#082337!important;line-height:1.1!important}
    .home-actions-title small,.home-extra-title small{font-size:9.5px!important;color:#63727c!important;font-weight:850!important;white-space:nowrap!important}
    .home-actions-list{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:5px!important}
    .home-action-item{width:100%!important;border:1px solid #dce8e5!important;border-radius:13px!important;background:#fff!important;min-height:43px!important;padding:6px 7px!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;gap:6px!important;align-items:center!important;text-align:left!important;color:#082337!important;box-shadow:0 4px 10px rgba(12,55,50,.03)!important}
    .home-action-item.is-zero{opacity:.74!important;background:#fbfffd!important}
    .home-action-icon{font-size:14px!important;line-height:1!important;width:18px!important;text-align:center!important}
    .home-action-main{min-width:0!important}
    .home-action-main b{display:block!important;font-size:11.3px!important;line-height:1.1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-action-main small{display:block!important;margin-top:2px!important;font-size:9px!important;line-height:1!important;color:#63727c!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-action-count{min-width:24px!important;height:22px!important;border-radius:999px!important;background:#e6f8f3!important;color:#007866!important;font-size:11px!important;font-weight:950!important;display:grid!important;place-items:center!important;padding:0 7px!important}
    .home-action-item.is-alert .home-action-count{background:#fff2df!important;color:#b95f00!important}
    .home-extra-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;min-height:0!important}
    .home-extra-card{border:1px solid #dce8e5!important;border-radius:14px!important;background:#fbfffd!important;padding:7px!important;min-height:68px!important;text-align:left!important;color:#082337!important;box-shadow:0 4px 10px rgba(12,55,50,.03)!important;overflow:hidden!important}
    button.home-extra-card{cursor:pointer!important}
    .home-extra-title{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:6px!important;margin-bottom:5px!important}
    .home-mini-row{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:6px!important;font-size:10px!important;line-height:1.15!important;color:#63727c!important;font-weight:850!important;white-space:nowrap!important;overflow:hidden!important}
    .home-mini-row + .home-mini-row{margin-top:3px!important}
    .home-mini-row b{font-size:11px!important;color:#082337!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-mini-row.strong b{color:#007866!important}
    @media(max-width:380px){section.page[data-page="create"]{gap:6px!important}section.page[data-page="create"] .grid-actions{gap:6px!important}section.page[data-page="create"] .home-card{min-height:112px!important;padding:9px!important}.home-today-dashboard{padding:7px!important;gap:6px!important}.home-today-grid{gap:4px!important}.home-today-kpi{padding:5px 2px!important}.home-today-kpi b{font-size:14px!important}.home-today-kpi.revenue b{font-size:13px!important}.home-today-kpi small{display:none!important}.home-action-main b{font-size:10.8px!important}.home-action-main small{display:none!important}.home-extra-card{min-height:60px!important;padding:6px!important}.home-mini-row{font-size:9.5px!important}.home-mini-row b{font-size:10px!important}}
    @media(max-height:760px){section.page[data-page="create"] .home-card{min-height:112px!important;padding:9px!important}.home-action-main small,.home-today-kpi small{display:none!important}.home-action-item{min-height:36px!important}.home-extra-card{min-height:58px!important}.home-mini-row{font-size:9.5px!important}.home-mini-row + .home-mini-row{margin-top:2px!important}}
  `;
}

function ensureDashboard() {
  const page = document.querySelector('section.page[data-page="create"]');
  const grid = page?.querySelector('.grid-actions');
  if (!page || !grid) return null;
  let dashboard = page.querySelector('#homeTodayDashboard');
  if (!dashboard) {
    dashboard = document.createElement('section');
    dashboard.id = 'homeTodayDashboard';
    dashboard.className = 'home-today-dashboard';
    dashboard.setAttribute('aria-live', 'polite');
    grid.insertAdjacentElement('afterend', dashboard);
  }
  return dashboard;
}

function countMcpToday({ sessions = [], visits = [], customers = [] }, today) {
  const todaySessions = sessions.filter((session) => activeBusinessRow(session) && dateOf(session, ['session_date', 'visit_date', 'date', 'created_at']) === today);
  const sessionIds = new Set(todaySessions.map((session) => session.id).filter(Boolean));
  const routeIds = new Set(todaySessions.map((session) => session.route_id).filter(Boolean));

  const scopedVisits = visits.filter((visit) => {
    if (dateOf(visit, ['visit_date', 'date', 'created_at']) !== today) return false;
    if (sessionIds.size && sessionIds.has(visit.session_id)) return true;
    if (routeIds.size && routeIds.has(visit.route_id)) return true;
    return !sessionIds.size && !routeIds.size;
  });

  scopedVisits.forEach((visit) => {
    if (visit.session_id) sessionIds.add(visit.session_id);
    if (visit.route_id) routeIds.add(visit.route_id);
  });

  const plannedFromSessions = todaySessions.reduce((total, session) => total + number(session.planned_customers), 0);
  const plannedFromRoutes = customers.filter((customer) => isActiveRouteCustomer(customer) && routeIds.has(customer.route_id)).length;
  const planned = plannedFromSessions || plannedFromRoutes;
  const visitedIds = new Set(scopedVisits.filter((visit) => VISIT_DONE_STATUSES.has(clean(visit.status)) || visit.has_order || visit.has_test || visit.has_report).map((visit) => visit.route_customer_id || visit.customer_id || visit.id).filter(Boolean));
  const visitedFromSessions = todaySessions.reduce((total, session) => total + number(session.visited_customers), 0);
  const visited = visitedIds.size || visitedFromSessions;
  return { planned, visited, pending: Math.max(planned - visited, 0) };
}

function buildActionItems({ orders = [], tests = [], reports = [], mcp }) {
  const pendingOrders = orders.filter((order) => activeBusinessRow(order) && ORDER_ACTION_STATUSES.has(clean(order.status))).length;
  const pendingTests = tests.filter((test) => activeTestRow(test) && test.raw_payload?.kind !== 'test_file' && TEST_ACTION_STATUSES.has(clean(test.overall_status || test.status))).length;
  const unsyncedReports = reports.filter((report) => activeBusinessRow(report) && UNSYNCED_STATUSES.has(clean(report.sync_status || 'pending'))).length;
  return [
    { icon: '🧾', title: 'Đơn nháp / chờ', note: pendingOrders ? 'Cần kiểm tra trước khi chốt.' : 'Không có đơn đang chờ.', count: pendingOrders, view: 'order' },
    { icon: '🧭', title: 'MCP chưa ghé', note: mcp.planned ? 'Theo phiên tuyến hôm nay.' : 'Chưa mở tuyến hôm nay.', count: mcp.pending, view: 'mcp' },
    { icon: '🧪', title: 'Test chưa xong', note: pendingTests ? 'Có khách test cần cập nhật.' : 'Không có test đang treo.', count: pendingTests, view: 'test' },
    { icon: '📊', title: 'Báo cáo chưa sync', note: unsyncedReports ? 'Cần sync khi có mạng.' : 'Báo cáo đã ổn.', count: unsyncedReports, view: 'report' }
  ];
}

function buildSevenDay({ orders = [], tests = [], reports = [], revenueSummary, from, to }) {
  const activeOrders = orders.filter((order) => activeBusinessRow(order) && inRange(order, ['order_date', 'date', 'created_at'], from, to));
  const activeTests = tests.filter((test) => activeTestRow(test) && test.raw_payload?.kind !== 'test_file' && inRange(test, ['test_date', 'date', 'created_at'], from, to));
  const activeReports = reports.filter((report) => activeBusinessRow(report) && inRange(report, ['report_date', 'date', 'created_at'], from, to));
  return {
    order_count: revenueSummary.order_count || activeOrders.length,
    revenue: revenueSummary.revenue,
    test_count: activeTests.length,
    report_count: activeReports.length
  };
}

async function buildHomeToday() {
  const today = todayIsoDate();
  const sevenFrom = addDaysIso(today, -6);
  const [orders, tests, reports, sessions, visits, customers, todayDataset, sevenDataset, stats, queue] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.marketReports),
    getAllLocal(LOCAL_STORES.mcpRouteSessions),
    getAllLocal(LOCAL_STORES.mcpVisits),
    getAllLocal(LOCAL_STORES.mcpRouteCustomers),
    getOrderRevenueDataset({ date_from: today, date_to: today }),
    getOrderRevenueDataset({ date_from: sevenFrom, date_to: today }),
    localStats(),
    getSyncQueue()
  ]);

  const todayRevenue = summarizeOrders(todayDataset);
  const sevenRevenue = summarizeOrders(sevenDataset);
  const todayOrders = orders.filter((order) => activeBusinessRow(order) && dateOf(order, ['order_date', 'date', 'created_at']) === today);
  const todayTests = tests.filter((test) => activeTestRow(test) && test.raw_payload?.kind !== 'test_file' && dateOf(test, ['test_date', 'date', 'created_at']) === today);
  const todayReports = reports.filter((report) => activeBusinessRow(report) && dateOf(report, ['report_date', 'date', 'created_at']) === today);
  const mcp = countMcpToday({ sessions, visits, customers }, today);
  const queuePending = queue.filter((job) => !['done', 'synced'].includes(clean(job.status))).length;
  const queueError = queue.filter((job) => clean(job.status) === 'error').length;

  return {
    today,
    mcp,
    orders: todayRevenue.order_count || todayOrders.length,
    revenue: todayRevenue.revenue,
    tests: todayTests.length,
    reports: todayReports.length,
    actions: buildActionItems({ orders, tests, reports, mcp }),
    seven: buildSevenDay({ orders, tests, reports, revenueSummary: sevenRevenue, from: sevenFrom, to: today }),
    sync: {
      records: number(stats.records),
      pending: Math.max(number(stats.pending), queuePending),
      error: Math.max(number(stats.error), queueError),
      queue: queuePending
    }
  };
}

function renderLoading(target) {
  target.innerHTML = `
    <div><div class="home-today-head"><div><b>Hôm nay</b><small>Đang đọc dữ liệu local...</small></div><button class="home-today-refresh" type="button" data-home-today-refresh>↻</button></div><div class="home-today-grid">${['MCP', 'Đơn', 'DT', 'Test', 'BC'].map((label) => `<article class="home-today-kpi"><span>${label}</span><b>-</b><small>hôm nay</small></article>`).join('')}</div></div>
    <div class="home-actions-panel"><div class="home-actions-title"><b>Cần xử lý</b><small>Đang tính...</small></div><div class="home-actions-list"></div></div>
    <div class="home-extra-grid"><article class="home-extra-card"><div class="home-extra-title"><b>7 ngày</b><small>-</small></div></article><article class="home-extra-card"><div class="home-extra-title"><b>Dữ liệu</b><small>-</small></div></article></div>`;
}

function renderActions(actions = []) {
  const total = actions.reduce((sum, item) => sum + number(item.count), 0);
  const rows = actions.map((item) => `
    <button class="home-action-item ${item.count ? 'is-alert' : 'is-zero'}" type="button" data-home-open-data="${item.view}">
      <span class="home-action-icon">${item.icon}</span>
      <span class="home-action-main"><b>${item.title}</b><small>${item.note}</small></span>
      <span class="home-action-count">${item.count}</span>
    </button>`).join('');
  return `<div class="home-actions-panel"><div class="home-actions-title"><b>Cần xử lý</b><small>${total ? `${total} mục` : 'Ổn'}</small></div><div class="home-actions-list">${rows}</div></div>`;
}

function renderExtra(data) {
  return `
    <div class="home-extra-grid">
      <button class="home-extra-card" type="button" data-home-open-data="revenue">
        <div class="home-extra-title"><b>7 ngày gần đây</b><small>DT</small></div>
        <div class="home-mini-row strong"><span>Doanh thu</span><b>${formatCompactMoney(data.seven.revenue)}</b></div>
        <div class="home-mini-row"><span>Đơn · Test · BC</span><b>${data.seven.order_count} · ${data.seven.test_count} · ${data.seven.report_count}</b></div>
      </button>
      <button class="home-extra-card" type="button" data-home-open-page="admin">
        <div class="home-extra-title"><b>Đồng bộ / dữ liệu</b><small>${data.sync.error ? 'Lỗi' : 'OK'}</small></div>
        <div class="home-mini-row"><span>Chờ sync · Lỗi</span><b>${data.sync.pending} · ${data.sync.error}</b></div>
        <div class="home-mini-row"><span>Local records</span><b>${data.sync.records}</b></div>
      </button>
    </div>`;
}

function renderDashboard(target, data) {
  const mcpValue = data.mcp.planned ? `${data.mcp.visited}/${data.mcp.planned}` : `${data.mcp.visited}`;
  target.innerHTML = `
    <div>
      <div class="home-today-head"><div><b>Hôm nay</b><small>Số liệu nhanh từ dữ liệu máy</small></div><button class="home-today-refresh" type="button" data-home-today-refresh aria-label="Làm mới số hôm nay">↻</button></div>
      <div class="home-today-grid">
        <article class="home-today-kpi"><span>🧭 MCP</span><b>${mcpValue}</b><small>ghé</small></article>
        <article class="home-today-kpi"><span>🧾 Đơn</span><b>${data.orders}</b><small>hôm nay</small></article>
        <article class="home-today-kpi revenue"><span>💰 DT</span><b>${formatCompactMoney(data.revenue)}</b><small>trừ huỷ</small></article>
        <article class="home-today-kpi"><span>🧪 Test</span><b>${data.tests}</b><small>khách</small></article>
        <article class="home-today-kpi"><span>📊 BC</span><b>${data.reports}</b><small>báo cáo</small></article>
      </div>
    </div>
    ${renderActions(data.actions)}
    ${renderExtra(data)}`;
}

export async function renderHomeTodayDashboard() {
  installStyle();
  const target = ensureDashboard();
  if (!target) return;
  if (!target.dataset.ready) renderLoading(target);
  try {
    const data = await buildHomeToday();
    target.dataset.ready = '1';
    renderDashboard(target, data);
  } catch (error) {
    console.warn('home today dashboard failed', error);
    target.innerHTML = '<p class="empty">Chưa đọc được số hôm nay.</p>';
  }
}

function scheduleRender(delay = 180) {
  clearTimeout(refreshTimer);
  refreshTimer = setTimeout(renderHomeTodayDashboard, delay);
}

function openPage(page = '') {
  if (!page) return;
  document.querySelectorAll('section.page').forEach((element) => element.classList.toggle('active', element.dataset.page === page));
  document.querySelectorAll('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === page));
  const subtitle = document.querySelector('#subtitle');
  if (subtitle) subtitle.textContent = page === 'data' ? 'Dữ liệu' : page === 'admin' ? 'Admin' : 'Tạo dữ liệu';
}

function openDataView(view = '') {
  if (!view) return;
  openPage('data');
  setTimeout(() => document.querySelector(`#dataHub [data-data-view="${view}"]`)?.click(), 80);
}

function bootHomeTodayDashboard() {
  installStyle();
  scheduleRender(0);
}

document.addEventListener('click', (event) => {
  const action = event.target.closest('[data-home-open-data]');
  if (action) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openDataView(action.dataset.homeOpenData);
    return;
  }
  const pageButton = event.target.closest('[data-home-open-page]');
  if (pageButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openPage(pageButton.dataset.homeOpenPage);
    return;
  }
  if (event.target.closest('[data-home-today-refresh]')) {
    event.preventDefault();
    renderHomeTodayDashboard();
    return;
  }
  scheduleRender(420);
}, true);

document.addEventListener('submit', () => scheduleRender(700), true);
window.addEventListener('mcp:session-changed', () => scheduleRender(120));
window.addEventListener('focus', () => scheduleRender(120));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) scheduleRender(120);
});
window.addEventListener('DOMContentLoaded', bootHomeTodayDashboard);
bootHomeTodayDashboard();
