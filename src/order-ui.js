import { makeOrder, makeOrderItem, makeMcpVisit, todayIsoDate, uid } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal, putManyLocal } from '../local-db.js';
import { districtsForProvince, provinceOptions } from './vn-admin-units.js';
import { getMcpRouteSessions, getMcpSessionDetail, upsertMcpVisitForSession } from './mcp-core.js';
import { ensureProductCatalog, matchCatalogProduct } from './product-catalog.js?v=bepsi-catalog-1';

const currency = new Intl.NumberFormat('vi-VN');
const statusText = { draft: 'Nháp', pending_confirm: 'Chờ xác nhận', confirmed: 'Đã chốt' };
let productCatalog = [];

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

function page() {
  if (document.querySelector('section.page[data-page="order-shell"]')) return;
  const main = document.querySelector('main');
  if (!main) return;
  main.insertAdjacentHTML('beforeend', '<section class="page shell-page order-page" data-page="order-shell"></section>');
}

function formatMoney(value) {
  const amount = Number(value || 0);
  if (!amount) return '0đ';
  return `${currency.format(amount)}đ`;
}

function formatShortDate(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '';
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

async function loadOrders() {
  const [orders, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems)
  ]);
  const sorted = orders.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  return { orders: sorted, items };
}

async function loadProductCatalog() {
  productCatalog = await ensureProductCatalog();
  return productCatalog;
}

function orderItemsOf(order, items) {
  return items.filter((item) => item.order_id === order.id);
}

function card(order, items) {
  const lines = orderItemsOf(order, items);
  const products = lines.map((item) => `${item.product_name} x${item.quantity}`).join(' · ') || 'Chưa có sản phẩm';
  const status = statusText[order.status] || order.status || 'Nháp';
  const source = order.raw_payload?.mcp_session_id ? '<small>🧭 MCP phiên tuyến</small>' : '';
  return `<article class="shell-card" data-order-id="${esc(order.id)}"><div class="shell-card-head"><div><h3>${esc(order.customer_name || 'Khách lẻ')}</h3><small>${esc(products)}</small><small>${esc(order.delivery_address || order.area || '')}</small>${source}</div><span class="shell-badge green">${esc(formatMoney(order.grand_total))}</span></div><div class="shell-actions"><button type="button" class="primary-lite" data-order-detail="${esc(order.id)}">Chi tiết</button><button type="button" data-order-detail="${esc(order.id)}">${esc(status)}</button><button type="button" data-order-repeat="${esc(order.id)}">Tạo lại</button></div></article>`;
}

async function render() {
  const section = document.querySelector('section.page[data-page="order-shell"]');
  if (!section) return;
  const { orders, items } = await loadOrders();
  const today = todayIsoDate();
  const todayOrders = orders.filter((order) => order.order_date === today);
  const revenue = todayOrders.reduce((sum, order) => sum + Number(order.grand_total || 0), 0);
  const pending = orders.filter((order) => order.status === 'draft' || order.status === 'pending_confirm').length;

  section.innerHTML = `<div class="shell-top"><div class="shell-title"><h1>Đơn hàng</h1><p>Tạo đơn nhanh, dùng catalog sản phẩm chuẩn trước khi sync.</p></div><div class="shell-top-actions"><button type="button" class="shell-back" data-page="create">Home</button><button type="button" class="shell-back order-create-btn" data-order-create>+ Đơn</button></div></div><article class="shell-hero order"><b>Tạo đơn nhanh ngoài tuyến</b><small>Khách · sản phẩm chuẩn · số lượng · giá · ghi chú giao hàng</small></article><div class="shell-grid"><div class="shell-kpis"><div class="shell-kpi"><b>${todayOrders.length}</b><span>Đơn hôm nay</span></div><div class="shell-kpi"><b>${esc(formatMoney(revenue))}</b><span>Doanh số</span></div><div class="shell-kpi"><b>${pending}</b><span>Chờ xử lý</span></div></div><div class="shell-list">${orders.map((order) => card(order, items)).join('') || '<p class="data-shell-note">Chưa có đơn hàng. Bấm + Đơn để tạo đơn đầu tiên.</p>'}</div></div>`;
}

