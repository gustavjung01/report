import {
  DEFAULT_ONA_PRODUCTS,
  STORAGE_KEYS_V2,
  makeOrder,
  makeOrderItem,
  uid,
  todayIsoDate
} from './data-model.js';

import {
  readSupabaseSettings,
  configureSupabaseV2,
  isSupabaseV2Ready,
  loadProducts,
  syncOrder
} from './supabase-v2.js';

import {
  enqueueSync,
  readSyncQueue,
  flushSyncQueue,
  clearCompletedSyncItems,
  readCachedRows,
  cacheRows,
  upsertCachedRow,
  getSyncStats
} from './sync-queue.js';

const PAGE_TITLES = {
  createSection: 'Tạo dữ liệu mới',
  dataSection: 'Dữ liệu đã tạo',
  aiSection: 'AI tổng hợp',
  adminSection: 'Admin'
};

const STATUS_LABELS = {
  draft: 'Nháp',
  pending_confirm: 'Chờ xác nhận',
  confirmed: 'Đã chốt',
  delivering: 'Đang giao',
  delivered: 'Đã giao',
  cancelled: 'Hủy'
};

const root = document.querySelector('.phone-shell');
const navLinks = Array.from(document.querySelectorAll('[data-page-link]'));
const pages = Array.from(document.querySelectorAll('.app-page'));
const toast = document.getElementById('toast');
const headerSubtitle = document.getElementById('headerSubtitle');
const dbStatusPill = document.getElementById('dbStatusPill');
const orderFormPanel = document.getElementById('orderFormPanel');
const orderForm = document.getElementById('orderForm');
const orderItemsEl = document.getElementById('orderItems');
const orderListEl = document.getElementById('orderList');
const recentListEl = document.getElementById('recentList');

let products = DEFAULT_ONA_PRODUCTS.map((item) => ({ ...item, source: 'fallback', active: true, retail_price: 0, wholesale_price: 0 }));

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function formatMoney(value = 0) {
  return `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;
}

function setPage(pageId, push = true) {
  const target = document.getElementById(pageId) ? pageId : 'createSection';
  pages.forEach((page) => page.classList.toggle('is-active', page.id === target));
  navLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.pageLink === target));
  if (root) root.dataset.activePage = target;
  if (headerSubtitle) headerSubtitle.textContent = PAGE_TITLES[target] || 'Bếp Sỉ Báo Cáo';
  if (push && location.hash !== `#${target}`) history.replaceState(null, '', `#${target}`);
  window.scrollTo(0, 0);
}

function restorePageFromHash() {
  const id = location.hash.replace('#', '') || 'createSection';
  setPage(id, false);
}

function bindNavigation() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-page-link]');
    const jump = event.target.closest('[data-page-jump]');
    if (!link && !jump) return;
    event.preventDefault();
    setPage(link?.dataset.pageLink || jump.dataset.pageJump);
  });
  window.addEventListener('hashchange', restorePageFromHash);
  restorePageFromHash();
}

function bindDataTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-data-view]'));
  const panels = Array.from(document.querySelectorAll('[data-data-panel]'));
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.dataView;
      buttons.forEach((item) => item.classList.toggle('is-active', item === button));
      panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.dataPanel === view));
    });
  });
}

function bindDialogs() {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-dialog]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.openDialog);
      if (dialog?.showModal) dialog.showModal();
      else dialog?.setAttribute('open', '');
      return;
    }
    const closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      const dialog = closer.closest('dialog');
      if (dialog?.close) dialog.close();
      else dialog?.removeAttribute('open');
    }
  });
}

function isUnsafeKey(value = '') {
  return /sb_secret_|service_role/i.test(String(value));
}

function updateSupabasePreview() {
  const settings = readSupabaseSettings();
  configureSupabaseV2(settings);
  const ready = isSupabaseV2Ready() && !isUnsafeKey(settings.supabaseAnonKey);
  const urlInput = document.getElementById('supabaseUrl');
  const keyInput = document.getElementById('supabaseAnonKey');
  const preview = document.getElementById('supabasePreviewStatus');
  const adminDbState = document.getElementById('adminDbState');
  if (urlInput) urlInput.value = settings.supabaseUrl || '';
  if (keyInput) keyInput.value = settings.supabaseAnonKey || '';
  if (preview) {
    preview.innerHTML = ready
      ? `URL Project: ${escapeHtml(settings.supabaseUrl)}<br />Anon Key: đã lưu`
      : 'URL Project: -<br />Anon Key: -';
  }
  if (adminDbState) adminDbState.textContent = ready ? 'Đã nối ›' : 'Chưa nối ›';
  if (dbStatusPill) {
    dbStatusPill.classList.toggle('off', !ready);
    dbStatusPill.querySelector('b').textContent = ready ? 'Đã nối Supabase' : 'Chưa nối Supabase';
  }
  return ready;
}

