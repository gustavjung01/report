import { todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal } from '../local-db.js';

const dataTabs = [['mcp', '🧭', 'MCP'], ['order', '🛒', 'Đơn'], ['test', '🧪', 'Test'], ['report', '📊', 'Báo cáo']];
const mock = { report: [['6', 'Báo cáo'], ['4', 'Đối thủ'], ['2', 'Cơ hội']] };
const statusLabel = { todo: 'Chưa ghé', done: 'Đã ghé', order: 'Có đơn', test: 'Có test', no: 'Không mua' };
const money = new Intl.NumberFormat('vi-VN');
let active = 'test';

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function css() { /* Shell styles are preloaded from polish.css to avoid first-load reflow. */ }

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount ? `${money.format(amount)}đ` : '0đ';
}

function visitStatus(customer, visits) {
  const visit = visits.find((row) => row.route_customer_id === customer.id);
  if (!visit) return 'todo';
  if (visit.status === 'order' || visit.has_order) return 'order';
  if (visit.status === 'test' || visit.has_test) return 'test';
  return visit.status || 'done';
}

async function renderMcpShell(shell) {
  const [routes, customers, visits] = await Promise.all([
    getAllLocal(LOCAL_STORES.mcpRoutes),
    getAllLocal(LOCAL_STORES.mcpRouteCustomers),
    getAllLocal(LOCAL_STORES.mcpVisits)
  ]);
  const route = routes.find((row) => row.active !== false) || null;
  const today = todayIsoDate();
  const routeCustomers = route ? customers.filter((row) => row.route_id === route.id && row.active !== false) : [];
  const todayVisits = route ? visits.filter((row) => row.route_id === route.id && row.visit_date === today) : [];
  const done = routeCustomers.filter((customer) => visitStatus(customer, todayVisits) !== 'todo').length;
  const order = routeCustomers.filter((customer) => visitStatus(customer, todayVisits) === 'order').length;
  const cards = routeCustomers
    .slice()
    .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0))
    .map((customer) => {
      const status = visitStatus(customer, todayVisits);
      return `<article class="data-shell-card"><h3>${esc(customer.customer_name)}</h3><small>${esc(statusLabel[status] || status)} · ${esc(customer.area || route?.area || '')}</small></article>`;
    }).join('') || '<p class="data-shell-note">Chưa có khách MCP. Vào Home → MCP tuyến → + Khách để thêm.</p>';
  shell.innerHTML = `<div class="data-shell-kpis"><div class="data-shell-kpi"><b>${routeCustomers.length}</b><span>Khách tuyến</span></div><div class="data-shell-kpi"><b>${done}</b><span>Đã ghé</span></div><div class="data-shell-kpi"><b>${order}</b><span>Có đơn</span></div></div><p class="data-shell-note">${esc(route ? `${route.route_name} · ${route.area || 'Chưa đặt khu vực'}` : 'Chưa có tuyến MCP.')}</p><div class="data-shell-list">${cards}</div>`;
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

function ensure() {
  css();
  const page = document.querySelector('[data-page="data"]');
  const list = document.querySelector('#dataList');
  if (!page || !list) return;
  const h = page.querySelector('h1');
  if (h) h.hidden = true;
  let hub = document.querySelector('#dataHub');
  if (!hub) {
    hub = document.createElement('div');
    hub.id = 'dataHub';
    hub.className = 'data-hub';
    hub.innerHTML = '<div class="data-hub-tabs">' + dataTabs.map((item) => '<button type="button" class="data-hub-tab" data-data-view="' + item[0] + '"><i>' + item[1] + '</i><span>' + item[2] + '</span></button>').join('') + '</div><div id="dataShell" class="data-shell"></div>';
    list.parentNode.insertBefore(hub, list);
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
  document.querySelectorAll('#dataHub [data-data-view]').forEach((button) => button.classList.toggle('active', button.dataset.dataView === active));
  const list = document.querySelector('#dataList');
  const shell = document.querySelector('#dataShell');
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
  const k = mock[active] || [];
  shell.innerHTML = '<div class="data-shell-kpis">' + k.map((item) => '<div class="data-shell-kpi"><b>' + item[0] + '</b><span>' + item[1] + '</span></div>').join('') + '</div><p class="data-shell-note">UI shell tham khảo, chưa nối dữ liệu thật.</p><div class="data-shell-list"><article class="data-shell-card"><h3>Dữ liệu ' + active + '</h3><small>Danh sách mẫu, chưa ghi dữ liệu thật.</small></article></div>';
}

document.addEventListener('click', (event) => {
  const button = event.target.closest('#dataHub [data-data-view]');
  if (!button) return;
  event.preventDefault();
  apply(button.dataset.dataView);
}, true);

ensure();
window.addEventListener('DOMContentLoaded', ensure);
