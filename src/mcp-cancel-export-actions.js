import { todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, getLocal, putLocal, getMeta, setMeta } from '../local-db.js';
import { ACTIVE_MCP_SESSION_META, getMcpSessionDetail, recalcMcpRouteSession } from './mcp-core.js';
import { isActiveBusinessRow, isActiveRouteCustomer, isCancelled, makeCancelled, makeInactive } from './soft-delete.js';

const weekdayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const visitLabel = { todo: 'Chưa ghé', done: 'Đã ghé', checked_in: 'Đã ghé', order: 'Có đơn', test: 'Có test', report: 'Có báo cáo', no: 'Không mua', no_buy: 'Không mua', follow_up: 'Theo dõi', skipped: 'Bỏ qua' };
let scheduled = null;

function clean(value = '') { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function esc(value = '') { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function number(value = 0) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
function stamp() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; }
function csvCell(value = '') { return `"${clean(value).replace(/"/g, '""')}"`; }
function csv(rows = []) { return `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`; }
function activeCustomer(row = {}) { return isActiveRouteCustomer(row); }
function activeSession(row = {}) { return isActiveBusinessRow(row); }
function downloadCsv(filename, rows) { const blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200); }
function toast(message) { const el = document.querySelector('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2300); }
function sessionName(session = {}, route = {}) { return [session.session_date, route.route_name || session.route_name || 'Tuyến', route.area || session.area].filter(Boolean).join(' · '); }
function visitForCustomer(customer, visits = []) { return visits.find((visit) => visit.route_customer_id === customer.id) || null; }
function visitStatus(customer, visits = []) { const visit = visitForCustomer(customer, visits); if (!visit) return 'todo'; if (visit.status === 'order' || visit.has_order) return 'order'; if (visit.status === 'test' || visit.has_test) return 'test'; if (visit.status === 'report' || visit.has_report) return 'report'; if (visit.status === 'no_buy') return 'no'; return visit.status || 'done'; }

async function cancelMcpSession(sessionId = '') {
  const session = await getLocal(LOCAL_STORES.mcpRouteSessions, sessionId);
  if (!session) return toast('Không tìm thấy phiên MCP.');
  if (isCancelled(session)) return toast('Phiên MCP này đã huỷ rồi.');
  if (!window.confirm(`Huỷ phiên MCP ${session.session_date || ''} · ${session.route_name || 'tuyến này'}?\nPhiên chỉ chuyển status = cancelled, không xoá dữ liệu.`)) return;
  await putLocal(LOCAL_STORES.mcpRouteSessions, makeCancelled(session, 'local_ui'));
  const activeId = await getMeta(ACTIVE_MCP_SESSION_META, '');
  if (activeId === sessionId) await setMeta(ACTIVE_MCP_SESSION_META, '');
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  toast('Đã huỷ phiên MCP.');
}

async function exportRouteCustomers() {
  const [routes, customers] = await Promise.all([getAllLocal(LOCAL_STORES.mcpRoutes), getAllLocal(LOCAL_STORES.mcpRouteCustomers)]);
  const routeMap = new Map(routes.filter((route) => isActiveBusinessRow(route)).map((route) => [route.id, route]));
  const rows = [['Mã tuyến', 'Tên tuyến', 'Thứ', 'Khu vực tuyến', 'STT', 'Khách hàng', 'SĐT', 'Khu vực khách', 'Địa chỉ', 'Google Maps', 'Ghi chú']];
  customers.filter((customer) => activeCustomer(customer) && routeMap.has(customer.route_id)).sort((a, b) => String(routeMap.get(a.route_id)?.route_name || '').localeCompare(String(routeMap.get(b.route_id)?.route_name || ''), 'vi') || number(a.sort_order) - number(b.sort_order)).forEach((customer) => {
    const route = routeMap.get(customer.route_id) || {};
    rows.push([route.id, route.route_name, weekdayNames[number(route.weekday)] || '', route.area, customer.sort_order, customer.customer_name, customer.phone, customer.area, customer.address, customer.google_maps_url, customer.note]);
  });
  downloadCsv(`mcp-tuyen-co-dinh-${stamp()}.csv`, rows);
  toast('Đã xuất danh sách tuyến cố định.');
}

async function exportSessionResult(sessionId = '') {
  const detail = await getMcpSessionDetail(sessionId);
  if (!detail) return toast('Không tìm thấy phiên MCP.');
  const { session, route, customers, visits, stats } = detail;
  const rows = [
    ['Kết quả MCP'],
    ['Phiên', sessionName(session, route)],
    ['Sales', session.sales || ''],
    ['Trạng thái phiên', session.status || ''],
    ['Khách tuyến', stats.planned_customers],
    ['Đã ghé', stats.visited_customers],
    ['Có đơn', stats.order_count],
    ['Có test', stats.test_count],
    ['Có báo cáo', stats.report_count],
    [],
    ['STT', 'Khách hàng', 'SĐT', 'Khu vực', 'Địa chỉ', 'Trạng thái ghé', 'Có đơn', 'Có test', 'Có báo cáo', 'Giờ check-in', 'Ghi chú', 'Google Maps']
  ];
  customers.forEach((customer, index) => {
    const visit = visitForCustomer(customer, visits);
    const status = visitStatus(customer, visits);
    rows.push([index + 1, customer.customer_name, customer.phone, customer.area, customer.address, visitLabel[status] || status, visit?.has_order ? 'Có' : '', visit?.has_test ? 'Có' : '', visit?.has_report ? 'Có' : '', visit?.checkin_at || '', visit?.note || customer.note || '', customer.google_maps_url]);
  });
  downloadCsv(`mcp-ket-qua-${clean(route?.route_name || session.route_name || 'tuyen').replace(/[^\p{L}\p{N}]+/gu, '-')}-${session.session_date || todayIsoDate()}-${stamp()}.csv`, rows);
  toast('Đã xuất kết quả MCP trong ngày.');
}

async function exportActiveSessionResult() {
  const sessionId = await getMeta(ACTIVE_MCP_SESSION_META, '');
  if (!sessionId) return toast('Chưa có phiên MCP đang mở.');
  return exportSessionResult(sessionId);
}

async function hideCustomerFromButton(customerId = '') {
  const rows = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = rows.find((row) => row.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  if (!window.confirm(`Ẩn ${customer.customer_name || 'khách này'} khỏi tuyến?`)) return;
  await putLocal(LOCAL_STORES.mcpRouteCustomers, makeInactive(customer, 'local_ui'));
  const sessionId = await getMeta(ACTIVE_MCP_SESSION_META, '');
  if (sessionId) await recalcMcpRouteSession(sessionId).catch(() => null);
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  toast('Đã ẩn khách khỏi tuyến.');
}

function installStyle() {
  let style = document.querySelector('style[data-mcp-cancel-export]');
  if (!style) { style = document.createElement('style'); style.dataset.mcpCancelExport = '1'; document.head.appendChild(style); }
  style.textContent = `.mcp-export-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:6px 0!important}.mcp-export-row button{min-height:34px!important;border-radius:11px!important;font-size:11px!important;font-weight:900!important}.mcp-danger{border-color:#fecaca!important;background:#fff7f7!important;color:#b91c1c!important}.mcp-session-cancelled{display:none!important}.mcp-data-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:8px!important}.mcp-data-actions button{min-height:32px!important;font-size:11px!important}.mcp-route-export-row{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin:0 0 8px!important}.mcp-route-export-row button{min-height:34px!important}@media(max-width:380px){.mcp-export-row,.mcp-data-actions{grid-template-columns:1fr!important}}`;
}

async function enhanceMcpPage() {
  const page = document.querySelector('section.page[data-page="mcp"].active');
  if (!page) return;
  const sessionId = await getMeta(ACTIVE_MCP_SESSION_META, '');
  const filters = page.querySelector('.mcp-filters');
  if (filters && !page.querySelector('[data-mcp-export-current]')) {
    filters.insertAdjacentHTML('afterend', `<div class="mcp-export-row"><button type="button" class="secondary" data-mcp-export-routes>Xuất tuyến</button><button type="button" class="secondary" data-mcp-export-current>Xuất kết quả</button><button type="button" class="secondary mcp-danger" data-mcp-cancel-session="${esc(sessionId)}">Huỷ phiên</button></div>`);
  }
}

async function enhanceDataMcp() {
  const shell = document.querySelector('#dataShell.active');
  const mcpTab = document.querySelector('#dataHub [data-data-view="mcp"].active');
  if (!shell || !mcpTab) return;
  const sessions = await getAllLocal(LOCAL_STORES.mcpRouteSessions);
  if (!shell.querySelector('[data-mcp-export-routes]')) {
    const openCard = shell.querySelector('.data-shell-open-card');
    openCard?.insertAdjacentHTML('beforebegin', '<div class="mcp-route-export-row"><button type="button" class="secondary" data-mcp-export-routes>Xuất danh sách tuyến</button><button type="button" class="secondary" data-mcp-start>Bắt đầu phiên mới</button></div>');
  }
  shell.querySelectorAll('[data-mcp-session-id]').forEach((card) => {
    const sessionId = card.dataset.mcpSessionId;
    const session = sessions.find((row) => row.id === sessionId);
    card.classList.toggle('mcp-session-cancelled', Boolean(session && !activeSession(session)));
    if (card.querySelector('[data-mcp-export-session]')) return;
    const actions = card.querySelector('.shell-actions') || card.appendChild(document.createElement('div'));
    actions.classList.add('shell-actions');
    actions.insertAdjacentHTML('beforeend', `<button type="button" data-mcp-export-session="${esc(sessionId)}">Xuất</button>${session && !activeSession(session) ? '' : `<button type="button" class="mcp-danger" data-mcp-cancel-session="${esc(sessionId)}">Huỷ</button>`}`);
  });
}

function scheduleEnhance(delay = 180) { clearTimeout(scheduled); scheduled = setTimeout(() => { enhanceMcpPage().catch(console.warn); enhanceDataMcp().catch(console.warn); }, delay); }

window.addEventListener('click', (event) => {
  const cancel = event.target.closest('[data-mcp-cancel-session]');
  if (cancel) { event.preventDefault(); event.stopImmediatePropagation(); cancelMcpSession(cancel.dataset.mcpCancelSession); return; }
  const exportRoutes = event.target.closest('[data-mcp-export-routes]');
  if (exportRoutes) { event.preventDefault(); event.stopImmediatePropagation(); exportRouteCustomers(); return; }
  const exportCurrent = event.target.closest('[data-mcp-export-current]');
  if (exportCurrent) { event.preventDefault(); event.stopImmediatePropagation(); exportActiveSessionResult(); return; }
  const exportSession = event.target.closest('[data-mcp-export-session]');
  if (exportSession) { event.preventDefault(); event.stopImmediatePropagation(); exportSessionResult(exportSession.dataset.mcpExportSession); return; }
  const hide = event.target.closest('[data-mcp-hide-customer-extra]');
  if (hide) { event.preventDefault(); event.stopImmediatePropagation(); hideCustomerFromButton(hide.dataset.mcpHideCustomerExtra); return; }
  scheduleEnhance(260);
}, true);

installStyle();
window.addEventListener('DOMContentLoaded', scheduleEnhance);
window.addEventListener('mcp:session-changed', () => scheduleEnhance(120));
setInterval(scheduleEnhance, 1400);
scheduleEnhance(0);