function productOptionHtml(product = {}) {
  const disabled = product.orderable === false ? ' data-disabled="1"' : '';
  return `<option value="${esc(product.search_label || product.name || '')}" label="${esc([product.sku, product.category, formatMoney(product.price)].filter(Boolean).join(' · '))}"${disabled}></option>`;
}

function productCatalogDatalistHtml() {
  return `<datalist id="productCatalogOptions">${productCatalog.map(productOptionHtml).join('')}</datalist>`;
}

function productRow(name = '', quantity = 1, price = '', seed = {}) {
  return `<div class="order-line" data-order-line><input data-order-product list="productCatalogOptions" placeholder="Tìm sản phẩm/SKU" value="${esc(name)}"><input data-order-product-id type="hidden" value="${esc(seed.product_id || '')}"><input data-order-sku type="hidden" value="${esc(seed.sku || '')}"><input data-order-unit type="hidden" value="${esc(seed.unit || '')}"><input data-order-qty type="number" inputmode="numeric" min="1" value="${esc(quantity)}"><input data-order-price type="number" inputmode="numeric" min="0" placeholder="Giá" value="${esc(price)}"><button type="button" class="secondary" data-order-remove-line>×</button><div class="order-choice" data-order-choice-wrap></div></div>`;
}

function optionHtml(value = '', label = value, selected = '') {
  return `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`;
}

function provinceOptionsHtml(selected = '') {
  return optionHtml('', 'Chọn tỉnh/thành', selected) + provinceOptions.map((name) => optionHtml(name, name, selected)).join('');
}

function districtOptionsHtml(province = '', selected = '', keepCustom = true) {
  const districts = districtsForProvince(province);
  const rows = [optionHtml('', province ? 'Chọn quận/huyện' : 'Chọn tỉnh trước', selected), ...districts.map((name) => optionHtml(name, name, selected))];
  if (keepCustom && selected && !districts.includes(selected)) rows.push(optionHtml(selected, selected, selected));
  return rows.join('');
}

function updateDistrictOptions({ clearInvalid = false } = {}) {
  const province = document.querySelector('#orderProvince')?.value || '';
  const districtSelect = document.querySelector('#orderDistrict');
  if (!districtSelect) return;
  const districts = districtsForProvince(province);
  const current = districtSelect.value || '';
  const nextValue = clearInvalid && current && districts.length && !districts.includes(current) ? '' : current;
  districtSelect.innerHTML = districtOptionsHtml(province, nextValue, !clearInvalid);
  districtSelect.value = nextValue;
}

function splitArea(value = '') {
  const text = String(value || '').trim();
  if (!text) return { province: '', district: '' };
  const parts = text.split(/\s*[·,-]\s*/).filter(Boolean);
  if (parts.length >= 2) return { province: parts[0], district: parts.slice(1).join(' · ') };
  return { province: '', district: text };
}

function parseGeoText(value = '') {
  const text = String(value || '').trim();
  if (!text) return { geo_text: '', google_maps_url: '', geo_lat: null, geo_lng: null };
  const url = /^https?:\/\//i.test(text) ? text : '';
  const match = text.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || text.match(/[?&]q=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/) || text.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  const lat = match ? Number(match[1]) : null;
  const lng = match ? Number(match[2]) : null;
  return {
    geo_text: text,
    google_maps_url: url,
    geo_lat: Number.isFinite(lat) ? lat : null,
    geo_lng: Number.isFinite(lng) ? lng : null
  };
}

function composeArea(province = '', district = '') {
  return [province, district].map((item) => String(item || '').trim()).filter(Boolean).join(' · ');
}

function sourceLabel(session = {}) {
  const route = session.route_name || 'MCP';
  const area = session.area ? ` · ${session.area}` : '';
  const sales = session.sales ? ` · ${session.sales}` : '';
  return `${formatShortDate(session.session_date)} · ${route}${area}${sales}`;
}

