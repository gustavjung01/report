import {
  STORAGE_KEYS_V2,
  DEFAULT_ONA_PRODUCTS,
  makeCustomerMaster,
  makeOrder,
  makeOrderItem,
  makeOnaTest,
  makeOnaTestItem,
  makeMarketReport,
  makeMarketReportProduct,
  makeMarketReportCompetitor,
  uid,
  todayIsoDate,
  nowIso
} from './data-model.js';

import {
  configureSupabaseV2,
  isSupabaseV2Ready,
  syncCustomerMaster,
  syncOrder,
  syncOnaTest,
  syncMarketReport,
  sbUpsert
} from './supabase-v2.js';

import {
  enqueueSync,
  readCachedRows,
  cacheRows,
  upsertCachedRow,
  getSyncStats
} from './sync-queue.js';

const ROUTE_LOCAL_KEY = 'bepi-v2-market-routes';
const ROUTE_DB_KEY = 'bepi-v2-market-routes-db';
const ROUTE_CUSTOMERS_DB_KEY = 'bepi-v2-market-route-customers-db';
const CUSTOMER_RETURN_KEY = 'bepi-customer-return-target';

let customerReturnTarget = sessionStorage.getItem(CUSTOMER_RETURN_KEY) || '';
let customerMutationTimer = null;

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function slug(value = '') {
  return normalizeText(value).replace(/\s+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48) || 'route';
}

function normalizeSupabaseProjectUrl(value = '') {
  const raw = String(value || '').trim();
  if (!raw) return raw;
  const dashboard = raw.match(/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboard) return `https://${dashboard[1]}.supabase.co`;
  if (/^[a-z0-9]{15,40}$/i.test(raw)) return `https://${raw}.supabase.co`;
  let candidate = raw;
  if (/^[a-z0-9-]+\.supabase\.co/i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    if (url.hostname.endsWith('.supabase.co')) return `${url.protocol}//${url.hostname}`.replace(/\/+$/, '');
  } catch {}
  return raw.replace(/\/+$/, '');
}

function normalizeSavedSupabaseSettings() {
  const current = readJson(STORAGE_KEYS_V2.settings, { settings: {} });
  const settings = current.settings || {};
  const oldUrl = settings.supabaseUrl || '';
  const nextUrl = normalizeSupabaseProjectUrl(oldUrl);
  if (nextUrl && nextUrl !== oldUrl) {
    current.settings = { ...settings, supabaseUrl: nextUrl };
    writeJson(STORAGE_KEYS_V2.settings, current);
    const input = document.getElementById('supabaseUrl');
    if (input) input.value = nextUrl;
  }
  configureSupabaseV2();
  const ready = isSupabaseV2Ready();
  const pill = document.getElementById('dbStatusPill');
  if (pill) {
    pill.classList.toggle('off', !ready);
    const label = pill.querySelector('b');
    if (label) label.textContent = ready ? 'Đã nối Supabase' : 'Chưa nối Supabase';
  }
}

function ensureAiMetricFallback() {
  if (!document.getElementById('aiOrderCount')) {
    const span = document.createElement('span');
    span.id = 'aiOrderCount';
    span.hidden = true;
    span.textContent = String(readCachedRows(STORAGE_KEYS_V2.orders).length);
    document.body.appendChild(span);
  }
}

function readCustomers() {
  return readCachedRows(STORAGE_KEYS_V2.customers)
    .filter((row) => row && row.id && row.name)
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'vi'));
}

function writeCustomers(rows) {
  cacheRows(STORAGE_KEYS_V2.customers, rows);
}

function findCustomerById(id = '') {
  return readCustomers().find((row) => row.id === id) || null;
}

function findCustomerByIdentity({ id = '', name = '', phone = '' } = {}) {
  if (id) return findCustomerById(id);
  const n = normalizeText(name);
  const p = normalizeText(phone);
  return readCustomers().find((row) => {
    const samePhone = p && normalizeText(row.phone) === p;
    const sameName = n && normalizeText(row.name) === n;
    return samePhone || sameName;
  }) || null;
}

function customerRoute(customer = {}) {
  return customer.raw_payload?.default_route_name || customer.raw_payload?.route_name || customer.raw_payload?.default_route_day || '';
}

function customerStatus(customer = {}) {
  return customer.raw_payload?.active_status || 'active';
}

function customerTags(customer = {}) {
  if (Array.isArray(customer.tags)) return customer.tags;
  const rawTags = customer.raw_payload?.tags_string || customer.raw_payload?.tags || '';
  if (Array.isArray(rawTags)) return rawTags;
  return String(rawTags || '').split(',').map((item) => item.trim()).filter(Boolean);
}

function customerOptions(selected = '') {
  const rows = readCustomers();
  return '<option value="">Nhập khách mới / không chọn</option>' + rows.map((customer) => {
    const meta = [customer.area, customer.phone].filter(Boolean).join(' · ');
    return `<option value="${esc(customer.id)}" ${customer.id === selected ? 'selected' : ''}>${esc(customer.name)}${meta ? ` — ${esc(meta)}` : ''}</option>`;
  }).join('');
}

function productRows() {
  const cached = readJson(STORAGE_KEYS_V2.products, []);
  const rows = Array.isArray(cached) && cached.length ? cached : DEFAULT_ONA_PRODUCTS;
  return rows.map((row) => ({ ...row, wholesale_price: Number(row.wholesale_price || row.retail_price || 0), retail_price: Number(row.retail_price || row.wholesale_price || 0) }));
}

function selectedProduct(id = '') {
  const rows = productRows();
  return rows.find((row) => row.id === id) || rows[0] || {};
}

