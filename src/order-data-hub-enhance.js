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

function installOrderFilterLayout() {
  let style = document.querySelector('style[data-order-filter-layout]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderFilterLayout = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="data"] #dataShell.active{
      display:block!important;
      min-height:0!important;
      max-height:calc(100dvh - 178px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      -webkit-overflow-scrolling:touch!important;
      overscroll-behavior:contain!important;
      padding:0 2px calc(92px + env(safe-area-inset-bottom)) 0!important;
      position:relative!important;
    }
    section.page[data-page="data"] #dataShell.active>*{position:relative!important;float:none!important;clear:both!important}
    section.page[data-page="data"] .order-export-row{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;position:relative!important;z-index:1!important;margin:8px 0!important;float:none!important;clear:both!important}
    section.page[data-page="data"] .order-export-row button{min-height:34px!important;border-radius:12px!important;font-size:11px!important;font-weight:900!important}
    section.page[data-page="data"] .order-filter-card{position:relative!important;z-index:1!important;display:block!important;width:100%!important;margin:8px 0 10px!important;padding:10px!important;overflow:visible!important;float:none!important;clear:both!important;transform:none!important}
    section.page[data-page="data"] .order-filter-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;align-items:start!important;position:relative!important;z-index:1!important;float:none!important;clear:both!important}
    section.page[data-page="data"] .order-filter-grid label{display:grid!important;gap:4px!important;min-width:0!important;margin:0!important;position:relative!important;z-index:1!important;float:none!important;clear:none!important}
    section.page[data-page="data"] .order-filter-grid label:nth-child(2){grid-column:auto!important}
    section.page[data-page="data"] .order-filter-grid label:nth-child(3){grid-column:1/-1!important}
    section.page[data-page="data"] .order-filter-grid input,section.page[data-page="data"] .order-filter-grid select{display:block!important;width:100%!important;min-width:0!important;min-height:38px!important;box-sizing:border-box!important;position:relative!important;z-index:1!important}
    section.page[data-page="data"] .order-filter-actions{position:relative!important;z-index:1!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin-top:8px!important;clear:both!important;float:none!important}
    section.page[data-page="data"] .order-filter-summary{display:block!important;position:relative!important;z-index:1!important;margin-top:8px!important;clear:both!important;float:none!important}
    section.page[data-page="data"] .data-shell-list{position:relative!important;z-index:0!important;display:grid!important;grid-template-columns:1fr!important;gap:8px!important;clear:both!important;float:none!important;margin-top:0!important;padding-top:0!important;overflow:visible!important}
    section.page[data-page="data"] .data-shell-list>.data-shell-card{position:relative!important;z-index:0!important;float:none!important;clear:both!important;margin:0!important;transform:none!important}
    @media(max-width:430px){
      section.page[data-page="data"] #dataShell.active{max-height:calc(100dvh - 166px)!important}
      section.page[data-page="data"] .order-filter-card{padding:9px!important;margin:8px 0 10px!important}
      section.page[data-page="data"] .order-filter-grid{grid-template-columns:1fr!important;gap:7px!important}
      section.page[data-page="data"] .order-filter-grid label{grid-column:1/-1!important}
      section.page[data-page="data"] .order-filter-actions{grid-template-columns:1fr 1fr!important;gap:7px!important}
    }
  `;
}

async function enhanceOrderDataHub() {
  installOrderFilterLayout();
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

installOrderFilterLayout();
document.addEventListener('click', schedule, true);
window.addEventListener('order:changed', schedule);
window.addEventListener('DOMContentLoaded', schedule);
schedule();
setInterval(schedule, 1800);