async function mcpSourceOptions(selectedSessionId = '') {
  const sessions = (await getMcpRouteSessions()).filter((session) => session.status !== 'cancelled');
  return '<option value="manual">Nhập tay</option>' + sessions.map((session) => `<option value="${esc(session.id)}" ${session.id === selectedSessionId ? 'selected' : ''}>${esc(sourceLabel(session))}</option>`).join('');
}

async function customerOptionsForSession(sessionId = '', selectedId = '') {
  if (!sessionId || sessionId === 'manual') return '<option value="">Chọn MCP trước</option>';
  const detail = await getMcpSessionDetail(sessionId);
  const customers = detail?.customers || [];
  return '<option value="">Chọn khách</option>' + customers.map((customer) => `<option value="${esc(customer.id)}" ${customer.id === selectedId ? 'selected' : ''}>${esc(customer.customer_name)}${customer.area ? ` · ${esc(customer.area)}` : ''}</option>`).join('');
}

function selectedMcpSessionId() {
  const value = document.querySelector('#orderMcpSource')?.value || 'manual';
  return value === 'manual' ? '' : value;
}

function syncMcpSourceUi() {
  const sessionId = selectedMcpSessionId();
  const select = document.querySelector('#orderCustomerSelect');
  if (!select) return sessionId;
  select.disabled = !sessionId;
  select.closest('label')?.classList.toggle('is-disabled', !sessionId);
  return sessionId;
}

async function refreshMcpCustomerOptions({ clearCustomer = false } = {}) {
  const sessionId = syncMcpSourceUi();
  const select = document.querySelector('#orderCustomerSelect');
  if (!select) return;
  const oldValue = clearCustomer ? '' : select.value;
  select.innerHTML = await customerOptionsForSession(sessionId, oldValue);
  select.value = oldValue;
  syncMcpSourceUi();
  if (sessionId) {
    const detail = await getMcpSessionDetail(sessionId);
    if (detail?.session?.session_date) document.querySelector('#orderDate').value = detail.session.session_date;
    if (detail?.session?.sales) document.querySelector('#orderSales').value = detail.session.sales;
  }
}

function choiceSelectHtml(product = {}, selectedChoices = {}) {
  const groups = product.choice_groups || [];
  if (!groups.length) return '';
  return groups.map((group) => `<label class="order-choice-label"><span>${esc(group.name || 'Phân loại')}</span><select data-order-choice data-order-choice-key="${esc(group.key)}" ${group.required ? 'data-required="1"' : ''}>${optionHtml('', `Chọn ${String(group.name || 'phân loại').toLowerCase()}`)}${(group.values || []).map((value) => optionHtml(value, value, selectedChoices[group.key])).join('')}</select></label>`).join('');
}

function selectedChoicesFromRow(row) {
  return Object.fromEntries([...row.querySelectorAll('[data-order-choice]')].map((select) => [select.dataset.orderChoiceKey || 'choice', select.value || '']).filter(([, value]) => value));
}

function applyProductToRow(row, product, { keepName = false } = {}) {
  if (!row || !product) return;
  row.dataset.productId = product.id || '';
  row.dataset.sku = product.sku || '';
  row.querySelector('[data-order-product-id]').value = product.id || '';
  row.querySelector('[data-order-sku]').value = product.sku || '';
  row.querySelector('[data-order-unit]').value = product.unit || '';
  if (!keepName) row.querySelector('[data-order-product]').value = product.search_label || product.name || '';
  const price = row.querySelector('[data-order-price]');
  if (price && product.price) price.value = String(product.price);
  const wrap = row.querySelector('[data-order-choice-wrap]');
  if (wrap) wrap.innerHTML = choiceSelectHtml(product, selectedChoicesFromRow(row));
}

