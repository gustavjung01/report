import { todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal } from '../local-db.js';
import { getMcpSessionDetail, getMcpRouteSessions, setActiveMcpRouteSessionId } from './mcp-core.js';
import { renderRevenueInto } from './revenue-ui.js?v=revenue-ui-4';

const dataTabs = [['mcp', '🧭', 'MCP'], ['order', '🛒', 'Đơn'], ['revenue', '💰', 'DT'], ['test', '🧪', 'Test'], ['report', '📊', 'Báo cáo']];
const money = new Intl.NumberFormat('vi-VN');
const orderStatusLabels = {
  draft: 'Nháp',
  pending_confirm: 'Chờ xác nhận',
  confirmed: 'Đã xác nhận',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Đã huỷ',
  deleted: 'Đã xoá'
};
let active = 'test';
let orderFilter = { date: '', customer: '', status: '' };

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
    section.page[data-page="data"] .order-filter-card{padding:10px!important;margin:8px 0!important}
    section.page[data-page="data"] .order-filter-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}
    section.page[data-page="data"] .order-filter-grid label{display:grid!important;gap:4px!important;margin:0!important}
    section.page[data-page="data"] .order-filter-grid label:nth-child(2){grid-column:1/-1!important}
    section.page[data-page="data"] .order-filter-grid span{font-size:11px!important;font-weight:900!important;color:#52616b!important}
    section.page[data-page="data"] .order-filter-grid input,section.page[data-page="data"] .order-filter-grid select{width:100%!important;min-height:38px!important;border-radius:12px!important;border:1px solid rgba(15,37,48,.13)!important;background:#fff!important;padding:8px 10px!important;font:inherit!important;font-size:13px!important;box-sizing:border-box!important}
    section.page[data-page="data"] .order-filter-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin-top:8px!important}
    section.page[data-page="data"] .order-filter-summary{display:block!important;margin-top:8px!important;font-size:11px!important;color:#64748b!important}
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

function normalize(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function orderStatusLabel(status = '') {
  return orderStatusLabels[status] || status || 'Chưa rõ';
}

function readOrderFilter(form) {
  const data = new FormData(form);
  return {
    date: String(data.get('date') || '').trim(),
    customer: String(data.get('customer') || '').trim(),
    status: String(data.get('status') || '').trim()
  };
}

function orderMatchesFilter(order = {}, filter = orderFilter) {
  if (filter.date && order.order_date !== filter.date) return false;
  if (filter.status && order.status !== filter.status) return false;
  const query = normalize(filter.customer);
  if (query) {
    const haystack = normalize([order.customer_name, order.customer_phone, order.area, order.delivery_address, order.order_code].filter(Boolean).join(' '));
    if (!haystack.includes(query)) return false;
  }
  return true;
}

function orderStatusOptions(orders = []) {
  const statuses = [...new Set([...Object.keys(orderStatusLabels), ...orders.map((order) => order.status).filter(Boolean)])];
  return '<option value="">Tất cả</option>' + statuses.map((status) => `<option value="${esc(status)}" ${orderFilter.status === status ? 'selected' : ''}>${esc(orderStatusLabel(status))}</option>`).join('');
}

function renderOrderFilter(orders = [], filteredCount = 0) {
  const hasFilter = Boolean(orderFilter.date || orderFilter.customer || orderFilter.status);
  const summary = hasFilter ? `Đang lọc ${filteredCount}/${orders.length} đơn` : `Đang hiển thị ${orders.length} đơn gần nhất`;
  return `<form class="data-shell-card order-filter-card" data-order-filter-form>
    <div class="order-filter-grid">
      <label><span>Ngày</span><input type="date" name="date" value="${esc(orderFilter.date)}"></label>
      <label><span>Trạng thái</span><select name="status">${orderStatusOptions(orders)}</select></label>
      <label><span>Tìm khách</span><input type="search" name="customer" value="${esc(orderFilter.customer)}" placeholder="Tên, SĐT, khu vực, mã đơn"></label>
    </div>
    <div class="order-filter-actions"><button type="submit" class="primary-lite">Lọc đơn</button><button type="button" class="secondary" data-order-filter-clear>Reset</button></div>
    <small class="order-filter-summary">${esc(summary)}</small>
  </form>`;
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
  const sorted = orders.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
  const filtered = sorted.filter((order) => orderMatchesFilter(order));
  const today = todayIsoDate();
  const todayOrders = orders.filter((order) => order.order_date === today);
  const revenue = todayOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const pending = orders.filter((order) => order.status === 'draft' || order.status === 'pending_confirm').length;
  const cards = filtered.map((order) => {
    const lines = items.filter((item) => item.order_id === order.id);
    const products = lines.map((item) => `${item.product_name} x${item.quantity}`).join(' · ') || 'Chưa có sản phẩm';
    return `<article class="data-shell-card" data-order-id="${esc(order.id)}"><div class="shell-card-head"><div><h3>${esc(order.customer_name || 'Khách lẻ')} · ${esc(formatMoney(order.grand_total))}</h3><small>${esc(formatDate(order.order_date))} · ${esc(orderStatusLabel(order.status))}${order.customer_phone ? ` · ${esc(order.customer_phone)}` : ''}</small><small>${esc(products)}</small></div><span class="shell-badge">${esc(orderStatusLabel(order.status))}</span></div><div class="shell-actions"></div></article>`;
  }).join('') || '<p class="data-shell-note">Không có đơn phù hợp bộ lọc.</p>';
  shell.innerHTML = `<div class="data-shell-kpis"><div class="data-shell-kpi"><b>${todayOrders.length}</b><span>Đơn hôm nay</span></div><div class="data-shell-kpi"><b>${esc(formatMoney(revenue))}</b><span>Doanh số</span></div><div class="data-shell-kpi"><b>${pending}</b><span>Chờ xử lý</span></div></div><p class="data-shell-note">Dữ liệu đơn hàng local. Bộ lọc chỉ áp dụng cho danh sách bên dưới.</p>${renderOrderFilter(sorted, filtered.length)}<div class="data-shell-list">${cards}</div>`;
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

document.addEventListener('submit', async (event) => {
  const form = event.target.closest?.('#dataShell [data-order-filter-form]');
  if (!form || !dataPage()?.contains(form)) return;
  event.preventDefault();
  orderFilter = readOrderFilter(form);
  await apply('order');
}, true);

document.addEventListener('click', async (event) => {
  const clearFilter = event.target.closest('#dataShell [data-order-filter-clear]');
  if (clearFilter) {
    event.preventDefault();
    event.stopImmediatePropagation();
    orderFilter = { date: '', customer: '', status: '' };
    await apply('order');
    return;
  }
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