function bindSupabaseActions() {
  const save = document.getElementById('saveSupabaseBtn');
  const test = document.getElementById('testSupabaseBtn');
  const status = document.getElementById('supabaseStatus');
  save?.addEventListener('click', async () => {
    const url = document.getElementById('supabaseUrl')?.value?.trim() || '';
    const key = document.getElementById('supabaseAnonKey')?.value?.trim() || '';
    if (isUnsafeKey(key)) {
      if (status) status.textContent = 'Sai key: không dùng service_role/sb_secret trong PWA.';
      showToast('Không lưu secret key trong PWA.');
      return;
    }
    const current = JSON.parse(localStorage.getItem('bepi-field-report-v5') || '{"settings":{}}');
    current.settings = { ...(current.settings || {}), supabaseUrl: url, supabaseAnonKey: key };
    localStorage.setItem('bepi-field-report-v5', JSON.stringify(current));
    updateSupabasePreview();
    await refreshProducts();
    if (status) status.textContent = 'Đã lưu cấu hình Supabase trên máy này.';
    showToast('Đã lưu DB.');
  });
  test?.addEventListener('click', async () => {
    updateSupabasePreview();
    try {
      await refreshProducts(true);
      if (status) status.textContent = 'DB sẵn sàng. Đã đọc được bảng products.';
      showToast('Cấu hình DB đã sẵn sàng.');
    } catch (error) {
      if (status) status.textContent = error.message || 'Chưa đủ URL/key Supabase.';
      showToast('Test DB chưa thành công.');
    }
  });
}

function readOrderRows() {
  return readCachedRows(STORAGE_KEYS_V2.orders);
}

function writeOrderRows(rows) {
  cacheRows(STORAGE_KEYS_V2.orders, rows);
}

function cacheOrderRow(order, items) {
  upsertCachedRow(STORAGE_KEYS_V2.orders, { order, items });
}

function generateOrderCode() {
  const ymd = todayIsoDate().replaceAll('-', '').slice(2);
  const count = readOrderRows().length + 1;
  return `DH${ymd}${String(count).padStart(3, '0')}`;
}

function productOptions(selectedId = '') {
  return products.map((product) => {
    const selected = product.id === selectedId ? 'selected' : '';
    return `<option value="${escapeHtml(product.id)}" ${selected}>${escapeHtml(product.name)}</option>`;
  }).join('');
}

function selectedProduct(id) {
  return products.find((product) => product.id === id) || products[0];
}

async function refreshProducts(forceToast = false) {
  try {
    if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
    const rows = await loadProducts();
    if (Array.isArray(rows) && rows.length) products = rows;
    localStorage.setItem(STORAGE_KEYS_V2.products, JSON.stringify(products));
    const preview = document.getElementById('productPreviewStatus');
    if (preview) preview.textContent = `Đã load ${products.length} sản phẩm từ Supabase products.`;
    renderProductSeedList();
    refreshProductSelects();
    if (forceToast) showToast(`Đã load ${products.length} sản phẩm.`);
    return products;
  } catch (error) {
    const cached = JSON.parse(localStorage.getItem(STORAGE_KEYS_V2.products) || '[]');
    if (Array.isArray(cached) && cached.length) products = cached;
    const preview = document.getElementById('productPreviewStatus');
    if (preview) preview.textContent = `Đang dùng ${products.length} sản phẩm fallback/cache.`;
    renderProductSeedList();
    refreshProductSelects();
    if (forceToast) throw error;
    return products;
  }
}

function renderProductSeedList() {
  const box = document.getElementById('productSeedList');
  if (!box) return;
  box.innerHTML = products.map((product) => `<span>${escapeHtml(product.name)}</span>`).join('');
}

function refreshProductSelects() {
  document.querySelectorAll('.order-product-select').forEach((select) => {
    const value = select.value;
    select.innerHTML = productOptions(value);
  });
}