function productForRow(row) {
  const id = row.querySelector('[data-order-product-id]')?.value || row.dataset.productId || '';
  const sku = row.querySelector('[data-order-sku]')?.value || row.dataset.sku || '';
  const input = row.querySelector('[data-order-product]')?.value || '';
  return productCatalog.find((item) => item.id === id)
    || productCatalog.find((item) => item.sku === sku)
    || matchCatalogProduct(input, productCatalog);
}

function autofillProductRow(row, { keepName = true } = {}) {
  const input = row?.querySelector('[data-order-product]')?.value || '';
  const product = matchCatalogProduct(input, productCatalog);
  if (product) applyProductToRow(row, product, { keepName });
  return product;
}

async function openOrderModal(seed = {}) {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  await loadProductCatalog();
  const selectedCustomerId = seed.route_customer_id || '';
  const selectedSessionId = seed.mcp_session_id || seed.raw_payload?.mcp_session_id || '';
  const sourceOptions = await mcpSourceOptions(selectedSessionId);
  const customerOptions = await customerOptionsForSession(selectedSessionId, selectedCustomerId);
  const split = splitArea(seed.area || '');
  const province = seed.province || seed.raw_payload?.province || split.province;
  const district = seed.district || seed.raw_payload?.district || split.district;
  const geoText = seed.geo_text || seed.raw_payload?.geo_text || seed.raw_payload?.google_maps_url || '';
  dialog.dataset.type = 'order-create';
  dialog.innerHTML = `<form class="modal" data-order-form><header><h2>Tạo đơn hàng</h2><button type="button" data-close>Đóng</button></header><div class="form order-form"><div class="grid"><label><span>Ngày</span><input id="orderDate" type="date" value="${esc(seed.order_date || todayIsoDate())}"></label><label><span>Sales</span><input id="orderSales" value="${esc(seed.sales || 'A Tân')}"></label></div><div class="grid order-customer-source-row"><label><span>Nguồn / MCP</span><select id="orderMcpSource">${sourceOptions}</select></label><label><span>Khách trong MCP</span><select id="orderCustomerSelect" ${selectedSessionId ? '' : 'disabled'}>${customerOptions}</select></label></div><div class="grid"><label><span>Khách</span><input id="orderCustomerName" required value="${esc(seed.customer_name || '')}"></label><label><span>SĐT</span><input id="orderCustomerPhone" inputmode="tel" value="${esc(seed.customer_phone || '')}"></label></div><div class="grid"><label><span>Tỉnh/TP</span><select id="orderProvince" autocomplete="address-level1">${provinceOptionsHtml(province)}</select></label><label><span>Quận/Huyện</span><select id="orderDistrict" autocomplete="address-level2">${districtOptionsHtml(province, district)}</select></label></div><label><span>Địa chỉ giao</span><input id="orderAddress" autocomplete="street-address" value="${esc(seed.delivery_address || '')}"></label><label><span>Định vị / Google Maps</span><input id="orderGeoText" inputmode="url" value="${esc(geoText)}" placeholder="Dán link Google Maps hoặc tọa độ 10.7,106.6"></label><div class="line"><b>Sản phẩm</b><small class="data-shell-note">Đã nạp ${productCatalog.length} mã sản phẩm chuẩn từ Bếp Sỉ. Tìm bằng tên hoặc SKU.</small>${productCatalogDatalistHtml()}<div id="orderLines">${productRow(seed.product_name || '', seed.quantity || 1, seed.unit_price || '', seed)}</div><button type="button" class="secondary wide" data-order-add-line>+ Thêm sản phẩm</button></div><label><span>Ghi chú giao hàng</span><textarea id="orderNote" rows="2">${esc(seed.note || '')}</textarea></label><div class="total" id="orderTotal"><b>Tổng: 0đ</b></div><button class="primary" data-order-save>Lưu đơn</button></div></form>`;
  dialog.showModal();
  syncMcpSourceUi();
  updateDistrictOptions();
  if (selectedSessionId && selectedCustomerId) await fillCustomerFromSelect();
  [...dialog.querySelectorAll('[data-order-line]')].forEach((row) => autofillProductRow(row, { keepName: true }));
  updateTotal();
  document.querySelector('#orderCustomerName')?.focus();
}

