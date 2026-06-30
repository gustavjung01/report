import { LOCAL_STORES, getAllLocal } from '../local-db.js';

const money = new Intl.NumberFormat('vi-VN');
const statusLabel = { draft: 'Nháp', pending_confirm: 'Chờ xác nhận', confirmed: 'Đã chốt', delivering: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã huỷ' };

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function formatMoney(value = 0) {
  const amount = Number(value || 0);
  return amount ? `${money.format(amount)}đ` : '0đ';
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function installStyle() {
  let style = document.querySelector('style[data-order-detail-enhance]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderDetailEnhance = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    .order-detail-modal{padding:13px!important;gap:10px!important;max-height:calc(100dvh - 26px)!important;overflow:auto!important}
    .order-detail-top{display:flex!important;justify-content:space-between!important;gap:10px!important;align-items:flex-start!important}
    .order-detail-top h2{font-size:18px!important;line-height:1.1!important;margin:0!important}
    .order-detail-badge{border-radius:999px!important;padding:5px 8px!important;font-size:10.5px!important;font-weight:950!important;background:#e7f9eb!important;color:#167c32!important;white-space:nowrap!important}
    .order-detail-badge.cancelled{background:#fee2e2!important;color:#b91c1c!important}
    .order-detail-total{border:1px solid #dce8e5!important;border-radius:16px!important;background:linear-gradient(135deg,#fff7ed,#fff)!important;padding:10px!important;display:grid!important;gap:4px!important}
    .order-detail-total b{font-size:22px!important;color:#b95f00!important;line-height:1!important}.order-detail-total small{font-size:11px!important;color:#63727c!important;font-weight:750!important}
    .order-detail-info{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important}.order-detail-info p{margin:0!important;border:1px solid #dce8e5!important;border-radius:13px!important;background:#fbfffd!important;padding:7px!important;font-size:11px!important;color:#63727c!important;line-height:1.18!important}.order-detail-info b{display:block!important;color:#082337!important;font-size:12px!important;margin-bottom:2px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .order-detail-lines{display:grid!important;gap:7px!important}.order-detail-line{border:1px solid #dce8e5!important;border-radius:14px!important;background:#fff!important;padding:9px!important}.order-detail-line b{display:block!important;font-size:13px!important;line-height:1.15!important}.order-detail-line small{display:block!important;margin-top:4px!important;color:#63727c!important;font-size:11px!important;line-height:1.2!important}.order-detail-line-total{margin-top:6px!important;font-size:13px!important;font-weight:950!important;color:#007866!important;text-align:right!important}
    .order-detail-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;position:sticky!important;bottom:-13px!important;background:#fff!important;padding-top:8px!important;border-top:1px solid #eef3f1!important}.order-detail-actions button{min-height:38px!important;border-radius:11px!important;font-size:11.5px!important;font-weight:950!important}.order-detail-actions .order-cancel-btn{border:1px solid #fecaca!important;background:#fff7f7!important;color:#b91c1c!important}.order-detail-actions .primary-lite{border:1px solid #9bdccd!important;background:#eefbf6!important;color:#007866!important}
    @media(max-width:380px){.order-detail-modal{padding:11px!important}.order-detail-info{grid-template-columns:1fr!important}.order-detail-actions button{font-size:10.5px!important;min-height:36px!important}}
  `;
}

async function loadOrder(orderId = '') {
  const [orders, items] = await Promise.all([getAllLocal(LOCAL_STORES.orders), getAllLocal(LOCAL_STORES.orderItems)]);
  const order = orders.find((row) => row.id === orderId);
  return { order, lines: items.filter((item) => item.order_id === orderId) };
}

function infoBlock(label, value) {
  return `<p><b>${esc(label)}</b>${esc(value || '-')}</p>`;
}

async function openEnhancedOrderDetail(orderId = '') {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  const { order, lines } = await loadOrder(orderId);
  if (!order) return toast('Không tìm thấy đơn.');
  const isCancelled = order.status === 'cancelled';
  const status = statusLabel[order.status] || order.status || 'Nháp';
  const mcp = order.raw_payload?.mcp_route_name || order.raw_payload?.mcp_session_id || '';
  const geo = order.raw_payload?.google_maps_url || order.raw_payload?.geo_text || '';
  dialog.dataset.type = 'order-detail';
  dialog.dataset.orderId = order.id;
  dialog.innerHTML = `<div class="modal order-detail-modal" data-order-detail-modal="${esc(order.id)}">
    <header class="order-detail-top"><div><h2>${esc(order.customer_name || 'Đơn hàng')}</h2><small>${esc(order.order_code || order.id || '')}</small></div><button type="button" data-close>Đóng</button></header>
    <div class="order-detail-total"><div><span class="order-detail-badge ${isCancelled ? 'cancelled' : ''}">${esc(status)}</span></div><b>${esc(formatMoney(order.grand_total))}</b><small>${esc(order.order_date || '')}${order.sales ? ` · Sales: ${esc(order.sales)}` : ''}${isCancelled ? ' · Đơn huỷ không tính doanh thu' : ''}</small></div>
    <section class="order-detail-info">${infoBlock('SĐT', order.customer_phone)}${infoBlock('Khu vực', order.area)}${infoBlock('Địa chỉ', order.delivery_address)}${infoBlock('Nguồn', mcp ? `MCP · ${mcp}` : (order.source_type || 'manual'))}${geo ? infoBlock('Định vị', geo) : ''}${order.note ? infoBlock('Ghi chú', order.note) : ''}</section>
    <section class="order-detail-lines">${lines.map((line) => `<article class="order-detail-line"><b>${esc(line.product_name || 'Sản phẩm')}</b><small>${line.sku ? `SKU ${esc(line.sku)} · ` : ''}${esc(line.unit || '')} · SL ${esc(line.quantity)} · Giá ${esc(formatMoney(line.unit_price))}</small><div class="order-detail-line-total">${esc(formatMoney(line.line_total))}</div></article>`).join('') || '<p class="data-shell-note">Chưa có sản phẩm.</p>'}</section>
    <div class="order-detail-actions"><button type="button" class="primary-lite" data-order-export-slip="${esc(order.id)}">Xuất phiếu</button><button type="button" data-order-repeat="${esc(order.id)}">Tạo lại</button>${isCancelled ? '<button type="button" disabled>Đã huỷ</button>' : `<button type="button" class="order-cancel-btn" data-order-cancel="${esc(order.id)}">Huỷ đơn</button>`}</div>
  </div>`;
  if (!dialog.open) dialog.showModal();
}

installStyle();

document.addEventListener('click', (event) => {
  const detail = event.target.closest('[data-order-detail]');
  if (!detail) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const orderId = detail.dataset.orderDetail || detail.getAttribute('data-order-detail');
  openEnhancedOrderDetail(orderId).catch((error) => {
    console.warn('enhanced order detail failed', error);
    toast('Không mở được chi tiết đơn.');
  });
}, true);

window.addEventListener('DOMContentLoaded', installStyle);