function fillValue(id, value, { onlyEmpty = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  if (onlyEmpty && el.value) return;
  el.value = value || '';
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function selectedCustomerNameFromMarketRoute() {
  const select = document.getElementById('marketSelectedCustomer');
  if (!select) return '';
  return select.value || select.options?.[select.selectedIndex]?.textContent || '';
}

function applyCustomerToTarget(customer, target = customerReturnTarget) {
  if (!customer || !target) return;
  if (target === 'order') {
    fillValue('orderCustomerId', customer.id);
    fillValue('orderCustomerName', customer.name);
    fillValue('orderCustomerPhone', customer.phone);
    fillValue('orderArea', customer.area);
    fillValue('orderDeliveryAddress', customer.address, { onlyEmpty: true });
    fillValue('orderCustomerPicker', customer.id);
  }
  if (target === 'test') {
    fillValue('onaTestCustomerId', customer.id);
    fillValue('onaTestCustomerName', customer.name);
    fillValue('onaTestCustomerPhone', customer.phone);
    fillValue('onaTestArea', customer.area);
    fillValue('onaTestShopType', customer.shop_type, { onlyEmpty: true });
    fillValue('onaTestCustomerPicker', customer.id);
  }
  if (target === 'market') {
    fillValue('marketCustomerId', customer.id);
    fillValue('marketCustomerPicker', customer.id);
    fillValue('marketArea', customer.area, { onlyEmpty: true });
    fillValue('marketType', customer.shop_type, { onlyEmpty: true });
    const select = document.getElementById('marketSelectedCustomer');
    if (select) {
      if (![...select.options].some((option) => option.value === customer.name)) {
        select.insertAdjacentHTML('beforeend', `<option value="${esc(customer.name)}">${esc(customer.name)}</option>`);
      }
      select.value = customer.name;
    }
    const routeCustomers = document.getElementById('marketRouteCustomers');
    if (routeCustomers && customer.name) {
      const names = routeCustomers.value.split('\n').map((line) => line.trim()).filter(Boolean);
      if (!names.some((name) => normalizeText(name) === normalizeText(customer.name))) {
        names.push(customer.name);
        routeCustomers.value = names.join('\n');
        routeCustomers.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }
  }
}

function ensureCustomerCard() {
  const grid = document.querySelector('.create-grid');
  if (!grid || document.querySelector('[data-create-type="customer"]')) return;
  grid.insertAdjacentHTML('afterbegin', `
    <button class="create-card customer-create-card" type="button" data-create-type="customer">
      <span class="card-art customer-art" aria-hidden="true">👥</span>
      <span class="card-copy">
        <strong>Khách hàng</strong>
        <small>Tạo master khách, tuyến MCP, tags, ghi chú.</small>
        <em>Tạo khách <i>›</i></em>
      </span>
    </button>
  `);
}

function ensureCustomerPanel() {
  const anchor = document.querySelector('.create-grid');
  if (!anchor || document.getElementById('customerFormPanel')) return;
  anchor.insertAdjacentHTML('afterend', `
    <section class="panel-card customer-form-card" id="customerFormPanel" hidden>
      <div class="section-head customer-head">
        <div>
          <h2>Tạo khách hàng</h2>
          <p>Khách lưu vào <code>customers_master</code> và dùng chung cho Đơn hàng/Test/Báo cáo.</p>
        </div>
        <button type="button" id="closeCustomerFormBtn">Đóng</button>
      </div>
      <form id="customerForm" class="customer-form">
        <input type="hidden" id="customerId" />
        <div class="form-grid two">
          <label><span>Tên khách hàng / cửa hàng</span><input type="text" id="customerName" required placeholder="Cửa hàng A / Đại lý B" /></label>
          <label><span>SĐT</span><input type="tel" id="customerPhone" placeholder="090..." /></label>
        </div>
        <div class="form-grid two">
          <label><span>Khu vực</span><input type="text" id="customerArea" placeholder="Gò Vấp / Q.10" /></label>
          <label><span>Loại điểm bán</span><input type="text" id="customerShopType" placeholder="Trà sữa / cafe / đại lý" /></label>
        </div>
        <label><span>Địa chỉ</span><input type="text" id="customerAddress" placeholder="Địa chỉ giao / địa chỉ cửa hàng" /></label>
        <div class="form-grid two">
          <label><span>Tuyến MCP mặc định</span><select id="customerRouteDay"><option value="">Chưa gắn</option><option>T2</option><option>T3</option><option>T4</option><option>T5</option><option>T6</option><option>T7</option></select></label>
          <label><span>Tên tuyến</span><input type="text" id="customerRouteName" placeholder="VD: T2 - Gò Vấp" /></label>
        </div>
        <div class="form-grid two">
          <label><span>Tags</span><input type="text" id="customerTags" placeholder="tiềm năng, cần mẫu, giá tốt" /></label>
          <label><span>Trạng thái hoạt động</span><select id="customerActiveStatus"><option value="active">Đang hoạt động</option><option value="lead">Lead mới</option><option value="paused">Tạm ngưng</option><option value="inactive">Ngưng hoạt động</option></select></label>
        </div>
        <label><span>Ghi chú</span><textarea id="customerNote" rows="2" placeholder="Ghi chú công nợ, sở thích, lịch chăm sóc..."></textarea></label>
        <div class="sticky-actions">
          <button type="button" id="resetCustomerBtn">Xóa form</button>
          <button type="submit" class="primary">Lưu khách hàng</button>
        </div>
      </form>
    </section>
  `);
}

function pickerHtml(target, selectId) {
  const label = target === 'order' ? 'Chọn khách cho đơn' : target === 'test' ? 'Chọn khách cho test' : 'Chọn khách master';
  return `
    <section class="customer-picker-inline" data-customer-picker="${target}">
      <input type="hidden" id="${target === 'order' ? 'orderCustomerId' : target === 'test' ? 'onaTestCustomerId' : 'marketCustomerId'}" />
      <label><span>${label}</span><select id="${selectId}" data-customer-select="${target}">${customerOptions()}</select></label>
      <button type="button" data-open-customer-quick="${target}">＋ Tạo khách mới</button>
    </section>`;
}

function ensureCustomerPickers() {
  const orderName = document.getElementById('orderCustomerName');
  if (orderName && !document.getElementById('orderCustomerPicker')) {
    const row = orderName.closest('.form-grid') || orderName.closest('label');
    row?.insertAdjacentHTML('beforebegin', pickerHtml('order', 'orderCustomerPicker'));
  }
  const testName = document.getElementById('onaTestCustomerName');
  if (testName && !document.getElementById('onaTestCustomerPicker')) {
    const row = testName.closest('.form-grid') || testName.closest('label');
    row?.insertAdjacentHTML('beforebegin', pickerHtml('test', 'onaTestCustomerPicker'));
  }
  const marketSelect = document.getElementById('marketSelectedCustomer');
  if (marketSelect && !document.getElementById('marketCustomerPicker')) {
    const row = marketSelect.closest('.form-grid') || marketSelect.closest('label');
    row?.insertAdjacentHTML('beforebegin', pickerHtml('market', 'marketCustomerPicker'));
  }
  refreshCustomerPickers();
}

function refreshCustomerPickers() {
  const map = {
    orderCustomerPicker: document.getElementById('orderCustomerId')?.value || '',
    onaTestCustomerPicker: document.getElementById('onaTestCustomerId')?.value || '',
    marketCustomerPicker: document.getElementById('marketCustomerId')?.value || ''
  };
  Object.entries(map).forEach(([id, selected]) => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = customerOptions(selected);
    select.value = selected;
  });
}

function resetCustomerForm() {
  const form = document.getElementById('customerForm');
  if (!form) return;
  form.reset();
  fillValue('customerId', '');
  fillValue('customerActiveStatus', 'active');
}

function prefillCustomerFormFromTarget(target) {
  resetCustomerForm();
  customerReturnTarget = target;
  sessionStorage.setItem(CUSTOMER_RETURN_KEY, target);
  const routeDay = document.querySelector('input[name="marketRouteDay"]:checked')?.value || '';
  const data = target === 'order' ? {
    name: document.getElementById('orderCustomerName')?.value || '',
    phone: document.getElementById('orderCustomerPhone')?.value || '',
    area: document.getElementById('orderArea')?.value || '',
    address: document.getElementById('orderDeliveryAddress')?.value || '',
    shop_type: ''
  } : target === 'test' ? {
    name: document.getElementById('onaTestCustomerName')?.value || '',
    phone: document.getElementById('onaTestCustomerPhone')?.value || '',
    area: document.getElementById('onaTestArea')?.value || '',
    address: '',
    shop_type: document.getElementById('onaTestShopType')?.value || ''
  } : {
    name: selectedCustomerNameFromMarketRoute(),
    phone: '',
    area: document.getElementById('marketArea')?.value || '',
    address: '',
    shop_type: document.getElementById('marketType')?.value || '',
    route_day: routeDay,
    route_name: document.getElementById('marketRouteName')?.value || ''
  };
  fillValue('customerName', data.name);
  fillValue('customerPhone', data.phone);
  fillValue('customerArea', data.area);
  fillValue('customerAddress', data.address);
  fillValue('customerShopType', data.shop_type);
  fillValue('customerRouteDay', data.route_day || '');
  fillValue('customerRouteName', data.route_name || '');
}

function openCustomerPanel() {
  ensureCustomerPanel();
  const panel = document.getElementById('customerFormPanel');
  if (panel) {
    panel.hidden = false;
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function closeCustomerPanel() {
  const panel = document.getElementById('customerFormPanel');
  if (panel) panel.hidden = true;
}

function collectCustomerFromForm() {
  const id = document.getElementById('customerId')?.value || uid('cus');
  const tags = String(document.getElementById('customerTags')?.value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  const raw = {
    source: 'customer_module',
    default_route_day: document.getElementById('customerRouteDay')?.value || '',
    default_route_name: document.getElementById('customerRouteName')?.value || '',
    active_status: document.getElementById('customerActiveStatus')?.value || 'active',
    tags_string: tags.join(', ')
  };
  const customer = makeCustomerMaster({
    id,
    name: document.getElementById('customerName')?.value || '',
    phone: document.getElementById('customerPhone')?.value || '',
    area: document.getElementById('customerArea')?.value || '',
    address: document.getElementById('customerAddress')?.value || '',
    shop_type: document.getElementById('customerShopType')?.value || '',
    tags,
    note: document.getElementById('customerNote')?.value || '',
    raw_payload: raw
  });
  if (!customer.name) throw new Error('Thiếu tên khách hàng.');
  return customer;
}

async function saveCustomer(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const submit = document.querySelector('#customerForm button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'Đang lưu...'; }
  try {
    const customer = collectCustomerFromForm();
    let saved = { ...customer, sync_status: 'pending' };
    try {
      configureSupabaseV2();
      if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
      await syncCustomerMaster(customer);
      saved = { ...saved, sync_status: 'synced', synced_at: nowIso() };
      toast('Đã lưu khách hàng lên Supabase.');
    } catch (syncError) {
      saved = { ...saved, sync_status: 'error', raw_payload: { ...(saved.raw_payload || {}), sync_error: syncError.message } };
      enqueueSync('customer_master', { customer: saved });
      toast('Đã lưu khách trên máy, chờ sync DB.');
    }
    upsertCachedRow(STORAGE_KEYS_V2.customers, saved);
    refreshCustomerPickers();
    renderCustomerManager();
    if (customerReturnTarget) {
      applyCustomerToTarget(saved, customerReturnTarget);
      sessionStorage.removeItem(CUSTOMER_RETURN_KEY);
      customerReturnTarget = '';
      closeCustomerPanel();
    } else {
      resetCustomerForm();
    }
  } catch (error) {
    toast(error.message || 'Không lưu được khách hàng.');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = 'Lưu khách hàng'; }
  }
}

async function ensureCustomerForPayload(payload) {
  const existing = findCustomerByIdentity(payload);
  if (existing) return existing;
  if (!payload.name && !payload.customer_name) return null;
  const customer = makeCustomerMaster({
    id: uid('cus'),
    name: payload.name || payload.customer_name,
    phone: payload.phone || payload.customer_phone,
    area: payload.area || payload.market_area,
    address: payload.address || payload.delivery_address,
    shop_type: payload.shop_type || payload.market_type,
    raw_payload: { source: payload.source || 'inline_form', active_status: 'active' }
  });
  const local = { ...customer, sync_status: 'pending' };
  upsertCachedRow(STORAGE_KEYS_V2.customers, local);
  try {
    configureSupabaseV2();
    if (!isSupabaseV2Ready()) throw new Error('DB not ready');
    await syncCustomerMaster(customer);
    const synced = { ...local, sync_status: 'synced', synced_at: nowIso() };
    upsertCachedRow(STORAGE_KEYS_V2.customers, synced);
    return synced;
  } catch (error) {
    enqueueSync('customer_master', { customer: local });
    return local;
  }
}

function updateLocalStats() {
  const stats = getSyncStats();
  const total = readCachedRows(STORAGE_KEYS_V2.orders).length + readCachedRows(STORAGE_KEYS_V2.onaTests).length + readCachedRows(STORAGE_KEYS_V2.marketReports).length + readCustomers().length;
  const local = document.getElementById('localRecordCount');
  const pending = document.getElementById('pendingSyncCount');
  const error = document.getElementById('errorSyncCount');
  if (local) local.textContent = String(total);
  if (pending) pending.textContent = String((stats.pending || 0) + (stats.syncing || 0));
  if (error) error.textContent = String(stats.error || 0);
}

function routeToDataTab(view) {
  document.querySelector('[data-page-link="dataSection"]')?.click();
  setTimeout(() => {
    document.querySelector(`[data-data-view="${view}"]`)?.click();
    if (view === 'customers') renderCustomerManager();
  }, 80);
}

function orderTotals() {
  let subtotal = 0;
  let discount_total = 0;
  const items = Array.from(document.querySelectorAll('.order-item-row')).map((row) => {
    const product = selectedProduct(row.querySelector('.order-product-select')?.value || '');
    const quantity = Number(row.querySelector('.line-qty')?.value || 0);
    const unit_price = Number(row.querySelector('.line-price')?.value || product.wholesale_price || product.retail_price || 0);
    const discount = Number(row.querySelector('.line-discount')?.value || 0);
    subtotal += quantity * unit_price;
    discount_total += discount;
    return makeOrderItem({
      id: uid('order-item'),
      product_id: product.id,
      product_name: product.name || row.querySelector('.order-product-select option:checked')?.textContent || '',
      sku: product.sku,
      unit: product.unit,
      quantity,
      unit_price,
      discount,
      note: row.querySelector('.line-note')?.value || ''
    });
  }).filter((item) => item.product_name && Number(item.quantity) > 0);
  return { items, subtotal, discount_total, grand_total: Math.max(subtotal - discount_total, 0) };
}

async function saveOrderWithCustomer(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const submit = document.querySelector('#orderForm button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'Đang lưu...'; }
  try {
    const customer = await ensureCustomerForPayload({
      id: document.getElementById('orderCustomerId')?.value || '',
      name: document.getElementById('orderCustomerName')?.value || '',
      phone: document.getElementById('orderCustomerPhone')?.value || '',
      area: document.getElementById('orderArea')?.value || '',
      address: document.getElementById('orderDeliveryAddress')?.value || '',
      source: 'order_form'
    });
    const totals = orderTotals();
    const order = makeOrder({
      id: uid('order'),
      order_code: `DH${todayIsoDate().replaceAll('-', '').slice(2)}${String(Date.now()).slice(-4)}`,
      order_date: document.getElementById('orderDate')?.value || todayIsoDate(),
      sales: document.getElementById('orderSales')?.value || '',
      customer_id: customer?.id || '',
      customer_name: document.getElementById('orderCustomerName')?.value || customer?.name || '',
      customer_phone: document.getElementById('orderCustomerPhone')?.value || customer?.phone || '',
      area: document.getElementById('orderArea')?.value || customer?.area || '',
      delivery_address: document.getElementById('orderDeliveryAddress')?.value || customer?.address || '',
      status: document.getElementById('orderStatus')?.value || 'draft',
      note: document.getElementById('orderNote')?.value || '',
      source_type: 'manual',
      sync_status: 'pending',
      raw_payload: { customer_source: customer?.id ? 'customers_master' : 'inline' },
      ...totals
    });
    const items = totals.items.map((item) => ({ ...item, order_id: order.id }));
    if (!order.customer_name) throw new Error('Thiếu tên khách hàng.');
    if (!items.length) throw new Error('Đơn hàng phải có ít nhất 1 sản phẩm.');
    let savedOrder = { ...order };
    try {
      configureSupabaseV2();
      if (!isSupabaseV2Ready()) throw new Error('DB not ready');
      await syncOrder(order, items);
      savedOrder.sync_status = 'synced';
      savedOrder.synced_at = nowIso();
      toast('Đã lưu đơn hàng và khách hàng lên DB.');
    } catch (error) {
      savedOrder.sync_status = 'error';
      savedOrder.raw_payload = { ...(savedOrder.raw_payload || {}), sync_error: error.message };
      enqueueSync('order', { order: savedOrder, items });
      toast('Đã lưu đơn + khách trên máy, chờ sync.');
    }
    upsertCachedRow(STORAGE_KEYS_V2.orders, { order: savedOrder, items });
    updateLocalStats();
    routeToDataTab('orders');
  } catch (error) {
    toast(error.message || 'Không lưu được đơn hàng.');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = 'Lưu đơn hàng'; }
  }
}

async function saveTestWithCustomer(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const submit = document.querySelector('#onaTestForm button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'Đang lưu...'; }
  try {
    const customer = await ensureCustomerForPayload({
      id: document.getElementById('onaTestCustomerId')?.value || '',
      name: document.getElementById('onaTestCustomerName')?.value || '',
      phone: document.getElementById('onaTestCustomerPhone')?.value || '',
      area: document.getElementById('onaTestArea')?.value || '',
      shop_type: document.getElementById('onaTestShopType')?.value || '',
      source: 'ona_test_form'
    });
    const code = `TS${todayIsoDate().replaceAll('-', '').slice(2)}${String(Date.now()).slice(-4)}`;
    const test = makeOnaTest({
      id: uid('ona-test'),
      test_date: document.getElementById('onaTestDate')?.value || todayIsoDate(),
      sales: document.getElementById('onaTestSales')?.value || '',
      customer_id: customer?.id || '',
      customer_name: document.getElementById('onaTestCustomerName')?.value || customer?.name || '',
      customer_phone: document.getElementById('onaTestCustomerPhone')?.value || customer?.phone || '',
      area: document.getElementById('onaTestArea')?.value || customer?.area || '',
      shop_type: document.getElementById('onaTestShopType')?.value || customer?.shop_type || '',
      test_type: document.getElementById('onaTestType')?.value || 'Trà ONA Test',
      follow_date: document.getElementById('onaTestFollowDate')?.value || null,
      need_sample: document.getElementById('onaNeedSample')?.checked || false,
      overall_note: document.getElementById('onaTestNote')?.value || '',
      sync_status: 'pending',
      raw_payload: { test_code: code, customer_source: customer?.id ? 'customers_master' : 'inline' }
    });
    const products = productRows();
    const items = Array.from(document.querySelectorAll('.test-item-row')).map((row) => {
      const product = products.find((item) => item.id === row.dataset.productId) || {};
      const status = row.querySelector('.test-status-select')?.value || 'pending';
      const note = row.querySelector('.test-note')?.value || '';
      return makeOnaTestItem({
        id: uid('ona-test-item'),
        test_id: test.id,
        product_id: product.id || row.dataset.productId,
        product_name: product.name || row.querySelector('header strong')?.textContent || '',
        status,
        note
      });
    }).filter((item) => item.status !== 'pending' || item.note);
    if (!test.customer_name) throw new Error('Thiếu tên khách hàng.');
    if (!items.length) throw new Error('Chọn ít nhất 1 sản phẩm có trạng thái hoặc ghi chú.');
    let savedTest = { ...test };
    try {
      configureSupabaseV2();
      if (!isSupabaseV2Ready()) throw new Error('DB not ready');
      await syncOnaTest(test, items);
      savedTest.sync_status = 'synced';
      savedTest.synced_at = nowIso();
      toast('Đã lưu phiếu test và khách hàng lên DB.');
    } catch (error) {
      savedTest.sync_status = 'error';
      savedTest.raw_payload = { ...(savedTest.raw_payload || {}), sync_error: error.message };
      enqueueSync('ona_test', { test: savedTest, items });
      toast('Đã lưu test + khách trên máy, chờ sync.');
    }
    upsertCachedRow(STORAGE_KEYS_V2.onaTests, { test: savedTest, items });
    updateLocalStats();
    routeToDataTab('tests');
  } catch (error) {
    toast(error.message || 'Không lưu được phiếu test.');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = 'Lưu phiếu test'; }
  }
}

async function saveMarketWithCustomer(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const submit = document.querySelector('#marketReportForm button[type="submit"]');
  if (submit) { submit.disabled = true; submit.textContent = 'Đang lưu...'; }
  try {
    const selectedName = selectedCustomerNameFromMarketRoute();
    const customer = await ensureCustomerForPayload({
      id: document.getElementById('marketCustomerId')?.value || '',
      name: selectedName,
      area: document.getElementById('marketArea')?.value || '',
      shop_type: document.getElementById('marketType')?.value || '',
      source: 'market_report_form'
    });
    const routeDay = document.querySelector('input[name="marketRouteDay"]:checked')?.value || '';
    const routeCustomers = String(document.getElementById('marketRouteCustomers')?.value || '').split('\n').map((line) => line.trim()).filter(Boolean);
    const code = `BC${todayIsoDate().replaceAll('-', '').slice(2)}${String(Date.now()).slice(-4)}`;
    const report = makeMarketReport({
      id: uid('market-report'),
      report_date: document.getElementById('marketReportDate')?.value || todayIsoDate(),
      sales: document.getElementById('marketSales')?.value || '',
      market_area: document.getElementById('marketArea')?.value || customer?.area || '',
      route_name: document.getElementById('marketRouteName')?.value || customerRoute(customer) || '',
      selected_customer_id: customer?.id || '',
      selected_customer_name: customer?.name || selectedName || '',
      market_type: document.getElementById('marketType')?.value || customer?.shop_type || '',
      total_shops: document.getElementById('marketTotalShops')?.value || 0,
      competitor_summary: document.getElementById('competitorSummary')?.value || '',
      price_summary: document.getElementById('priceSummary')?.value || '',
      demand_summary: document.getElementById('demandSummary')?.value || '',
      company_product_summary: document.getElementById('companyProductSummary')?.value || '',
      opportunity_summary: document.getElementById('opportunitySummary')?.value || '',
      risk_summary: document.getElementById('riskSummary')?.value || '',
      next_action: document.getElementById('nextAction')?.value || '',
      note: document.getElementById('marketNote')?.value || '',
      sync_status: 'pending',
      raw_payload: { report_code: code, route_day: routeDay, route_customers: routeCustomers, selected_customer: customer?.name || selectedName || '', selected_customer_id: customer?.id || '' }
    });
    const products = Array.from(document.querySelectorAll('.market-product-row')).map((row) => {
      const product = selectedProduct(row.querySelector('.market-product-select')?.value || '');
      return makeMarketReportProduct({
        id: uid('market-product'),
        market_report_id: report.id,
        product_id: product.id,
        product_name: product.name || row.querySelector('.market-product-select option:checked')?.textContent || '',
        company_product: true,
        market_position: row.querySelector('.market-position')?.value || '',
        feedback: row.querySelector('.product-feedback')?.value || '',
        opportunity_level: row.querySelector('.opportunity-level')?.value || '',
        risk_level: row.querySelector('.risk-level')?.value || '',
        note: row.querySelector('.product-note')?.value || ''
      });
    }).filter((item) => item.product_name && (item.market_position || item.feedback || item.opportunity_level || item.risk_level || item.note));
    const competitors = Array.from(document.querySelectorAll('.market-competitor-row')).map((row) => makeMarketReportCompetitor({
      id: uid('market-competitor'),
      market_report_id: report.id,
      competitor_name: row.querySelector('.competitor-name')?.value || '',
      product_line: row.querySelector('.competitor-line')?.value || '',
      price_range: row.querySelector('.competitor-price')?.value || '',
      strength: row.querySelector('.competitor-strength')?.value || '',
      note: row.querySelector('.competitor-note')?.value || ''
    })).filter((item) => item.competitor_name || item.product_line || item.price_range || item.strength || item.note);
    if (!report.market_area && !report.route_name) throw new Error('Thiếu khu vực hoặc tên tuyến.');
    if (!report.competitor_summary && !report.demand_summary && !report.opportunity_summary && !products.length && !competitors.length) throw new Error('Báo cáo cần có ít nhất một nội dung thị trường.');
    let savedReport = { ...report };
    try {
      configureSupabaseV2();
      if (!isSupabaseV2Ready()) throw new Error('DB not ready');
      await syncMarketReport(report, products, competitors);
      savedReport.sync_status = 'synced';
      savedReport.synced_at = nowIso();
      await syncRouteCustomerIds();
      toast('Đã lưu báo cáo thị trường và khách hàng lên DB.');
    } catch (error) {
      savedReport.sync_status = 'error';
      savedReport.raw_payload = { ...(savedReport.raw_payload || {}), sync_error: error.message };
      enqueueSync('market_report', { report: savedReport, products, competitors });
      toast('Đã lưu báo cáo + khách trên máy, chờ sync.');
    }
    upsertCachedRow(STORAGE_KEYS_V2.marketReports, { report: savedReport, products, competitors });
    updateLocalStats();
    routeToDataTab('reports');
  } catch (error) {
    toast(error.message || 'Không lưu được báo cáo thị trường.');
  } finally {
    if (submit) { submit.disabled = false; submit.textContent = 'Lưu báo cáo'; }
  }
}

function historyForCustomer(customer) {
  const id = customer.id;
  const name = normalizeText(customer.name);
  const phone = normalizeText(customer.phone);
  const byNameOrPhone = (rowName, rowPhone) => (name && normalizeText(rowName) === name) || (phone && normalizeText(rowPhone) === phone);
  const orders = readCachedRows(STORAGE_KEYS_V2.orders).filter(({ order = {} }) => order.customer_id === id || byNameOrPhone(order.customer_name, order.customer_phone));
  const tests = readCachedRows(STORAGE_KEYS_V2.onaTests).filter(({ test = {} }) => test.customer_id === id || byNameOrPhone(test.customer_name, test.customer_phone));
  const reports = readCachedRows(STORAGE_KEYS_V2.marketReports).filter(({ report = {} }) => report.selected_customer_id === id || normalizeText(report.selected_customer_name || report.raw_payload?.selected_customer) === name);
  const routeCustomers = [...readJson(ROUTE_CUSTOMERS_DB_KEY, []), ...Object.values(readJson(ROUTE_LOCAL_KEY, {})).flatMap((route) => (route.customers || []).map((customerName, index) => ({ route_id: route.id || `${route.route_day || ''}-${slug(route.route_name || route.market_area || '')}`, route_name: route.route_name, route_day: route.route_day, customer_name: customerName, sort_order: index + 1 })))];
  const routes = routeCustomers.filter((row) => row.customer_id === id || normalizeText(row.customer_name) === name);
  return { orders, tests, reports, routes };
}

function renderCustomerManager() {
  const panel = document.querySelector('[data-data-panel="customers"]');
  if (!panel) return;
  const q = document.getElementById('dataFilterQ')?.value?.trim() || '';
  const area = document.getElementById('dataFilterArea')?.value?.trim() || '';
  const route = document.getElementById('customerRouteFilter')?.value || '';
  const routeDays = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  const rows = readCustomers().filter((customer) => {
    const textOk = !q || normalizeText([customer.name, customer.phone, customer.note, customerTags(customer).join(' ')].join(' ')).includes(normalizeText(q));
    const areaOk = !area || normalizeText(customer.area).includes(normalizeText(area));
    const routeOk = !route || customer.raw_payload?.default_route_day === route || String(customerRoute(customer)).includes(route);
    return textOk && areaOk && routeOk;
  });
  panel.innerHTML = `
    <section class="customer-manager" id="customerManager">
      <div class="customer-manager-head">
        <div><h2>Khách hàng</h2><p>${rows.length} khách trong cache/DB. Lọc bằng ô “Tìm khách / mã”, “Khu vực” ở trên.</p></div>
        <div class="customer-manager-actions"><select id="customerRouteFilter">${routeDays.map((day) => `<option value="${day}" ${day === route ? 'selected' : ''}>${day || 'Tất cả tuyến'}</option>`).join('')}</select><button type="button" class="primary" id="openCustomerCreateFromData">＋ Tạo khách</button></div>
      </div>
      <div class="customer-list">
        ${rows.length ? rows.map((customer) => {
          const history = historyForCustomer(customer);
          const tags = customerTags(customer).slice(0, 4);
          return `<article class="record-card customer-record" data-customer-id="${esc(customer.id)}">
            <div>
              <h3>${esc(customer.name)} <span class="source-badge">${esc(customer.sync_status || 'local')}</span></h3>
              <p>${esc(customer.area || '-')} ${customer.phone ? `· ${esc(customer.phone)}` : ''} ${customer.shop_type ? `· ${esc(customer.shop_type)}` : ''}</p>
              <small>${esc(customerRoute(customer) || customer.address || customer.note || 'Khách hàng dùng chung')}</small>
              <div class="customer-tags">${tags.map((tag) => `<span>${esc(tag)}</span>`).join('')}</div>
            </div>
            <aside>
              <span class="status ${customerStatus(customer) === 'active' ? 'ok' : 'muted'}">${customerStatus(customer) === 'active' ? 'Hoạt động' : esc(customerStatus(customer))}</span>
              <button type="button" data-open-customer-history="${esc(customer.id)}">Lịch sử</button>
              <small>${history.orders.length} đơn · ${history.tests.length} test · ${history.reports.length} BC</small>
            </aside>
          </article>`;
        }).join('') : '<article class="empty-sync-card">Chưa có khách hàng. Bấm Tạo → Khách hàng hoặc tạo nhanh trong Đơn hàng/Test/Báo cáo.</article>'}
      </div>
      <div class="customer-history-panel" id="customerHistoryPanel"></div>
    </section>`;
  document.getElementById('customerRouteFilter')?.addEventListener('change', renderCustomerManager, { once: true });
}

function openCustomerHistory(customerId) {
  const customer = findCustomerById(customerId);
  const panel = document.getElementById('customerHistoryPanel');
  if (!customer || !panel) return;
  const history = historyForCustomer(customer);
  const row = (icon, title, sub) => `<article class="mini-row"><span class="mini-icon">${icon}</span><div><strong>${esc(title)}</strong><small>${esc(sub)}</small></div></article>`;
  panel.innerHTML = `
    <section class="panel-card customer-history-card">
      <div class="section-head"><div><h2>Lịch sử: ${esc(customer.name)}</h2><p>${esc(customer.area || '')} ${customer.phone ? `· ${esc(customer.phone)}` : ''}</p></div><button type="button" id="closeCustomerHistory">Đóng</button></div>
      <div class="customer-history-grid">
        <div><strong>${history.orders.length}</strong><small>Đơn hàng</small></div>
        <div><strong>${history.tests.length}</strong><small>Test SP</small></div>
        <div><strong>${history.reports.length}</strong><small>Báo cáo</small></div>
        <div><strong>${history.routes.length}</strong><small>Tuyến</small></div>
      </div>
      <div class="customer-history-list">
        ${history.orders.slice(0, 5).map(({ order }) => row('🛒', order.order_code || order.id, `${order.order_date || ''} · ${Math.round(Number(order.grand_total || 0)).toLocaleString('vi-VN')}đ`)).join('')}
        ${history.tests.slice(0, 5).map(({ test }) => row('🍵', test.raw_payload?.test_code || test.id, `${test.test_date || ''} · ${test.overall_note || 'Phiếu test'}`)).join('')}
        ${history.reports.slice(0, 5).map(({ report }) => row('📊', report.raw_payload?.report_code || report.id, `${report.report_date || ''} · ${report.route_name || report.market_area || ''}`)).join('')}
        ${history.routes.slice(0, 5).map((routeItem) => row('🗺️', routeItem.route_name || routeItem.route_id || 'Tuyến MCP', routeItem.route_day || routeItem.market_area || '')).join('')}
      </div>
    </section>`;
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function syncRouteCustomerIds() {
  configureSupabaseV2();
  if (!isSupabaseV2Ready()) return 0;
  const customers = readCustomers();
  const match = (name) => customers.find((customer) => normalizeText(customer.name) === normalizeText(name));
  const localRoutes = Object.values(readJson(ROUTE_LOCAL_KEY, {}));
  const dbRoutes = readJson(ROUTE_DB_KEY, []);
  const rows = [];
  localRoutes.forEach((route) => {
    const day = route.route_day || 'T2';
    const routeName = route.route_name || `${day} - ${route.market_area || 'Tuyến MCP'}`;
    const routeId = route.id || `route-${day.toLowerCase()}-${slug(routeName)}`;
    (route.customers || []).forEach((name, index) => {
      const customer = match(name);
      if (!String(name || '').trim()) return;
      rows.push({
        id: `mrc-${routeId}-${index + 1}`,
        route_id: routeId,
        customer_id: customer?.id || null,
        customer_name: String(name || '').trim(),
        market_area: route.market_area || customer?.area || '',
        sort_order: index + 1,
        active: true,
        raw_payload: { source: 'customer_module_route_link', matched_customer: Boolean(customer) },
        updated_at: nowIso()
      });
    });
  });
  readJson(ROUTE_CUSTOMERS_DB_KEY, []).forEach((row) => {
    const customer = row.customer_id ? findCustomerById(row.customer_id) : match(row.customer_name);
    if (customer && !row.customer_id) rows.push({ ...row, customer_id: customer.id, raw_payload: { ...(row.raw_payload || {}), source: 'customer_module_db_route_link' }, updated_at: nowIso() });
  });
  dbRoutes.forEach((route) => {
    const routeCustomerMatches = customers.filter((customer) => customer.raw_payload?.default_route_name === route.route_name || customer.raw_payload?.default_route_day === route.route_day);
    routeCustomerMatches.forEach((customer, index) => rows.push({
      id: `mrc-${route.id}-${customer.id}`,
      route_id: route.id,
      customer_id: customer.id,
      customer_name: customer.name,
      market_area: route.market_area || customer.area || '',
      sort_order: index + 1,
      active: true,
      raw_payload: { source: 'customer_default_route' },
      updated_at: nowIso()
    }));
  });
  if (!rows.length) return 0;
  await sbUpsert('market_route_customers', rows, 'id');
  return rows.length;
}

function bindCustomerModule() {
  document.addEventListener('click', (event) => {
    const card = event.target.closest('[data-create-type="customer"]');
    if (card) {
      event.preventDefault();
      event.stopImmediatePropagation();
      customerReturnTarget = '';
      sessionStorage.removeItem(CUSTOMER_RETURN_KEY);
      resetCustomerForm();
      openCustomerPanel();
      return;
    }
    const quick = event.target.closest('[data-open-customer-quick]');
    if (quick) {
      event.preventDefault();
      event.stopImmediatePropagation();
      prefillCustomerFormFromTarget(quick.dataset.openCustomerQuick);
      openCustomerPanel();
      return;
    }
    if (event.target.closest('#closeCustomerFormBtn')) closeCustomerPanel();
    if (event.target.closest('#resetCustomerBtn')) resetCustomerForm();
    if (event.target.closest('#openCustomerCreateFromData')) {
      event.preventDefault();
      customerReturnTarget = '';
      resetCustomerForm();
      document.querySelector('[data-page-link="createSection"]')?.click();
      setTimeout(openCustomerPanel, 80);
    }
    const historyButton = event.target.closest('[data-open-customer-history]');
    if (historyButton) openCustomerHistory(historyButton.dataset.openCustomerHistory);
    if (event.target.closest('#closeCustomerHistory')) {
      const panel = document.getElementById('customerHistoryPanel');
      if (panel) panel.innerHTML = '';
    }
    if (event.target.closest('#flushAllQueueBtn')) {
      setTimeout(() => syncRouteCustomerIds().then((count) => { if (count) toast(`Đã gắn customer_id cho ${count} khách tuyến MCP.`); }).catch(() => {}), 1800);
    }
    if (event.target.closest('[data-data-view="customers"]')) setTimeout(renderCustomerManager, 80);
    if (event.target.closest('#loadDbDataBtn')) setTimeout(() => { refreshCustomerPickers(); renderCustomerManager(); }, 1400);
  }, true);

  document.addEventListener('change', (event) => {
    const select = event.target.closest('[data-customer-select]');
    if (!select) return;
    const customer = findCustomerById(select.value);
    if (customer) applyCustomerToTarget(customer, select.dataset.customerSelect);
    else {
      const hiddenId = select.dataset.customerSelect === 'order' ? 'orderCustomerId' : select.dataset.customerSelect === 'test' ? 'onaTestCustomerId' : 'marketCustomerId';
      fillValue(hiddenId, '');
    }
  });

  document.addEventListener('submit', (event) => {
    if (event.target?.id === 'customerForm') saveCustomer(event);
    if (event.target?.id === 'orderForm') saveOrderWithCustomer(event);
    if (event.target?.id === 'onaTestForm') saveTestWithCustomer(event);
    if (event.target?.id === 'marketReportForm') saveMarketWithCustomer(event);
  }, true);
}

function scheduleEnsureDom() {
  clearTimeout(customerMutationTimer);
  customerMutationTimer = setTimeout(() => {
    ensureAiMetricFallback();
    ensureCustomerCard();
    ensureCustomerPanel();
    ensureCustomerPickers();
  }, 60);
}

function initCustomerModule() {
  loadCss('customer-module.css');
  normalizeSavedSupabaseSettings();
  ensureAiMetricFallback();
  ensureCustomerCard();
  ensureCustomerPanel();
  ensureCustomerPickers();
  bindCustomerModule();
  renderCustomerManager();
  updateLocalStats();
  const observer = new MutationObserver(scheduleEnsureDom);
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(scheduleEnsureDom, 400);
  setTimeout(scheduleEnsureDom, 1200);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCustomerModule, { once: true });
else initCustomerModule();