function addOrderItemRow(input = {}) {
  if (!orderItemsEl) return;
  const id = input.id || uid('line');
  const productId = input.product_id || products[0]?.id || '';
  const product = selectedProduct(productId) || {};
  const quantity = Number(input.quantity || 1);
  const unitPrice = Number(input.unit_price ?? product.wholesale_price ?? product.retail_price ?? 0);
  const discount = Number(input.discount || 0);
  const row = document.createElement('article');
  row.className = 'order-item-row';
  row.dataset.lineId = id;
  row.innerHTML = `
    <label class="wide"><span>Sản phẩm</span><select class="order-product-select">${productOptions(productId)}</select></label>
    <div class="item-grid">
      <label><span>SL</span><input class="line-qty" type="number" inputmode="decimal" min="0" step="0.1" value="${quantity}" /></label>
      <label><span>Giá</span><input class="line-price" type="number" inputmode="numeric" min="0" step="1000" value="${unitPrice}" /></label>
      <label><span>CK</span><input class="line-discount" type="number" inputmode="numeric" min="0" step="1000" value="${discount}" /></label>
    </div>
    <label class="wide"><span>Ghi chú dòng</span><input class="line-note" type="text" value="${escapeHtml(input.note || '')}" placeholder="VD: giao trước 2 thùng" /></label>
    <footer><strong class="line-total">0đ</strong><button type="button" class="remove-line">Xóa</button></footer>
  `;
  orderItemsEl.appendChild(row);
  updateOrderTotals();
}

function lineRows() {
  return Array.from(document.querySelectorAll('.order-item-row'));
}

function updateOrderTotals() {
  let subtotal = 0;
  let discountTotal = 0;
  lineRows().forEach((row) => {
    const qty = Number(row.querySelector('.line-qty')?.value || 0);
    const price = Number(row.querySelector('.line-price')?.value || 0);
    const discount = Number(row.querySelector('.line-discount')?.value || 0);
    const line = Math.max(qty * price - discount, 0);
    subtotal += qty * price;
    discountTotal += discount;
    const totalEl = row.querySelector('.line-total');
    if (totalEl) totalEl.textContent = formatMoney(line);
  });
  document.getElementById('orderSubtotal').textContent = formatMoney(subtotal);
  document.getElementById('orderDiscountTotal').textContent = formatMoney(discountTotal);
  document.getElementById('orderGrandTotal').textContent = formatMoney(Math.max(subtotal - discountTotal, 0));
  return { subtotal, discount_total: discountTotal, grand_total: Math.max(subtotal - discountTotal, 0) };
}

function resetOrderForm() {
  if (!orderForm) return;
  orderForm.reset();
  document.getElementById('orderDate').value = todayIsoDate();
  document.getElementById('orderSales').value = 'A Tân';
  orderItemsEl.innerHTML = '';
  addOrderItemRow();
  updateOrderTotals();
}

