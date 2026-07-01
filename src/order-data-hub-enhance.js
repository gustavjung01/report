import { todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal } from '../local-db.js';

const money = new Intl.NumberFormat('vi-VN');

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function activeOrder(order = {}) {
  return !['cancelled', 'deleted'].includes(String(order.status || '').trim()) && !order.deleted_at && !order.raw_payload?.deleted_at;
}

function formatMoney(value = 0) {
  const amount = Number(value || 0);
  return amount ? `${money.format(amount)}đ` : '0đ';
}

async function enhanceOrderDataHub() {
  const shell = document.querySelector('#dataShell.active');
  const activeOrderTab = document.querySelector('#dataHub [data-data-view="order"].active');
  if (!shell || !activeOrderTab) return;
  const orders = await getAllLocal(LOCAL_STORES.orders);
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const today = todayIsoDate();
  const todayActiveOrders = orders.filter((order) => activeOrder(order) && order.order_date === today);
  const todayRevenue = todayActiveOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const pending = orders.filter((order) => activeOrder(order) && (order.status === 'draft' || order.status === 'pending_confirm')).length;
  const kpis = shell.querySelectorAll('.data-shell-kpi b');
  if (kpis[0]) kpis[0].textContent = String(todayActiveOrders.length);
  if (kpis[1]) kpis[1].textContent = formatMoney(todayRevenue);
  if (kpis[2]) kpis[2].textContent = String(pending);

  if (!shell.querySelector('[data-order-export-list]')) {
    const note = shell.querySelector('.data-shell-note');
    note?.insertAdjacentHTML('afterend', '<div class="order-export-row"><button type="button" class="secondary" data-order-export-list>Xuất danh sách</button><button type="button" class="secondary" data-order-export-detail>Xuất chi tiết</button></div>');
  }

  const cards = [...shell.querySelectorAll('.data-shell-list > .data-shell-card[data-order-id]')];
  cards.forEach((card) => {
    const order = orderMap.get(card.dataset.orderId);
    if (!order) return;
    card.classList.toggle('order-cancelled', order.status === 'cancelled');
    if (!card.querySelector('.shell-actions')) card.insertAdjacentHTML('beforeend', '<div class="shell-actions"></div>');
    const actions = card.querySelector('.shell-actions');
    if (!actions.querySelector('[data-order-detail]')) actions.insertAdjacentHTML('beforeend', `<button type="button" class="primary-lite" data-order-detail="${esc(order.id)}">Chi tiết</button>`);
    if (!actions.querySelector('[data-order-export-slip]')) actions.insertAdjacentHTML('beforeend', `<button type="button" data-order-export-slip="${esc(order.id)}">Xuất</button>`);
    if (order.status !== 'cancelled' && !actions.querySelector('[data-order-cancel]')) actions.insertAdjacentHTML('beforeend', `<button type="button" class="order-cancel-btn" data-order-cancel="${esc(order.id)}">Huỷ</button>`);
  });
}

let timer;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => enhanceOrderDataHub().catch((error) => console.warn('order data hub enhance failed', error)), 180);
}

document.addEventListener('click', schedule, true);
window.addEventListener('order:changed', schedule);
window.addEventListener('DOMContentLoaded', schedule);
schedule();
setInterval(schedule, 1500);