async function fillCustomerFromSelect() {
  const sessionId = selectedMcpSessionId();
  const select = document.querySelector('#orderCustomerSelect');
  const customerId = select?.value || '';
  if (!sessionId || !customerId) return;
  const detail = await getMcpSessionDetail(sessionId);
  const customer = detail?.customers?.find((item) => item.id === customerId);
  if (!customer) return;
  document.querySelector('#orderCustomerName').value = customer.customer_name || '';
  document.querySelector('#orderCustomerPhone').value = customer.phone || '';
  document.querySelector('#orderAddress').value = customer.address || '';
  const split = splitArea(customer.area || detail?.session?.area || '');
  document.querySelector('#orderProvince').value = split.province;
  updateDistrictOptions();
  document.querySelector('#orderDistrict').value = split.district;
  const maps = customer.google_maps_url || (customer.geo_lat && customer.geo_lng ? `${customer.geo_lat},${customer.geo_lng}` : '');
  document.querySelector('#orderGeoText').value = maps;
}

function readLines() {
  return [...document.querySelectorAll('[data-order-line]')].map((row) => {
    const product = productForRow(row);
    const quantity = Math.max(1, Number(row.querySelector('[data-order-qty]')?.value || 1));
    const unitPrice = Math.max(0, Number(row.querySelector('[data-order-price]')?.value || product?.price || 0));
    const choices = selectedChoicesFromRow(row);
    const missingChoice = (product?.choice_groups || []).some((group) => group.required && !choices[group.key]);
    const choiceText = Object.values(choices).filter(Boolean).join(' · ');
    const inputName = row.querySelector('[data-order-product]')?.value.trim() || '';
    const baseName = product?.name || inputName;
    return {
      product_id: product?.id || row.querySelector('[data-order-product-id]')?.value || '',
      product_name: choiceText ? `${baseName} - ${choiceText}` : baseName,
      sku: product?.sku || row.querySelector('[data-order-sku]')?.value || '',
      unit: product?.unit || row.querySelector('[data-order-unit]')?.value || '',
      quantity,
      unit_price: unitPrice,
      line_total: quantity * unitPrice,
      raw_payload: {
        source: product ? 'product_catalog' : 'manual',
        catalog_product: product || null,
        choices,
        choice_required: Boolean((product?.choice_groups || []).length),
        missing_choice: missingChoice
      }
    };
  }).filter((line) => line.product_name);
}

function updateTotal() {
  const total = readLines().reduce((sum, line) => sum + line.line_total, 0);
  const element = document.querySelector('#orderTotal');
  if (element) element.innerHTML = `<b>Tổng: ${esc(formatMoney(total))}</b>`;
}

async function markMcpHasOrder(routeCustomerId, order, sessionId = '') {
  if (!routeCustomerId) return;
  if (sessionId) {
    const detail = await getMcpSessionDetail(sessionId);
    const visit = detail?.visits?.find((item) => item.route_customer_id === routeCustomerId);
    await upsertMcpVisitForSession({
      ...(visit || {}),
      id: visit?.id,
      session_id: sessionId,
      route_id: detail?.session?.route_id,
      route_customer_id: routeCustomerId,
      visit_date: detail?.session?.session_date || order.order_date,
      status: 'order',
      has_order: true,
      has_test: visit?.has_test,
      has_report: visit?.has_report,
      order_id: order.id,
      note: 'Có đơn hàng'
    });
    return;
  }

  const customers = await getAllLocal(LOCAL_STORES.mcpRouteCustomers);
  const customer = customers.find((row) => row.id === routeCustomerId);
  if (!customer?.route_id) return;
  const today = todayIsoDate();
  const visits = await getAllLocal(LOCAL_STORES.mcpVisits);
  const existing = visits.find((visit) => visit.route_customer_id === routeCustomerId && visit.visit_date === today);
  const visit = makeMcpVisit({
    ...(existing || {}),
    id: existing?.id || `mcp-visit-${today}-${routeCustomerId}`,
    route_id: customer.route_id,
    route_customer_id: routeCustomerId,
    visit_date: today,
    status: 'order',
    has_order: true,
    order_id: order.id,
    note: 'Có đơn hàng'
  });
  await putLocal(LOCAL_STORES.mcpVisits, visit);
}

