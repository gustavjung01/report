import { makeOrder, makeOrderItem, todayIsoDate, uid } from '../data-model.js';
import { LOCAL_STORES, putLocal, putManyLocal } from '../local-db.js';
import { getActiveMcpSessionDetail, upsertMcpVisitForSession } from './mcp-core.js';

const currency = new Intl.NumberFormat('vi-VN');

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

function formatMoney(value) {
  const amount = Number(value || 0);
  return amount ? `${currency.format(amount)}đ` : '0đ';
}

function mountMcpOrderBridgeStyle() {
  let style = document.querySelector('style[data-mcp-order-bridge]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpOrderBridge = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] [data-mcp-create-order]{border-color:#ffd8a8!important;background:#fff8ef!important;color:#b95f00!important}
    #modal[data-type="mcp-order"] .modal{max-height:calc(100dvh - 26px);overflow:auto}
    #modal[data-type="mcp-order"] .mcp-order-source{border:1px solid #ffd8a8;border-radius:14px;background:#fff8ef;padding:10px;color:#7b3f00;font-size:12px;line-height:1.35}
    #modal[data-type="mcp-order"] .mcp-order-line{display:grid;grid-template-columns:minmax(0,1.35fr) 54px 78px 34px;gap:6px;align-items:center}
    #modal[data-type="mcp-order"] .mcp-order-line input{min-width:0}
    #modal[data-type="mcp-order"] .mcp-order-line .secondary{min-height:34px;padding:0!important}
    #modal[data-type="mcp-order"] .total{position:sticky;bottom:-1px;background:#fff;border:1px solid #dce8e5;border-radius:14px;padding:10px;color:#17343d}
    @media(max-width:380px){#modal[data-type="mcp-order"] .mcp-order-line{grid-template-columns:minmax(0,1fr) 46px 68px 32px;gap:5px}}
  `;
}

function ensureMcpOrderButtons() {
  const section = document.querySelector('section.page[data-page="mcp"]');
  if (!section) return;
  section.querySelectorAll('.mcp-customer[data-customer-id]').forEach((card) => {
    if (card.querySelector('[data-mcp-create-order]')) return;
    const customerId = card.dataset.customerId || '';
    const target = card.querySelector('.mcp-manage-actions') || card.querySelector('.mcp-actions');
    if (!target || !customerId) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mcpCreateOrder = '1';
    button.dataset.customerId = customerId;
    button.textContent = '+ Đơn';
    target.appendChild(button);
  });
}

function productRow(name = '', quantity = 1, price = '') {
  return `<div class="mcp-order-line" data-mcp-order-line><input data-mcp-order-product placeholder="Sản phẩm" value="${esc(name)}"><input data-mcp-order-qty type="number" inputmode="numeric" min="1" value="${esc(quantity)}"><input data-mcp-order-price type="number" inputmode="numeric" min="0" placeholder="Giá" value="${esc(price)}"><button type="button" class="secondary" data-mcp-order-remove-line>×</button></div>`;
}

function readLines() {
  return [...document.querySelectorAll('[data-mcp-order-line]')].map((row) => {
    const quantity = Math.max(1, Number(row.querySelector('[data-mcp-order-qty]')?.value || 1));
    const unitPrice = Math.max(0, Number(row.querySelector('[data-mcp-order-price]')?.value || 0));
    return {
      product_name: row.querySelector('[data-mcp-order-product]')?.value.trim() || '',
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice
    };
  }).filter((line) => line.product_name);
}

function updateTotal() {
  const total = readLines().reduce((sum, line) => sum + line.line_total, 0);
  const element = document.querySelector('#mcpOrderTotal');
  if (element) element.innerHTML = `<b>Tổng: ${esc(formatMoney(total))}</b>`;
}

async function openMcpOrderModal(customerId) {
  const detail = await getActiveMcpSessionDetail();
  if (!detail?.session) return toast('Chọn phiên MCP trước khi tạo đơn.');
  const customer = detail.customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  const routeName = detail.route?.route_name || detail.session.route_name || 'Tuyến MCP';
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-order';
  dialog.innerHTML = `<form class="modal" data-mcp-order-form data-customer-id="${esc(customer.id)}"><header><h2>Tạo đơn từ MCP</h2><button type="button" data-close>Đóng</button></header><div class="form order-form"><div class="mcp-order-source"><b>🧭 ${esc(routeName)}</b><br><span>${esc(customer.customer_name)}${customer.area ? ` · ${esc(customer.area)}` : ''}</span></div><div class="grid"><label><span>Ngày</span><input id="mcpOrderDate" type="date" value="${esc(detail.session.session_date || todayIsoDate())}"></label><label><span>Sales</span><input id="mcpOrderSales" value="${esc(detail.session.sales || '')}"></label></div><div class="grid"><label><span>Khách</span><input id="mcpOrderCustomerName" required value="${esc(customer.customer_name || '')}"></label><label><span>SĐT</span><input id="mcpOrderCustomerPhone" inputmode="tel" value="${esc(customer.phone || '')}"></label></div><label><span>Khu vực</span><input id="mcpOrderArea" value="${esc(customer.area || detail.route?.area || detail.session.area || '')}"></label><label><span>Địa chỉ giao</span><input id="mcpOrderAddress" value="${esc(customer.address || '')}"></label><div class="line"><b>Sản phẩm</b><div id="mcpOrderLines">${productRow()}</div><button type="button" class="secondary wide" data-mcp-order-add-line>+ Thêm sản phẩm</button></div><label><span>Ghi chú giao hàng</span><textarea id="mcpOrderNote" rows="2"></textarea></label><div class="total" id="mcpOrderTotal"><b>Tổng: 0đ</b></div><button class="primary">Lưu đơn</button></div></form>`;
  if (!dialog.open) dialog.showModal();
  updateTotal();
  document.querySelector('[data-mcp-order-product]')?.focus();
}

async function saveMcpOrder(event) {
  event.preventDefault();
  const form = event.target.closest('[data-mcp-order-form]');
  const customerId = form?.dataset.customerId || '';
  const detail = await getActiveMcpSessionDetail();
  if (!detail?.session) return toast('Chọn phiên MCP trước khi lưu đơn.');
  const customer = detail.customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  const lines = readLines();
  const customerName = document.querySelector('#mcpOrderCustomerName')?.value.trim();
  if (!customerName) return toast('Nhập tên khách trước đã.');
  if (!lines.length) return toast('Thêm ít nhất 1 sản phẩm.');
  const total = lines.reduce((sum, line) => sum + line.line_total, 0);
  const visit = detail.visits.find((item) => item.route_customer_id === customer.id);
  const order = makeOrder({
    id: uid('order'),
    order_date: document.querySelector('#mcpOrderDate')?.value || detail.session.session_date || todayIsoDate(),
    sales: document.querySelector('#mcpOrderSales')?.value,
    customer_id: customer.id,
    customer_name: customerName,
    customer_phone: document.querySelector('#mcpOrderCustomerPhone')?.value,
    area: document.querySelector('#mcpOrderArea')?.value,
    delivery_address: document.querySelector('#mcpOrderAddress')?.value,
    source_type: 'mcp',
    source_id: customer.id,
    status: 'pending_confirm',
    subtotal: total,
    grand_total: total,
    note: document.querySelector('#mcpOrderNote')?.value,
    sync_status: 'local',
    raw_payload: { kind: 'order', route_customer_id: customer.id, mcp_session_id: detail.session.id, mcp_route_id: detail.session.route_id, mcp_visit_id: visit?.id || '', mcp_route_name: detail.route?.route_name || detail.session.route_name || '' }
  });
  const items = lines.map((line) => makeOrderItem({ ...line, id: uid('order-item'), order_id: order.id }));
  await putLocal(LOCAL_STORES.orders, order);
  await putManyLocal(LOCAL_STORES.orderItems, items);
  await upsertMcpVisitForSession({
    ...(visit || {}),
    id: visit?.id,
    session_id: detail.session.id,
    route_id: detail.session.route_id,
    route_customer_id: customer.id,
    visit_date: detail.session.session_date,
    status: 'order',
    has_order: true,
    has_test: visit?.has_test,
    has_report: visit?.has_report,
    order_id: order.id,
    note: 'Có đơn hàng'
  });
  document.querySelector('#modal')?.close();
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  toast('Đã lưu đơn từ MCP.');
}

function handleClick(event) {
  const button = event.target.closest('[data-mcp-create-order]');
  if (button && button.closest('section.page[data-page="mcp"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openMcpOrderModal(button.dataset.customerId || '').catch((error) => {
      console.warn('mcp order open failed', error);
      toast('Không mở được đơn từ MCP.');
    });
    return;
  }
  if (event.target.closest('[data-mcp-order-add-line]')) {
    event.preventDefault();
    document.querySelector('#mcpOrderLines')?.insertAdjacentHTML('beforeend', productRow());
    updateTotal();
    return;
  }
  const remove = event.target.closest('[data-mcp-order-remove-line]');
  if (remove) {
    event.preventDefault();
    const rows = document.querySelectorAll('[data-mcp-order-line]');
    if (rows.length > 1) remove.closest('[data-mcp-order-line]')?.remove();
    updateTotal();
  }
}

function boot() {
  mountMcpOrderBridgeStyle();
  ensureMcpOrderButtons();
}

window.addEventListener('click', handleClick, true);
document.addEventListener('input', (event) => {
  if (event.target.closest('#modal[data-type="mcp-order"] [data-mcp-order-line]')) updateTotal();
});
document.addEventListener('change', (event) => {
  if (event.target.closest('#modal[data-type="mcp-order"] [data-mcp-order-line]')) updateTotal();
});
document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-order-form]')) return;
  saveMcpOrder(event).catch((error) => {
    console.warn('mcp order save failed', error);
    toast('Không lưu được đơn từ MCP.');
  });
});
window.addEventListener('mcp:session-changed', () => setTimeout(ensureMcpOrderButtons, 0));
const observer = new MutationObserver(() => ensureMcpOrderButtons());
observer.observe(document.documentElement, { childList: true, subtree: true });
boot();
window.addEventListener('DOMContentLoaded', boot);
