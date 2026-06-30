import { LOCAL_STORES, getAllLocal } from '../local-db.js';

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

async function enhanceOrderDataHub() {
  const shell = document.querySelector('#dataShell.active');
  const activeOrder = document.querySelector('#dataHub [data-data-view="order"].active');
  if (!shell || !activeOrder) return;
  const [orders] = await Promise.all([getAllLocal(LOCAL_STORES.orders)]);
  const sorted = orders.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));

  if (!shell.querySelector('[data-order-export-list]')) {
    const note = shell.querySelector('.data-shell-note');
    note?.insertAdjacentHTML('afterend', '<div class="order-export-row"><button type="button" class="secondary" data-order-export-list>Xuất danh sách</button><button type="button" class="secondary" data-order-export-detail>Xuất chi tiết</button></div>');
  }

  const cards = [...shell.querySelectorAll('.data-shell-list > .data-shell-card')];
  cards.forEach((card, index) => {
    const order = sorted[index];
    if (!order || card.dataset.orderId) return;
    card.dataset.orderId = order.id;
    if (order.status === 'cancelled') card.classList.add('order-cancelled');
    if (!card.querySelector('.shell-actions')) card.insertAdjacentHTML('beforeend', '<div class="shell-actions"></div>');
    const actions = card.querySelector('.shell-actions');
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
