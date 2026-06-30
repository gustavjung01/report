import { todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal } from '../local-db.js';
import { getMcpSessionDetail, getMcpRouteSessions, setActiveMcpRouteSessionId } from './mcp-core.js';
import { renderRevenueInto } from './revenue-ui.js?v=revenue-ui-4';

const dataTabs = [['mcp', '🧭', 'MCP'], ['order', '🛒', 'Đơn'], ['revenue', '💰', 'DT'], ['test', '🧪', 'Test'], ['report', '📊', 'Báo cáo']];
const money = new Intl.NumberFormat('vi-VN');
let active = 'test';

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function css() {
  let style = document.querySelector('style[data-data-hub-revenue]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.dataHubRevenue = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="data"] .data-hub-tabs{grid-template-columns:repeat(5,minmax(0,1fr))!important;gap:6px!important}
    section.page[data-page="data"] .data-hub-tab{min-width:0!important}
    section.page[data-page="data"] .data-hub-tab span{font-size:10.5px!important}
  `;
}

function dataPage() {
  return document.querySelector('section.page[data-page="data"]');
}

function dataList() {
  return dataPage()?.querySelector('#dataList') || null;
}

function dataHub() {
  return dataPage()?.querySelector('#dataHub') || null;
}

function dataShell() {
  return dataPage()?.querySelector('#dataShell') || null;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount ? `${money.format(amount)}đ` : '0đ';
}

function formatDate(value = '') {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function labelType(type = '') {
  const map = { competitor: 'Đối thủ', price: 'Giá', demand: 'Nhu cầu', opportunity: 'Cơ hội', risk: 'Rủi ro', general: 'Tổng hợp' };
  return map[type] || type || 'Tổng hợp';
}

function mainReportLine(report) {
  return report.opportunity_summary || report.demand_summary || report.competitor_summary || report.price_summary || report.risk_summary || report.note || 'Chưa có nội dung chính';
}

function activateMcpPage() {
  document.querySelectorAll('section.page').forEach((element) => element.classList.toggle('active', element.dataset.page === 'mcp'));
  document.querySelectorAll('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === 'create'));
  const subtitle = document.querySelector('#subtitle');
  if (subtitle) subtitle.textContent = 'MCP tuyến';
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
}

async function openMcpSession(sessionId) {
  if (!sessionId) return;
  await setActiveMcpRouteSessionId(sessionId);
  activateMcpPage();
}

async function sessionCard(session) {
  const detail = await getMcpSessionDetail(session.id);
  const stats = detail?.stats || session;
  const routeName = session.route_name || detail?.route?.route_name || 'Tuyến';
  const area = session.area || detail?.route?.area || 'Chưa đặt khu vực';
  const visited = Number(stats.visited_customers || 0);
  const planned = Number(stats.planned_customers || 0);
  const orders = Number(stats.order_count || 0);
  const tests = Number(stats.test_count || 0);
  const reports = Number(stats.report_count || 0);
  return `<article class="data-shell-card mcp-session-card" data-mcp-session-id="${esc(session.id)}" role="button" tabindex="0"><div class="shell-card-head"><div><h3>${esc(formatDate(session.session_date))} · ${esc(routeName)}</h3><small>${esc(area)}${session.sales ? ` · Sales: ${esc(session.sales)}` : ''}</small><small>${planned} khách · ${visited} đã ghé · ${orders} đơn · ${tests} test · ${reports} báo cáo</small></div><span class="shell-badge green">${esc(session.status || 'active')}</span></div><div class="shell-actions"><button type="button" class="primary-lite" data-mcp-open-session="${esc(session.id)}">Mở phiên</button><button type="button" data-mcp-open-session="${esc(session.id)}">Chi tiết</button></div></article>`;
}

async function renderMcpShell(shell) {
  const sessions = await getMcpRouteSessions();
  const activeSessions = sessions.filter((session) => session.status !== 'cancelled');
  const today = todayIsoDate();
  const todaySessions = activeSessions.filter((session) => session.session_date === today);
  const doneSessions = activeSessions.filter((session) => session.status === 'done').length;
  const cards = await Promise.all(activeSessions.map(sessionCard));
  shell.innerHTML = `<div class="data-shell-kpis"><div class="data-shell-kpi"><b>${activeSessions.length}</b><span>Phiên tuyến</span></div><div class="data-shell-kpi"><b>${todaySessions.length}</b><span>Hôm nay</span></div><div class="data-shell-kpi"><b>${doneSessions}</b><span>Đã chốt</span></div></div><article class="data-shell-card data-shell-open-card"><h3>Dữ liệu MCP theo phiên tuyến</h3><small>Mỗi dòng là một ngày đi tuyến. Bấm vào cả card phiên tuyến để mở đúng MCP detail.</small><button type="button" class="secondary data-shell-open-btn" data-mcp-start>Bắt đầu phiên mới</button></article><div class="data-shell-list">${cards.join('') || '<p class="data-shell-note">Chưa có phiên MCP. Bấm “Bắt đầu phiên mới” để chọn ngày/tuyến.</p>'}</div>`;
}

async function renderOrderShell(shell) {
  const [orders, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems)
  ]);
  const today = todayIsoDate();
  const todayOrders = orders.filter((order) => order.order_date === today);
  const revenue = todayOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const pending = orders.filter((order) => order.status === 'draft' || order.status === 'pending_confirm').length;
  const cards = orders
    .slice()
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((order) => {
      const lines = items.filter((item) => item.order_id === order.id);
      const products = lines.map((item) => `${item.product_name} x${item.quantity}`).join(' · ') || 'Chưa có sản phẩm';
      return `<article class="data-shell-card"><h3>${esc(order.customer_name || 'Khách lẻ')} · ${esc(formatMoney(order.grand_total))}</h3><small>${esc(products)}</small></article>`;
    }).join('') || '<p class="data-shell-note">Chưa có đơn. Vào Home → Đơn hàng → + Đơn để tạo.</p>';
  shell.innerHTML = `<div class="data-shell-kpis"><div class="data-shell-kpi"><b>${todayOrders.length}</b><span>Đơn hôm nay</span></div><div class="data-shell-kpi"><b>${esc(formatMoney(revenue))}</b><span>Doanh số</span></div><div class="data-shell-kpi"><b>${pending}</b><span>Chờ xử lý</span></div></div><p class="data-shell-note">Dữ liệu đơn hàng local, chưa bật sync Supabase.</p><div class="data-shell-list">${cards}</div>`;
}

async function renderReportShell(shell) {
  const reports = (await getAllLocal(LOCAL_STORES.marketReports)).slice().sort((a, b) => String(b.created_at || b.report_date).localeCompare(String(a.created_at || a.report_date)));
  const today = todayIsoDate();
  const todayReports = reports.filter((report) => report.report_date === today).length;
  const opportunities = reports.filter((report) => report.market_type === 'opportunity' || report.opportunity_summary).length;
  const risks = reports.filter((report) => report.market_type === 'risk' || report.risk_summary).length;
  const cards = reports.map((report) => `<article class="data-shell-card"><h3>${esc(report.market_area || 'Báo cáo')} · ${esc(labelType(report.market_type))}</h3><small>${esc(formatDate(report.report_date))}${report.sales ? ` · ${esc(report.sales)}` : ''}${report.route_name ? ` · ${esc(report.route_name)}` : ''}</small><small>${esc(mainReportLine(report))}</small></article>`).join('') || '<p class="data-shell-note">Chưa có báo cáo. Vào Home → Báo cáo → + Báo cáo để tạo.</p>';
  shell.innerHTML = `<div class="data-shell-kpis"><div class="data-shell-kpi"><b>${reports.length}</b><span>Báo cáo</span></div><div class="data-shell-kpi"><b>${todayReports}</b><span>Hôm nay</span></div><div class="data-shell-kpi"><b>${opportunities}</b><span>Cơ hội</span></div><div class="data-shell-kpi"><b>${risks}</b><span>Rủi ro</span></div></div><p class="data-shell-note">Dữ liệu báo cáo thị trường local, chưa bật sync Supabase.</p><div class="data-shell-list">${cards}</div>`;
}

function ensure() {
  css();
  const page = dataPage();
  const list = dataList();
  if (!page || !list) return;
  const h = page.querySelector('h1');
  if (h) h.hidden = true;
  let hub = dataHub();
  if (!hub) {
    hub = document.createElement('div');
    hub.id = 'dataHub';
    hub.className = 'data-hub';
    hub.innerHTML = '<div class="data-hub-tabs">' + dataTabs.map((item) => '<button type="button" class="data-hub-tab" data-data-view="' + item[0] + '"><i>' + item[1] + '</i><span>' + item[2] + '</span></button>').join('') + '</div><div id="dataShell" class="data-shell"></div>';
    list.parentNode.insertBefore(hub, list);
  } else {
    const tabs = hub.querySelector('.data-hub-tabs');
    if (tabs && !tabs.querySelector('[data-data-view="revenue"]')) {
      tabs.innerHTML = dataTabs.map((item) => '<button type="button" class="data-hub-tab" data-data-view="' + item[0] + '"><i>' + item[1] + '</i><span>' + item[2] + '</span></button>').join('');
    }
  }
  let wrap = list.closest('.data-list-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'data-list-wrap';
    list.parentNode.insertBefore(wrap, list);
    wrap.appendChild(list);
  }
  apply(active);
}

async function apply(value) {
  active = value || 'test';
  dataHub()?.querySelectorAll('[data-data-view]').forEach((button) => button.classList.toggle('active', button.dataset.dataView === active));
  const list = dataList();
  const shell = dataShell();
  const wrap = list && list.closest('.data-list-wrap');
  if (!list || !shell) return;
  if (active === 'test') {
    if (wrap) wrap.style.display = '';
    shell.className = 'data-shell';
    shell.innerHTML = '';
    return;
  }
  if (wrap) wrap.style.display = 'none';
  shell.className = 'data-shell active';
  if (active === 'mcp') {
    await renderMcpShell(shell);
    return;
  }
  if (active === 'order') {
    await renderOrderShell(shell);
    return;
  }
  if (active === 'revenue') {
    await renderRevenueInto(shell);
    return;
  }
  if (active === 'report') {
    await renderReportShell(shell);
    return;
  }
  shell.innerHTML = '<p class="data-shell-note">Chưa hỗ trợ dữ liệu này.</p>';
}

document.addEventListener('click', async (event) => {
  const sessionButton = event.target.closest('#dataShell [data-mcp-open-session]');
  if (sessionButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await openMcpSession(sessionButton.dataset.mcpOpenSession);
    return;
  }
  const sessionCardElement = event.target.closest('#dataShell [data-mcp-session-id]');
  if (sessionCardElement) {
    event.preventDefault();
    event.stopImmediatePropagation();
    await openMcpSession(sessionCardElement.dataset.mcpSessionId);
    return;
  }
  const button = event.target.closest('#dataHub [data-data-view]');
  if (!button || !dataPage()?.contains(button)) return;
  event.preventDefault();
  apply(button.dataset.dataView);
}, true);

document.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  const sessionCardElement = event.target.closest?.('#dataShell [data-mcp-session-id]');
  if (!sessionCardElement || !dataPage()?.contains(sessionCardElement)) return;
  event.preventDefault();
  await openMcpSession(sessionCardElement.dataset.mcpSessionId);
});

window.addEventListener('report:changed', () => {
  if (active === 'report') apply('report');
});
window.addEventListener('order:changed', () => {
  if (active === 'order' || active === 'revenue') apply(active);
});
window.addEventListener('mcp:session-changed', () => {
  if (active === 'mcp' || active === 'revenue') apply(active);
});

ensure();
window.addEventListener('DOMContentLoaded', ensure);
