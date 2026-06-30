import { LOCAL_STORES, getAllLocal, getLocal, putLocal } from '../local-db.js';

const money = new Intl.NumberFormat('vi-VN');
const statusLabel = { draft: 'Nháp', pending_confirm: 'Chờ xác nhận', confirmed: 'Đã chốt', delivering: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã huỷ' };

function text(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

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

function stamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
}

function csvCell(value = '') {
  return `"${text(value).replace(/"/g, '""')}"`;
}

function downloadText(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function saveCsv(filename, rows) {
  downloadText(filename, `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`, 'text/csv;charset=utf-8');
}

async function loadOrders() {
  const [orders, items] = await Promise.all([getAllLocal(LOCAL_STORES.orders), getAllLocal(LOCAL_STORES.orderItems)]);
  return { orders: orders.slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''))), items };
}

function itemsOf(orderId, items = []) {
  return items.filter((item) => item.order_id === orderId);
}

function orderCode(order = {}) {
  return order.order_code || order.id || '';
}

function formatMoney(value = 0) {
  const amount = number(value);
  return amount ? `${money.format(amount)}đ` : '0đ';
}

async function cancelOrder(orderId = '') {
  const order = await getLocal(LOCAL_STORES.orders, orderId);
  if (!order) return toast('Không tìm thấy đơn.');
  if (order.status === 'cancelled') return toast('Đơn này đã huỷ rồi.');
  const ok = window.confirm(`Huỷ đơn của ${order.customer_name || 'khách này'}?\nĐơn chỉ chuyển trạng thái cancelled, không xoá khỏi máy.`);
  if (!ok) return;
  await putLocal(LOCAL_STORES.orders, {
    ...order,
    status: 'cancelled',
    sync_status: 'local',
    updated_at: new Date().toISOString(),
    raw_payload: { ...(order.raw_payload || {}), cancelled_at: new Date().toISOString(), cancel_source: 'local_ui' }
  });
  window.dispatchEvent(new CustomEvent('order:changed'));
  toast('Đã huỷ đơn. Doanh thu sẽ không tính đơn này.');
}

async function exportOrderList() {
  const { orders } = await loadOrders();
  const rows = [['Mã đơn', 'Ngày', 'Khách hàng', 'SĐT', 'Khu vực', 'Địa chỉ', 'Sales', 'Trạng thái', 'Tạm tính', 'Tổng tiền', 'Nguồn', 'Ghi chú'], ...orders.map((order) => [orderCode(order), order.order_date, order.customer_name, order.customer_phone, order.area, order.delivery_address, order.sales, statusLabel[order.status] || order.status, order.subtotal, order.grand_total, order.source_type, order.note])];
  saveCsv(`don-hang-danh-sach-${stamp()}.csv`, rows);
  toast(`Đã xuất ${orders.length} đơn.`);
}

async function exportOrderDetail() {
  const { orders, items } = await loadOrders();
  const map = new Map(orders.map((order) => [order.id, order]));
  const rows = [['Mã đơn', 'Ngày', 'Khách hàng', 'SĐT', 'Khu vực', 'Sales', 'Trạng thái', 'SKU', 'Sản phẩm', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Ghi chú dòng'], ...items.map((item) => {
    const order = map.get(item.order_id) || {};
    return [orderCode(order), order.order_date, order.customer_name, order.customer_phone, order.area, order.sales, statusLabel[order.status] || order.status, item.sku, item.product_name, item.unit, item.quantity, item.unit_price, item.line_total, item.note];
  })];
  saveCsv(`don-hang-chi-tiet-${stamp()}.csv`, rows);
  toast(`Đã xuất ${Math.max(rows.length - 1, 0)} dòng đơn.`);
}