async function saveOrder(event) {
  event.preventDefault();
  const lines = readLines();
  const customerName = document.querySelector('#orderCustomerName')?.value.trim();
  if (!customerName) return toast('Nhập tên khách trước đã.');
  if (!lines.length) return toast('Thêm ít nhất 1 sản phẩm.');
  const missing = lines.find((line) => line.raw_payload?.missing_choice);
  if (missing) return toast(`Chọn phân loại/vị cho ${missing.product_name}.`);

  const total = lines.reduce((sum, line) => sum + line.line_total, 0);
  const mcpSessionId = selectedMcpSessionId();
  const routeCustomerId = mcpSessionId ? (document.querySelector('#orderCustomerSelect')?.value || '') : '';
  if (mcpSessionId && !routeCustomerId) return toast('Chọn khách trong MCP trước đã.');
  const mcpDetail = mcpSessionId ? await getMcpSessionDetail(mcpSessionId) : null;
  const province = document.querySelector('#orderProvince')?.value.trim() || '';
  const district = document.querySelector('#orderDistrict')?.value.trim() || '';
  const area = composeArea(province, district);
  const geo = parseGeoText(document.querySelector('#orderGeoText')?.value || '');
  const order = makeOrder({
    id: uid('order'),
    order_date: document.querySelector('#orderDate')?.value || mcpDetail?.session?.session_date || todayIsoDate(),
    sales: document.querySelector('#orderSales')?.value,
    customer_id: routeCustomerId,
    customer_name: customerName,
    customer_phone: document.querySelector('#orderCustomerPhone')?.value,
    area,
    delivery_address: document.querySelector('#orderAddress')?.value,
    source_type: routeCustomerId ? 'mcp' : 'manual',
    source_id: routeCustomerId,
    status: 'pending_confirm',
    subtotal: total,
    grand_total: total,
    note: document.querySelector('#orderNote')?.value,
    sync_status: 'local',
    raw_payload: {
      kind: 'order',
      customer_source: mcpSessionId ? 'mcp_session' : 'manual',
      route_customer_id: routeCustomerId,
      mcp_session_id: mcpSessionId,
      mcp_route_id: mcpDetail?.session?.route_id || '',
      mcp_route_name: mcpDetail?.route?.route_name || mcpDetail?.session?.route_name || '',
      product_catalog: 'bepsi_hung_phat_v2',
      province,
      district,
      ...geo
    }
  });
  const items = lines.map((line) => makeOrderItem({ ...line, id: uid('order-item'), order_id: order.id }));
  await putLocal(LOCAL_STORES.orders, order);
  await putManyLocal(LOCAL_STORES.orderItems, items);
  await markMcpHasOrder(routeCustomerId, order, mcpSessionId);
  document.querySelector('#modal')?.close();
  await render();
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  toast('Đã lưu đơn hàng vào máy.');
}

