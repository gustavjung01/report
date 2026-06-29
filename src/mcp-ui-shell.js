import './business-ui-shells.js';
import { makeMcpRoute, makeMcpRouteCustomer, makeMcpVisit, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal } from '../local-db.js';

const weekdayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
const statusLabel = { todo: 'Chưa ghé', done: 'Đã ghé', order: 'Có đơn', test: 'Có test', no: 'Không mua' };
const statusNote = { done: 'Đã check-in', order: 'Đánh dấu có đơn', test: 'Đánh dấu có test', no: 'Đã ghé nhưng không mua' };
let activeFilter = 'all';
let activeRouteId = '';

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function css() { /* Shell styles are preloaded from polish.css to avoid first-load reflow. */ }

function todayWeekday() {
  return new Date().getDay();
}

function page() {
  if (document.querySelector('section.page[data-page="mcp"]')) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', '<section class="page mcp-page" data-page="mcp"></section>');
}

async function ensureRoute() {
  const weekday = todayWeekday();
  const routes = await getAllLocal(LOCAL_STORES.mcpRoutes);
  const activeRoutes = routes.filter((route) => route.active !== false && Number(route.weekday) === weekday);
  const route = activeRoutes[0] || makeMcpRoute({ route_name: 'Tuyến A', weekday, area: 'Khu vực hôm nay', note: 'Tuyến mặc định, có thể thêm khách ngay.' });
  if (!activeRoutes.length) await putLocal(LOCAL_STORES.mcpRoutes, route);
  activeRouteId = activeRouteId || route.id;
  return routes.find((item) => item.id === activeRouteId) || route;
}

async function loadState() {
  const route = await ensureRoute();
  const [customers, visits] = await Promise.all([
    getAllLocal(LOCAL_STORES.mcpRouteCustomers),
    getAllLocal(LOCAL_STORES.mcpVisits)
  ]);
  const today = todayIsoDate();
  const routeCustomers = customers
    .filter((customer) => customer.route_id === route.id && customer.active !== false)
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || String(a.customer_name).localeCompare(String(b.customer_name), 'vi'));
  const todayVisits = visits.filter((visit) => visit.route_id === route.id && visit.visit_date === today);
  return { route, customers: routeCustomers, visits: todayVisits, today };
}

function visitFor(customer, visits) {
  return visits.find((visit) => visit.route_customer_id === customer.id) || null;
}

function statusOf(customer, visits) {
  const visit = visitFor(customer, visits);
  if (!visit) return 'todo';
  if (visit.status === 'order' || visit.has_order) return 'order';
  if (visit.status === 'test' || visit.has_test) return 'test';
  return visit.status || 'done';
}

function statusClasses(status) {
  const base = status === 'todo' ? 'todo' : 'done';
  return [base, status].filter(Boolean).join(' ');
}

function statCount(customers, visits, status) {
  return customers.filter((customer) => statusOf(customer, visits) === status).length;
}

function renderCards(customers, visits) {
  const filtered = customers.filter((customer) => {
    const status = statusOf(customer, visits);
    return activeFilter === 'all' || status === activeFilter || (activeFilter === 'done' && status !== 'todo');
  });

  if (!customers.length) {
    return '<p class="mcp-empty">Chưa có khách trong tuyến. Bấm + Khách để thêm khách đầu tiên.</p>';
  }
  if (!filtered.length) return '<p class="mcp-empty">Không có khách trong bộ lọc này.</p>';

  return filtered.map((customer) => {
    const status = statusOf(customer, visits);
    const detail = [customer.area, customer.phone, customer.address].filter(Boolean).join(' · ') || 'Khách trong tuyến';
    return `<article class="mcp-customer" data-status="${esc(statusClasses(status))}" data-customer-id="${esc(customer.id)}">
      <div class="mcp-customer-head"><div><h3>${esc(customer.customer_name)}</h3><small>${esc(detail)}</small></div><span class="mcp-badge ${esc(status)}">${esc(statusLabel[status] || status)}</span></div>
      ${customer.note ? `<small class="mcp-note">${esc(customer.note)}</small>` : ''}
      <div class="mcp-actions">
        <button type="button" data-mcp-status="done" data-customer-id="${esc(customer.id)}">Check-in</button>
        <button type="button" data-mcp-status="order" data-customer-id="${esc(customer.id)}">Có đơn</button>
        <button type="button" data-mcp-status="test" data-customer-id="${esc(customer.id)}">Có test</button>
        <button type="button" data-mcp-status="no" data-customer-id="${esc(customer.id)}">Không mua</button>
      </div>
    </article>`;
  }).join('');
}

