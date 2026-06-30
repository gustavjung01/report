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
  const orderCodeText = orderCode(order);
  const statusText = statusLabel[order.status] || order.status || 'Nháp';
  const subtotal = number(order.subtotal || order.grand_total || 0);
  const discount = number(order.discount_total || 0);
  const shipping = number(order.shipping_fee || order.raw_payload?.shipping_fee || 0);
  const grandTotal = number(order.grand_total || subtotal - discount + shipping || 0);
  const sourceText = order.raw_payload?.mcp_route_name ? `MCP · ${order.raw_payload.mcp_route_name}` : (order.source_type || 'manual');
  const isCancelled = order.status === 'cancelled';

  const rowsHtml = lines.map((line, index) => `
    <tr>
      <td class="center">${index + 1}</td>
      <td><div class="product-name">${esc(line.product_name || 'Sản phẩm')}</div>${line.sku ? `<div class="muted small">SKU: ${esc(line.sku)}</div>` : ''}</td>
      <td class="center">${esc(line.unit || '')}</td>
      <td class="right">${esc(line.quantity || '')}</td>
      <td class="right">${esc(formatMoney(line.unit_price))}</td>
      <td class="right strong">${esc(formatMoney(line.line_total))}</td>
    </tr>`).join('');

  const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Phiếu đơn ${esc(orderCodeText)}</title>
  <style>
    @page{size:A5 portrait;margin:10mm}*{box-sizing:border-box}html,body{margin:0;padding:0;background:#eef3f1;color:#0f1720;font-family:Arial,Helvetica,sans-serif}body{padding:16px}.toolbar{width:148mm;margin:0 auto 10px;display:flex;gap:8px;justify-content:flex-end}.toolbar button{border:1px solid #cfe1db;background:#fff;color:#0f1720;border-radius:10px;padding:8px 12px;font-size:12px;font-weight:800;cursor:pointer}.toolbar .primary{background:#0f8f7a;border-color:#0f8f7a;color:#fff}.sheet{width:148mm;min-height:210mm;margin:0 auto;background:#fff;box-shadow:0 8px 30px rgba(0,0,0,.08);padding:10mm;position:relative}.header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;border-bottom:2px solid #d9e6e1;padding-bottom:10px;margin-bottom:12px}.brand{max-width:52%}.brand-title{font-size:18px;font-weight:900;color:#0b3b35;line-height:1.2;margin-bottom:4px}.brand-sub{font-size:11px;color:#5a6a73;line-height:1.45}.doc-head{text-align:right;max-width:46%}.doc-title{font-size:22px;font-weight:900;letter-spacing:.3px;color:#082337;margin:0 0 6px}.doc-meta{font-size:11px;color:#44525a;line-height:1.5}.badge{display:inline-block;margin-top:5px;padding:4px 9px;border-radius:999px;font-size:10px;font-weight:900;background:#e9f8f4;color:#0f8f7a;border:1px solid #cdece4}.badge.cancelled{background:#fee2e2;color:#b91c1c;border-color:#fecaca}.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px}.box{border:1px solid #d9e6e1;border-radius:12px;padding:10px;background:#fcfefd}.box-title{font-size:11px;font-weight:900;color:#0f8f7a;text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px}.info-row{margin-bottom:6px;font-size:12px;line-height:1.35;color:#26343c}.info-row:last-child{margin-bottom:0}.info-row b{display:inline-block;min-width:72px;color:#082337}table{width:100%;border-collapse:collapse;margin-top:4px}thead th{background:#f3f8f6;color:#16323e;font-size:11px;font-weight:900;padding:8px 7px;border:1px solid #d9e6e1;text-align:left}tbody td{border:1px solid #d9e6e1;padding:8px 7px;font-size:12px;vertical-align:top}.center{text-align:center}.right{text-align:right}.strong{font-weight:900}.product-name{font-weight:800;color:#082337;line-height:1.3}.muted{color:#61717a}.small{font-size:10px}.totals-wrap{display:flex;justify-content:flex-end;margin:10px 0 12px}.totals{width:68mm;border:1px solid #d9e6e1;border-radius:12px;padding:10px;background:#fcfefd}.total-row{display:flex;justify-content:space-between;gap:10px;font-size:12px;line-height:1.5;margin-bottom:5px;color:#27343c}.total-row:last-child{margin-bottom:0}.total-row.grand{margin-top:6px;padding-top:7px;border-top:1px dashed #c9d8d2;font-size:15px;font-weight:900;color:#082337}.note-box{border:1px solid #d9e6e1;border-radius:12px;padding:10px;background:#fcfefd;margin-bottom:12px;min-height:46px}.note-box .box-title{margin-bottom:6px}.note-content{font-size:12px;line-height:1.45;color:#2b3840;white-space:pre-wrap}.sign-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px}.sign-box{border-top:1px dashed #d3dfda;padding-top:8px;text-align:center;min-height:60px}.sign-title{font-size:12px;font-weight:900;color:#082337;margin-bottom:5px}.sign-sub{font-size:10px;color:#66757e}.footer{margin-top:12px;text-align:center;font-size:10px;color:#7a878f}@media print{body{background:#fff;padding:0}.toolbar{display:none!important}.sheet{width:auto;min-height:auto;margin:0;box-shadow:none;padding:0}}
  </style>
</head>
<body>
  <div class="toolbar"><button onclick="window.close()">Đóng</button><button class="primary" onclick="window.print()">In / Lưu PDF</button></div>
  <div class="sheet">
    <div class="header"><div class="brand"><div class="brand-title">Bếp Sỉ Báo Cáo</div><div class="brand-sub">Phiếu xuất xem nhanh / in đơn hàng<br>Sales thị trường · đơn hàng · báo cáo</div></div><div class="doc-head"><div class="doc-title">PHIẾU ĐƠN HÀNG</div><div class="doc-meta"><div><b>Mã đơn:</b> ${esc(orderCodeText)}</div><div><b>Ngày:</b> ${esc(order.order_date || '')}</div></div><div class="badge ${isCancelled ? 'cancelled' : ''}">${esc(statusText)}</div></div></div>
    <div class="info-grid"><div class="box"><div class="box-title">Thông tin khách hàng</div><div class="info-row"><b>Khách:</b> ${esc(order.customer_name || 'Khách lẻ')}</div><div class="info-row"><b>SĐT:</b> ${esc(order.customer_phone || '-')}</div><div class="info-row"><b>Khu vực:</b> ${esc(order.area || '-')}</div><div class="info-row"><b>Địa chỉ:</b> ${esc(order.delivery_address || '-')}</div></div><div class="box"><div class="box-title">Thông tin đơn hàng</div><div class="info-row"><b>Sales:</b> ${esc(order.sales || '-')}</div><div class="info-row"><b>Nguồn:</b> ${esc(sourceText)}</div><div class="info-row"><b>Số dòng:</b> ${esc(lines.length)}</div><div class="info-row"><b>Trạng thái:</b> ${esc(statusText)}</div></div></div>
    <table><thead><tr><th style="width:28px">STT</th><th>Sản phẩm</th><th style="width:52px">ĐVT</th><th style="width:42px" class="right">SL</th><th style="width:78px" class="right">Đơn giá</th><th style="width:86px" class="right">Thành tiền</th></tr></thead><tbody>${rowsHtml || '<tr><td colspan="6" class="center muted">Chưa có sản phẩm.</td></tr>'}</tbody></table>
    <div class="totals-wrap"><div class="totals"><div class="total-row"><span>Tạm tính</span><b>${esc(formatMoney(subtotal))}</b></div><div class="total-row"><span>Giảm giá</span><b>${esc(formatMoney(discount))}</b></div><div class="total-row"><span>Phí giao hàng</span><b>${esc(formatMoney(shipping))}</b></div><div class="total-row grand"><span>Tổng thanh toán</span><span>${esc(formatMoney(grandTotal))}</span></div></div></div>
    <div class="note-box"><div class="box-title">Ghi chú</div><div class="note-content">${esc(order.note || 'Không có ghi chú.')}</div></div>
    <div class="sign-grid"><div class="sign-box"><div class="sign-title">Người lập phiếu</div><div class="sign-sub">(Ký, ghi rõ họ tên)</div></div><div class="sign-box"><div class="sign-title">Khách nhận hàng</div><div class="sign-sub">(Ký, ghi rõ họ tên)</div></div></div>
    <div class="footer">Phiếu được tạo từ ứng dụng Bếp Sỉ Báo Cáo</div>
  </div>
</body>
</html>`;

  downloadText(`phieu-don-a5-${text(order.customer_name || order.id).replace(/[^\p{L}\p{N}]+/gu, '-')}-${stamp()}.html`, html, 'text/html;charset=utf-8');
  toast('Đã xuất phiếu đơn A5 dọc.');
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