async function exportOrderSlip(orderId = '') {
  const { orders, items } = await loadOrders();
  const order = orders.find((row) => row.id === orderId);
  if (!order) return toast('Không tìm thấy đơn.');
  const lines = itemsOf(order.id, items);
  const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu đơn ${esc(orderCode(order))}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#111}h1{font-size:22px;margin:0 0 8px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px}th{background:#f4f7f6}.total{text-align:right;font-weight:bold;font-size:18px;margin-top:16px}.muted{color:#666;font-size:13px}</style></head><body><h1>Phiếu đơn hàng</h1><div class="muted">Mã đơn: ${esc(orderCode(order))} · Ngày: ${esc(order.order_date || '')} · Trạng thái: ${esc(statusLabel[order.status] || order.status || '')}</div><h2>${esc(order.customer_name || 'Khách lẻ')}</h2><div>SĐT: ${esc(order.customer_phone || '')}</div><div>Khu vực: ${esc(order.area || '')}</div><div>Địa chỉ: ${esc(order.delivery_address || '')}</div><table><thead><tr><th>SKU</th><th>Sản phẩm</th><th>ĐVT</th><th>SL</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead><tbody>${lines.map((line) => `<tr><td>${esc(line.sku || '')}</td><td>${esc(line.product_name || '')}</td><td>${esc(line.unit || '')}</td><td>${esc(line.quantity || '')}</td><td>${esc(formatMoney(line.unit_price))}</td><td>${esc(formatMoney(line.line_total))}</td></tr>`).join('')}</tbody></table><div class="total">Tổng: ${esc(formatMoney(order.grand_total))}</div>${order.note ? `<p>Ghi chú: ${esc(order.note)}</p>` : ''}</body></html>`;
  downloadText(`phieu-don-${text(order.customer_name || order.id).replace(/[^\p{L}\p{N}]+/gu, '-')}-${stamp()}.html`, html, 'text/html;charset=utf-8');
  toast('Đã xuất phiếu đơn HTML.');
}

function installStyle() {
  let style = document.querySelector('style[data-order-manage-actions]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderManageActions = '1';
    document.head.appendChild(style);
  }
  style.textContent = `.order-export-row{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important}.order-cancel-btn{border-color:#fecaca!important;background:#fff7f7!important;color:#b91c1c!important}.order-cancelled{opacity:.72!important}.order-cancelled .shell-badge{background:#fee2e2!important;color:#b91c1c!important}`;
}

function enhanceCards() {
  document.querySelectorAll('[data-order-id]').forEach((card) => {
    if (card.dataset.orderActionsReady) return;
    card.dataset.orderActionsReady = '1';
    const orderId = card.dataset.orderId;
    const statusText = card.textContent || '';
    const actions = card.querySelector('.shell-actions') || card.appendChild(document.createElement('div'));
    actions.classList.add('shell-actions');
    if (!actions.querySelector('[data-order-export-slip]')) actions.insertAdjacentHTML('beforeend', `<button type="button" data-order-export-slip="${esc(orderId)}">Xuất</button>`);
    if (!/cancelled|Đã huỷ/i.test(statusText) && !actions.querySelector('[data-order-cancel]')) actions.insertAdjacentHTML('beforeend', `<button type="button" class="order-cancel-btn" data-order-cancel="${esc(orderId)}">Huỷ</button>`);
  });
}

document.addEventListener('click', (event) => {
  const cancel = event.target.closest('[data-order-cancel]');
  if (cancel) { event.preventDefault(); cancelOrder(cancel.dataset.orderCancel); return; }
  if (event.target.closest('[data-order-export-list]')) { event.preventDefault(); exportOrderList(); return; }
  if (event.target.closest('[data-order-export-detail]')) { event.preventDefault(); exportOrderDetail(); return; }
  const slip = event.target.closest('[data-order-export-slip]');
  if (slip) { event.preventDefault(); exportOrderSlip(slip.dataset.orderExportSlip); }
}, true);

window.addEventListener('order:changed', () => setTimeout(enhanceCards, 100));
window.addEventListener('DOMContentLoaded', () => { installStyle(); enhanceCards(); });
installStyle();
setInterval(enhanceCards, 1200);