async function render() {
  const section = document.querySelector('section.page[data-page="mcp"]');
  if (!section) return;
  const { route, customers, visits, today } = await loadState();
  const done = customers.filter((customer) => statusOf(customer, visits) !== 'todo').length;
  const order = statCount(customers, visits, 'order');
  const test = statCount(customers, visits, 'test');
  const weekday = weekdayNames[todayWeekday()] || 'Hôm nay';
  const filters = [
    ['all', 'Tất cả'],
    ['todo', 'Chưa ghé'],
    ['done', 'Đã ghé'],
    ['order', 'Có đơn'],
    ['test', 'Có test'],
    ['no', 'Không mua']
  ];

  section.innerHTML = `<article class="mcp-route-card"><div class="mcp-route-main"><small>${esc(weekday)} · ${esc(today)}</small><b>${esc(route.route_name)} · ${esc(route.area || 'Chưa đặt khu vực')}</b><p>Tuyến hôm nay, khách trong tuyến và trạng thái ghé.</p></div><div class="mcp-score"><span><b>${customers.length}</b> khách</span><span><b>${done}</b> ghé</span></div></article>
    <div class="mcp-stats"><div class="mcp-stat"><b>${customers.length}</b><span>Khách</span></div><div class="mcp-stat"><b>${done}</b><span>Đã ghé</span></div><div class="mcp-stat"><b>${order}</b><span>Có đơn</span></div><div class="mcp-stat"><b>${test}</b><span>Có test</span></div></div>
    <div class="mcp-list-wrap"><div class="mcp-filters"><button type="button" class="mcp-filter mcp-add" data-mcp-add-customer>+ Khách</button>${filters.map(([value, label]) => `<button type="button" class="mcp-filter ${activeFilter === value ? 'active' : ''}" data-mcp-filter="${value}">${label}</button>`).join('')}</div><div class="mcp-list">${renderCards(customers, visits)}</div></div>`;
}

function openCustomerModal() {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-customer';
  dialog.innerHTML = `<form class="modal" data-mcp-customer-form><header><h2>Thêm khách vào tuyến</h2><button type="button" data-close>Đóng</button></header><div class="form"><div class="grid"><label><span>Khách</span><input id="mcpCustomerName" required placeholder="Tên quán / đại lý"></label><label><span>SĐT</span><input id="mcpCustomerPhone" inputmode="tel"></label></div><label><span>Khu vực</span><input id="mcpCustomerArea" placeholder="Ví dụ: Chợ Lớn"></label><label><span>Địa chỉ</span><input id="mcpCustomerAddress"></label><label><span>Ghi chú tuyến</span><textarea id="mcpCustomerNote" rows="2" placeholder="Giờ ghé, người liên hệ, ưu tiên..."></textarea></label><button class="primary" data-mcp-save-customer>Thêm vào tuyến</button></div></form>`;
  dialog.showModal();
  document.querySelector('#mcpCustomerName')?.focus();
}

async function saveCustomer(event) {
  event.preventDefault();
  const route = await ensureRoute();
  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const current = customers.filter((customer) => customer.route_id === route.id);
  const name = document.querySelector('#mcpCustomerName')?.value.trim();
  if (!name) return toast('Nhập tên khách trước đã.');
  const row = makeMcpRouteCustomer({
    route_id: route.id,
    customer_name: name,
    phone: document.querySelector('#mcpCustomerPhone')?.value,
    area: document.querySelector('#mcpCustomerArea')?.value || route.area,
    address: document.querySelector('#mcpCustomerAddress')?.value,
    note: document.querySelector('#mcpCustomerNote')?.value,
    sort_order: current.length + 1
  });
  await putLocal(LOCAL_STORES.mcpRouteCustomers, row);
  document.querySelector('#modal')?.close();
  await render();
  toast('Đã thêm khách vào tuyến.');
}

async function setVisitStatus(customerId, status) {
  const { route, visits, today } = await loadState();
  const existing = visits.find((visit) => visit.route_customer_id === customerId);
  const visit = makeMcpVisit({
    ...(existing || {}),
    id: existing?.id || `mcp-visit-${today}-${customerId}`,
    route_id: route.id,
    route_customer_id: customerId,
    visit_date: today,
    status,
    has_order: status === 'order',
    has_test: status === 'test',
    note: statusNote[status] || ''
  });
  await putLocal(LOCAL_STORES.mcpVisits, visit);
  await render();
  toast(statusLabel[status] ? `Đã cập nhật: ${statusLabel[status]}` : 'Đã cập nhật trạng thái.');
}

function boot() {
  css();
  page();
  render().catch((error) => {
    console.warn('mcp render failed', error);
    toast('Không mở được dữ liệu MCP local.');
  });
}

document.addEventListener('click', (event) => {
  const filter = event.target.closest('[data-mcp-filter]');
  if (filter) {
    event.preventDefault();
    activeFilter = filter.dataset.mcpFilter || 'all';
    render();
    return;
  }
  if (event.target.closest('[data-mcp-add-customer]')) {
    event.preventDefault();
    openCustomerModal();
    return;
  }
  const statusButton = event.target.closest('[data-mcp-status]');
  if (statusButton) {
    event.preventDefault();
    setVisitStatus(statusButton.dataset.customerId, statusButton.dataset.mcpStatus);
  }
}, true);

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-customer-form]')) return;
  saveCustomer(event);
});

boot();
window.addEventListener('DOMContentLoaded', boot);