async function showDetail(orderId) {
  const { orders, items } = await loadOrders();
  const order = orders.find((row) => row.id === orderId);
  if (!order) return toast('Không tìm thấy đơn.');
  const lines = orderItemsOf(order, items);
  const geo = order.raw_payload?.google_maps_url || order.raw_payload?.geo_text || '';
  const source = order.raw_payload?.mcp_session_id ? `<p class="data-shell-note">MCP: ${esc(order.raw_payload?.mcp_route_name || 'Phiên tuyến')}</p>` : '';
  const geoLine = geo ? `<p class="data-shell-note">Định vị: ${esc(geo)}</p>` : '';
  const dialog = document.querySelector('#modal');
  dialog.dataset.type = 'order-detail';
  dialog.innerHTML = `<div class="modal"><header><h2>${esc(order.customer_name || 'Đơn hàng')}</h2><button type="button" data-close>Đóng</button></header><div class="total"><b>${esc(formatMoney(order.grand_total))}</b><br><small>${esc(order.order_date || '')} · ${esc(order.area || '')}</small></div>${source}${lines.map((line) => `<article class="line"><b>${esc(line.product_name)}</b><small>${line.sku ? `SKU ${esc(line.sku)} · ` : ''}SL ${esc(line.quantity)} · Giá ${esc(formatMoney(line.unit_price))} · Thành tiền ${esc(formatMoney(line.line_total))}</small></article>`).join('') || '<p class="empty">Chưa có sản phẩm.</p>'}${order.delivery_address ? `<p class="data-shell-note">Địa chỉ: ${esc(order.delivery_address)}</p>` : ''}${geoLine}${order.note ? `<p class="data-shell-note">${esc(order.note)}</p>` : ''}</div>`;
  dialog.showModal();
}

async function repeatOrder(orderId) {
  const { orders, items } = await loadOrders();
  const order = orders.find((row) => row.id === orderId);
  const first = orderItemsOf(order || {}, items)[0];
  if (!order) return toast('Không tìm thấy đơn.');
  await openOrderModal({
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    area: order.area,
    province: order.raw_payload?.province,
    district: order.raw_payload?.district,
    geo_text: order.raw_payload?.geo_text || order.raw_payload?.google_maps_url,
    delivery_address: order.delivery_address,
    note: order.note,
    route_customer_id: order.raw_payload?.route_customer_id || order.customer_id,
    mcp_session_id: order.raw_payload?.mcp_session_id,
    product_name: first?.product_name || '',
    product_id: first?.product_id || '',
    sku: first?.sku || '',
    unit: first?.unit || '',
    quantity: first?.quantity || 1,
    unit_price: first?.unit_price || ''
  });
}

function boot() {
  page();
  loadProductCatalog().catch((error) => console.warn('product catalog seed failed', error));
  render().catch((error) => {
    console.warn('order render failed', error);
    toast('Không mở được dữ liệu đơn hàng local.');
  });
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-order-create]')) {
    event.preventDefault();
    openOrderModal();
    return;
  }
  if (event.target.closest('[data-order-add-line]')) {
    event.preventDefault();
    document.querySelector('#orderLines')?.insertAdjacentHTML('beforeend', productRow());
    updateTotal();
    return;
  }
  const remove = event.target.closest('[data-order-remove-line]');
  if (remove) {
    event.preventDefault();
    const rows = document.querySelectorAll('[data-order-line]');
    if (rows.length > 1) remove.closest('[data-order-line]')?.remove();
    updateTotal();
    return;
  }
  const detail = event.target.closest('[data-order-detail]');
  if (detail) {
    event.preventDefault();
    showDetail(detail.datasetOrderDetail || detail.dataset.orderDetail);
    return;
  }
  const repeat = event.target.closest('[data-order-repeat]');
  if (repeat) {
    event.preventDefault();
    repeatOrder(repeat.dataset.orderRepeat);
  }
}, true);

document.addEventListener('change', async (event) => {
  if (event.target.closest('#orderMcpSource')) await refreshMcpCustomerOptions({ clearCustomer: true });
  if (event.target.closest('#orderCustomerSelect')) await fillCustomerFromSelect();
  if (event.target.closest('#orderProvince')) updateDistrictOptions({ clearInvalid: true });
  const productInput = event.target.closest('[data-order-product]');
  if (productInput) autofillProductRow(productInput.closest('[data-order-line]'), { keepName: false });
  if (event.target.closest('[data-order-line]')) updateTotal();
});

document.addEventListener('input', (event) => {
  if (event.target.closest('[data-order-line]')) updateTotal();
});

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-order-form]')) return;
  saveOrder(event).catch((error) => {
    console.warn('order save failed', error);
    toast('Không lưu được đơn hàng.');
  });
});

boot();
window.addEventListener('DOMContentLoaded', boot);