function openOrderForm() {
  if (orderFormPanel) orderFormPanel.hidden = false;
  if (!lineRows().length) resetOrderForm();
  orderFormPanel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeOrderForm() {
  if (orderFormPanel) orderFormPanel.hidden = true;
}

function collectOrder() {
  const totals = updateOrderTotals();
  const order = makeOrder({
    id: uid('order'),
    order_code: generateOrderCode(),
    order_date: document.getElementById('orderDate').value || todayIsoDate(),
    sales: document.getElementById('orderSales').value,
    customer_name: document.getElementById('orderCustomerName').value,
    customer_phone: document.getElementById('orderCustomerPhone').value,
    area: document.getElementById('orderArea').value,
    delivery_address: document.getElementById('orderDeliveryAddress').value,
    status: document.getElementById('orderStatus').value,
    source_type: 'manual',
    note: document.getElementById('orderNote').value,
    sync_status: 'pending',
    ...totals
  });

  const items = lineRows().map((row) => {
    const product = selectedProduct(row.querySelector('.order-product-select').value) || {};
    return makeOrderItem({
      id: uid('order-item'),
      order_id: order.id,
      product_id: product.id,
      product_name: product.name,
      sku: product.sku,
      unit: product.unit,
      quantity: row.querySelector('.line-qty').value,
      unit_price: row.querySelector('.line-price').value,
      discount: row.querySelector('.line-discount').value,
      note: row.querySelector('.line-note').value
    });
  }).filter((item) => item.product_name && Number(item.quantity) > 0);

  if (!order.customer_name) throw new Error('Thiếu tên khách hàng.');
  if (!items.length) throw new Error('Đơn hàng phải có ít nhất 1 dòng sản phẩm.');
  return { order, items };
}

async function saveOrder(event) {
  event.preventDefault();
  const submit = orderForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  submit.textContent = 'Đang lưu...';
  try {
    const { order, items } = collectOrder();
    let savedOrder = { ...order };
    try {
      if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase.');
      await syncOrder(order, items);
      savedOrder.sync_status = 'synced';
      savedOrder.synced_at = new Date().toISOString();
      showToast('Đã lưu đơn hàng lên Supabase.');
    } catch (syncError) {
      savedOrder.sync_status = 'error';
      savedOrder.raw_payload = { ...(savedOrder.raw_payload || {}), sync_error: syncError.message };
      enqueueSync('order', { order: savedOrder, items });
      showToast('Đã lưu máy, chờ đồng bộ DB.');
    }
    cacheOrderRow(savedOrder, items);
    renderOrders();
    renderRecent();
    updateLocalStats();
    resetOrderForm();
    closeOrderForm();
    setPage('dataSection');
  } catch (error) {
    showToast(error.message || 'Không lưu được đơn hàng.');
  } finally {
    submit.disabled = false;
    submit.textContent = 'Lưu đơn hàng';
  }
}

function statusClass(status) {
  if (status === 'confirmed') return 'ok';
  if (status === 'delivered') return 'blue';
  if (status === 'cancelled') return 'danger-soft';
  return 'muted';
}

function syncDot(status) {
  if (status === 'synced') return '<em class="sync-dot ok">Đã lưu DB</em>';
  if (status === 'error') return '<em class="sync-dot danger">Lỗi DB</em>';
  return '<em class="sync-dot warn">Chờ đồng bộ</em>';
}

function renderOrders() {
  if (!orderListEl) return;
  const rows = readOrderRows().slice().sort((a, b) => String(b.order?.created_at || '').localeCompare(String(a.order?.created_at || '')));
  document.getElementById('aiOrderCount').textContent = String(rows.length);
  if (!rows.length) {
    orderListEl.innerHTML = '<article class="record-card placeholder-card"><div><h3>Chưa có đơn hàng</h3><p>Bấm Tạo → Đơn hàng để tạo đơn đầu tiên.</p><small>Dữ liệu sẽ lưu vào orders và order_items.</small></div></article>';
    return;
  }
  orderListEl.innerHTML = rows.map(({ order, items }) => `
    <article class="record-card">
      <div>
        <h3>${escapeHtml(order.order_code || order.id)}</h3>
        <p>Khách: ${escapeHtml(order.customer_name || '-')} ${order.area ? `- ${escapeHtml(order.area)}` : ''}</p>
        <p>${items.length} sản phẩm · Tổng tiền: ${formatMoney(order.grand_total)}</p>
        <small>${escapeHtml(order.order_date || '')} · ${escapeHtml(order.sales || '')}</small>
      </div>
      <aside>
        <span class="status ${statusClass(order.status)}">${STATUS_LABELS[order.status] || order.status}</span>
        <button type="button" data-open-order="${escapeHtml(order.id)}">Mở</button>
        ${syncDot(order.sync_status)}
      </aside>
    </article>
  `).join('');
}

function renderRecent() {
  if (!recentListEl) return;
  const rows = readOrderRows().slice(0, 3);
  if (!rows.length) {
    recentListEl.innerHTML = '<article class="mini-row"><span class="mini-icon">🛒</span><div><strong>Chưa có đơn hàng</strong><small>Tạo đơn đầu tiên để kiểm tra Supabase.</small></div><em class="sync-dot warn">Local</em></article>';
    return;
  }
  recentListEl.innerHTML = rows.map(({ order }) => `
    <article class="mini-row">
      <span class="mini-icon">🛒</span>
      <div><strong>Đơn hàng ${escapeHtml(order.order_code || order.id)}</strong><small>${escapeHtml(order.order_date || '')} · ${formatMoney(order.grand_total)}</small></div>
      ${syncDot(order.sync_status)}
    </article>
  `).join('');
}

function openOrderDetail(orderId) {
  const found = readOrderRows().find((row) => row.order?.id === orderId);
  if (!found) return;
  const lines = found.items.map((item) => `${item.product_name} x ${item.quantity}`).join(', ');
  showToast(`${found.order.order_code}: ${lines}`);
}

function updateLocalStats() {
  const stats = getSyncStats();
  document.getElementById('localRecordCount').textContent = String(readOrderRows().length);
  document.getElementById('pendingSyncCount').textContent = String((stats.pending || 0) + (stats.syncing || 0));
  document.getElementById('errorSyncCount').textContent = String(stats.error || 0);
}

async function retrySyncQueue() {
  try {
    const results = await flushSyncQueue({ stopOnError: false });
    const doneQueue = readSyncQueue().filter((item) => item.status === 'done' && item.type === 'order');
    if (doneQueue.length) {
      const rows = readOrderRows();
      doneQueue.forEach((item) => {
        const orderId = item.payload?.order?.id;
        const found = rows.find((row) => row.order?.id === orderId);
        if (found) {
          found.order.sync_status = 'synced';
          found.order.synced_at = new Date().toISOString();
        }
      });
      writeOrderRows(rows);
      clearCompletedSyncItems();
    }
    renderOrders();
    renderRecent();
    updateLocalStats();
    const ok = results.filter((item) => item.ok).length;
    const fail = results.filter((item) => !item.ok).length;
    showToast(`Đồng bộ xong: ${ok} thành công, ${fail} lỗi.`);
  } catch (error) {
    showToast(error.message || 'Đồng bộ lại thất bại.');
  }
}

function clearLocalCache() {
  if (!confirm('Xóa cache đơn hàng và queue trên máy này?')) return;
  cacheRows(STORAGE_KEYS_V2.orders, []);
  localStorage.setItem(STORAGE_KEYS_V2.syncQueue, '[]');
  renderOrders();
  renderRecent();
  updateLocalStats();
  showToast('Đã xóa cache máy.');
}

function bindOrderModule() {
  document.querySelector('[data-create-type="order"]')?.addEventListener('click', openOrderForm);
  document.querySelector('[data-create-type="test"]')?.addEventListener('click', () => showToast('Form Test sản phẩm sẽ làm ở Phase 4.'));
  document.querySelector('[data-create-type="market"]')?.addEventListener('click', () => showToast('Form Báo cáo thị trường sẽ làm ở Phase 5.'));
  document.getElementById('closeOrderFormBtn')?.addEventListener('click', closeOrderForm);
  document.getElementById('addOrderItemBtn')?.addEventListener('click', () => addOrderItemRow());
  document.getElementById('resetOrderBtn')?.addEventListener('click', resetOrderForm);
  orderForm?.addEventListener('submit', saveOrder);
  orderItemsEl?.addEventListener('input', updateOrderTotals);
  orderItemsEl?.addEventListener('change', (event) => {
    if (event.target.classList.contains('order-product-select')) {
      const row = event.target.closest('.order-item-row');
      const product = selectedProduct(event.target.value) || {};
      const priceInput = row.querySelector('.line-price');
      if (priceInput && !Number(priceInput.value)) priceInput.value = Number(product.wholesale_price || product.retail_price || 0);
    }
    updateOrderTotals();
  });
  orderItemsEl?.addEventListener('click', (event) => {
    const remove = event.target.closest('.remove-line');
    if (!remove) return;
    remove.closest('.order-item-row')?.remove();
    if (!lineRows().length) addOrderItemRow();
    updateOrderTotals();
  });
  orderListEl?.addEventListener('click', (event) => {
    const open = event.target.closest('[data-open-order]');
    if (open) openOrderDetail(open.dataset.openOrder);
  });
  document.getElementById('syncQueueBtn')?.addEventListener('click', retrySyncQueue);
  document.getElementById('clearCacheBtn')?.addEventListener('click', clearLocalCache);
}

function bindAiMock() {
  document.getElementById('mockAiButton')?.addEventListener('click', () => {
    showToast('AI tổng hợp mẫu. Phase 7 sẽ nối dữ liệu thật.');
  });
}

async function init() {
  bindNavigation();
  bindDataTabs();
  bindDialogs();
  bindSupabaseActions();
  bindOrderModule();
  bindAiMock();
  updateSupabasePreview();
  document.getElementById('orderDate').value = todayIsoDate();
  await refreshProducts();
  resetOrderForm();
  renderOrders();
  renderRecent();
  updateLocalStats();
}

init();
