import { todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal } from '../local-db.js';
import { getOrderRevenueDataset, summarizeOrders } from './order-summary.js';

const CANCELLED_STATUSES = new Set(['cancelled', 'deleted']);
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

function isDeleted(row = {}) {
  return Boolean(row.deleted_at || row.raw_payload?.deleted_at || row.raw_payload?.delete_reason);
}

function activeBusinessRow(row = {}) {
  return !CANCELLED_STATUSES.has(clean(row.status)) && !isDeleted(row);
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
    section.page[data-page="create"]{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding-bottom:10px!important}
    .home-today-dashboard{position:relative!important;z-index:1!important;margin-top:10px!important;border:1px solid rgba(220,232,229,.92)!important;border-radius:20px!important;background:rgba(255,255,255,.82)!important;box-shadow:0 12px 28px rgba(12,55,50,.07)!important;padding:10px!important;backdrop-filter:blur(10px)!important}
    .home-today-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;margin-bottom:8px!important}
    .home-today-head b{display:block!important;font-size:15px!important;line-height:1.05!important;color:#082337!important}
    .home-today-head small{display:block!important;margin-top:2px!important;font-size:10.5px!important;color:#63727c!important;font-weight:750!important}
    .home-today-refresh{border:0!important;border-radius:999px!important;background:#e6f8f3!important;color:#007866!important;min-width:32px!important;height:32px!important;padding:0!important;font-size:15px!important;font-weight:950!important;display:grid!important;place-items:center!important}
    .home-today-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:7px!important}
    .home-today-kpi{min-width:0!important;border:1px solid #dce8e5!important;border-radius:15px!important;background:#fbfffd!important;padding:8px 6px!important;text-align:center!important;box-shadow:0 6px 14px rgba(12,55,50,.04)!important}
    .home-today-kpi span{display:block!important;font-size:10px!important;line-height:1.1!important;color:#63727c!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-today-kpi b{display:block!important;margin-top:4px!important;font-size:18px!important;line-height:1!important;color:#082337!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-today-kpi small{display:block!important;margin-top:4px!important;font-size:9.5px!important;line-height:1.1!important;color:#63727c!important;font-weight:750!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-today-kpi.revenue b{font-size:17px!important;color:#007866!important}
    .home-actions-panel{margin-top:10px!important;border-top:1px solid rgba(220,232,229,.78)!important;padding-top:9px!important}
    .home-actions-title{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:8px!important;margin-bottom:7px!important}
    .home-actions-title b{font-size:14px!important;color:#082337!important;line-height:1.1!important}
    .home-actions-title small{font-size:10px!important;color:#63727c!important;font-weight:800!important;white-space:nowrap!important}
    .home-actions-list{display:grid!important;gap:6px!important}
    .home-action-item{width:100%!important;border:1px solid #dce8e5!important;border-radius:14px!important;background:#fff!important;min-height:40px!important;padding:7px 8px!important;display:grid!important;grid-template-columns:auto minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;text-align:left!important;color:#082337!important;box-shadow:0 5px 12px rgba(12,55,50,.035)!important}
    .home-action-item.is-zero{opacity:.72!important;background:#fbfffd!important}
    .home-action-icon{font-size:15px!important;line-height:1!important;width:20px!important;text-align:center!important}
    .home-action-main{min-width:0!important}
    .home-action-main b{display:block!important;font-size:12.5px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-action-main small{display:block!important;margin-top:2px!important;font-size:10px!important;line-height:1.1!important;color:#63727c!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .home-action-count{min-width:26px!important;height:24px!important;border-radius:999px!important;background:#e6f8f3!important;color:#007866!important;font-size:12px!important;font-weight:950!important;display:grid!important;place-items:center!important;padding:0 8px!important}
    .home-action-item.is-alert .home-action-count{background:#fff2df!important;color:#b95f00!important}
    .home-action-empty{border:1px dashed #dce8e5!important;border-radius:14px!important;background:#fbfffd!important;color:#63727c!important;font-size:11.5px!important;font-weight:850!important;padding:10px!important;text-align:center!important}
    @media(max-width:380px){.home-today-dashboard{margin-top:8px!important;padding:9px!important}.home-today-grid{gap:6px!important}.home-today-kpi{padding:7px 4px!important}.home-today-kpi b{font-size:16px!important}.home-today-kpi.revenue b{font-size:15px!important}.home-today-kpi span{font-size:9.5px!important}.home-today-kpi small{font-size:9px!important}.home-action-main b{font-size:12px!important}.home-action-main small{font-size:9.5px!important}.home-action-count{height:22px!important;font-size:11px!important}}
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
  const plannedFromRoutes = customers.filter((customer) => customer.active !== false && routeIds.has(customer.route_id)).length;
  const planned = plannedFromSessions || plannedFromRoutes;

  const visitedIds = new Set(
    scopedVisits
      .filter((visit) => VISIT_DONE_STATUSES.has(clean(visit.status)) || visit.has_order || visit.has_test || visit.has_report)
      .map((visit) => visit.route_customer_id || visit.customer_id || visit.id)
      .filter(Boolean)
  );
  const visitedFromSessions = todaySessions.reduce((total, session) => total + number(session.visited_customers), 0);
  const visited = visitedIds.size || visitedFromSessions;

  return { planned, visited, pending: Math.max(planned - visited, 0) };
}

function buildActionItems({ orders = [], tests = [], reports = [], mcp }) {
  const pendingOrders = orders.filter((order) => activeBusinessRow(order) && ORDER_ACTION_STATUSES.has(clean(order.status))).length;
  const pendingTests = tests.filter((test) => {
    if (isDeleted(test)) return false;
    if (test.raw_payload?.kind === 'test_file') return false;
    return TEST_ACTION_STATUSES.has(clean(test.overall_status || test.status));
  }).length;
  const unsyncedReports = reports.filter((report) => activeBusinessRow(report) && UNSYNCED_STATUSES.has(clean(report.sync_status || 'pending'))).length;

  return [
    {
      icon: '🧾',
      title: 'Đơn nháp / đơn chờ',
      note: pendingOrders ? 'Cần kiểm tra trước khi chốt.' : 'Không có đơn đang chờ.',
      count: pendingOrders,
      view: 'order'
    },
    {
      icon: '🧭',
      title: 'Khách MCP chưa ghé',
      note: mcp.planned ? 'Theo phiên tuyến hôm nay.' : 'Chưa mở tuyến hôm nay.',
      count: mcp.pending,
      view: 'mcp'
    },
    {
      icon: '🧪',
      title: 'Test chưa hoàn tất',
      note: pendingTests ? 'Có khách test cần cập nhật.' : 'Không có test đang treo.',
      count: pendingTests,
      view: 'test'
    },
    {
      icon: '📊',
      title: 'Báo cáo chưa đồng bộ',
      note: unsyncedReports ? 'Cần sync khi có mạng.' : 'Báo cáo đã ổn.',
      count: unsyncedReports,
      view: 'report'
    }
  ];
}

async function buildHomeToday() {
  const today = todayIsoDate();
  const [orders, tests, reports, sessions, visits, customers, revenueDataset] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.marketReports),
    getAllLocal(LOCAL_STORES.mcpRouteSessions),
    getAllLocal(LOCAL_STORES.mcpVisits),
    getAllLocal(LOCAL_STORES.mcpRouteCustomers),
    getOrderRevenueDataset({ date_from: today, date_to: today })
  ]);

  const revenue = summarizeOrders(revenueDataset);
  const todayOrders = orders.filter((order) => activeBusinessRow(order) && dateOf(order, ['order_date', 'date', 'created_at']) === today);
  const todayTests = tests.filter((test) => {
    if (isDeleted(test)) return false;
    if (dateOf(test, ['test_date', 'date', 'created_at']) !== today) return false;
    return test.raw_payload?.kind !== 'test_file';
  });
  const todayReports = reports.filter((report) => activeBusinessRow(report) && dateOf(report, ['report_date', 'date', 'created_at']) === today);
  const mcp = countMcpToday({ sessions, visits, customers }, today);

  return {
    today,
    mcp,
    orders: revenue.order_count || todayOrders.length,
    revenue: revenue.revenue,
    tests: todayTests.length,
    reports: todayReports.length,
    actions: buildActionItems({ orders, tests, reports, mcp })
  };
}

function renderLoading(target) {
  target.innerHTML = `
    <div class="home-today-head"><div><b>Hôm nay</b><small>Đang đọc dữ liệu local...</small></div><button class="home-today-refresh" type="button" data-home-today-refresh>↻</button></div>
    <div class="home-today-grid">
      ${['MCP ghé', 'Đơn', 'Doanh thu', 'Test', 'Báo cáo'].map((label) => `<article class="home-today-kpi"><span>${label}</span><b>-</b><small>hôm nay</small></article>`).join('')}
    </div>
    <div class="home-actions-panel"><div class="home-actions-title"><b>Cần xử lý</b><small>Đang tính...</small></div><div class="home-actions-list"><div class="home-action-empty">Đang đọc việc cần xử lý.</div></div></div>`;
}

function renderActions(actions = []) {
  const total = actions.reduce((sum, item) => sum + number(item.count), 0);
  const rows = actions.map((item) => `
    <button class="home-action-item ${item.count ? 'is-alert' : 'is-zero'}" type="button" data-home-open-data="${item.view}">
      <span class="home-action-icon">${item.icon}</span>
      <span class="home-action-main"><b>${item.title}</b><small>${item.note}</small></span>
      <span class="home-action-count">${item.count}</span>
    </button>`).join('');
  return `
    <div class="home-actions-panel">
      <div class="home-actions-title"><b>Cần xử lý</b><small>${total ? `${total} mục` : 'Ổn'}</small></div>
      <div class="home-actions-list">${rows || '<div class="home-action-empty">Không có việc cần xử lý.</div>'}</div>
    </div>`;
}

function renderDashboard(target, data) {
  const mcpValue = data.mcp.planned ? `${data.mcp.visited}/${data.mcp.planned}` : `${data.mcp.visited}`;
  target.innerHTML = `
    <div class="home-today-head">
      <div><b>Hôm nay</b><small>Số liệu nhanh từ dữ liệu máy</small></div>
      <button class="home-today-refresh" type="button" data-home-today-refresh aria-label="Làm mới số hôm nay">↻</button>
    </div>
    <div class="home-today-grid">
      <article class="home-today-kpi"><span>🧭 MCP ghé</span><b>${mcpValue}</b><small>khách tuyến</small></article>
      <article class="home-today-kpi"><span>🧾 Đơn</span><b>${data.orders}</b><small>đơn hôm nay</small></article>
      <article class="home-today-kpi revenue"><span>💰 Doanh thu</span><b>${formatCompactMoney(data.revenue)}</b><small>không tính đơn huỷ</small></article>
      <article class="home-today-kpi"><span>🧪 Test</span><b>${data.tests}</b><small>khách test</small></article>
      <article class="home-today-kpi"><span>📊 Báo cáo</span><b>${data.reports}</b><small>báo cáo</small></article>
    </div>
    ${renderActions(data.actions)}`;
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

function openDataView(view = '') {
  if (!view) return;
  document.querySelectorAll('section.page').forEach((element) => element.classList.toggle('active', element.dataset.page === 'data'));
  document.querySelectorAll('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === 'data'));
  const subtitle = document.querySelector('#subtitle');
  if (subtitle) subtitle.textContent = 'Dữ liệu';
  setTimeout(() => {
    const tab = document.querySelector(`#dataHub [data-data-view="${view}"]`);
    tab?.click();
  }, 80);
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
