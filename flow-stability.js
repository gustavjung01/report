import { STORAGE_KEYS_V2, makeProduct, makeOrder, makeOrderItem, uid, todayIsoDate } from './data-model.js';
import { configureSupabaseV2, isSupabaseV2Ready, sbUpsert, syncOrder, loadAiSummaries } from './supabase-v2.js';
import { enqueueSync, upsertCachedRow, readCachedRows, cacheRows } from './sync-queue.js';

const PRODUCT_CSV = 'https://raw.githubusercontent.com/gustavjung01/F-B-Order/main/data/catalog/hung-phat/v2/products.csv';
const VARIANT_CSV = 'https://raw.githubusercontent.com/gustavjung01/F-B-Order/main/data/catalog/hung-phat/v2/product-variants.csv';
let bepsiProducts = [];

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}

function csvRows(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i], nx = text[i + 1];
    if (q && ch === '"' && nx === '"') { cell += '"'; i += 1; continue; }
    if (ch === '"') { q = !q; continue; }
    if (!q && ch === ',') { row.push(cell); cell = ''; continue; }
    if (!q && (ch === '\n' || ch === '\r')) {
      if (ch === '\r' && nx === '\n') i += 1;
      row.push(cell); rows.push(row); row = []; cell = ''; continue;
    }
    cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((x) => x.replace(/^\uFEFF/, '').trim());
  return rows.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] || ''])));
}

async function loadBepsiProducts() {
  if (bepsiProducts.length) return bepsiProducts;
  const cached = readJson(STORAGE_KEYS_V2.products, []);
  if (cached.length > 20) { bepsiProducts = cached; return bepsiProducts; }
  const [pText, vText] = await Promise.all([fetch(PRODUCT_CSV).then((r) => r.text()), fetch(VARIANT_CSV).then((r) => r.text())]);
  const products = csvRows(pText);
  const variants = csvRows(vText);
  const firstVariant = new Map(variants.map((v) => [v.product_key, v]));
  bepsiProducts = products.slice(0, 1200).map((p) => {
    const v = firstVariant.get(p.product_key) || {};
    return makeProduct({
      id: p.product_key,
      source: 'bepsi_f_b_order',
      external_id: p.product_key,
      sku: v.sku || p.product_key,
      name: p.name,
      category: p.category,
      brand: p.brand,
      unit: 'sp',
      wholesale_price: Number(v.price || p.price_from || 0),
      retail_price: Number(v.price || p.price_from || 0),
      active: true,
      raw_payload: { product: p, variant: v }
    });
  }).filter((p) => p.name);
  localStorage.setItem(STORAGE_KEYS_V2.products, JSON.stringify(bepsiProducts));
  return bepsiProducts;
}

async function seedBepsiToDb() {
  const rows = await loadBepsiProducts();
  configureSupabaseV2();
  if (!isSupabaseV2Ready()) { toast(`Da nap ${rows.length} SP Bep Si vao may.`); return rows; }
  for (let i = 0; i < rows.length; i += 200) await sbUpsert('products', rows.slice(i, i + 200));
  toast(`Da nap ${rows.length} SP Bep Si vao Supabase.`);
  return rows;
}

function productOptions(selected = '') {
  return bepsiProducts.map((p) => `<option value="${p.id}" ${p.id === selected ? 'selected' : ''}>${p.sku ? p.sku + ' - ' : ''}${p.name}</option>`).join('');
}

function refreshOrderSelects() {
  document.querySelectorAll('.order-product-select').forEach((select) => {
    const val = select.value;
    select.innerHTML = productOptions(val);
    const p = bepsiProducts.find((x) => x.id === select.value) || bepsiProducts[0];
    const row = select.closest('.order-item-row');
    const price = row?.querySelector('.line-price');
    if (p && price && !Number(price.value)) price.value = p.wholesale_price || p.retail_price || 0;
  });
}

function ensureVisibleActions() {
  if (document.getElementById('flowStabilityCss')) return;
  const style = document.createElement('style');
  style.id = 'flowStabilityCss';
  style.textContent = `.sticky-actions{position:static!important;display:grid!important;grid-template-columns:1fr 1fr!important;margin:10px 0 0!important}.sticky-actions button{min-height:44px!important}.order-form-card,.test-form-card,.market-form-card{padding-bottom:16px!important}.order-product-select{min-width:100%}`;
  document.head.appendChild(style);
}

function openPanel(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return true;
}

function collectOrder() {
  const rows = Array.from(document.querySelectorAll('.order-item-row'));
  let subtotal = 0, discount_total = 0;
  const order = makeOrder({
    id: uid('order'),
    order_code: `DH${todayIsoDate().replaceAll('-', '').slice(2)}${String(Date.now()).slice(-4)}`,
    order_date: document.getElementById('orderDate')?.value || todayIsoDate(),
    sales: document.getElementById('orderSales')?.value || '',
    customer_name: document.getElementById('orderCustomerName')?.value || '',
    customer_phone: document.getElementById('orderCustomerPhone')?.value || '',
    area: document.getElementById('orderArea')?.value || '',
    delivery_address: document.getElementById('orderDeliveryAddress')?.value || '',
    status: document.getElementById('orderStatus')?.value || 'draft',
    note: document.getElementById('orderNote')?.value || '',
    sync_status: 'pending'
  });
  const items = rows.map((row) => {
    const id = row.querySelector('.order-product-select')?.value || '';
    const p = bepsiProducts.find((x) => x.id === id) || bepsiProducts[0] || {};
    const quantity = Number(row.querySelector('.line-qty')?.value || 0);
    const unit_price = Number(row.querySelector('.line-price')?.value || p.wholesale_price || 0);
    const discount = Number(row.querySelector('.line-discount')?.value || 0);
    subtotal += quantity * unit_price; discount_total += discount;
    return makeOrderItem({ id: uid('order-item'), order_id: order.id, product_id: p.id, product_name: p.name, sku: p.sku, unit: p.unit, quantity, unit_price, discount, note: row.querySelector('.line-note')?.value || '' });
  }).filter((x) => x.product_name && Number(x.quantity) > 0);
  order.subtotal = subtotal; order.discount_total = discount_total; order.grand_total = Math.max(subtotal - discount_total, 0);
  if (!order.customer_name) throw new Error('Thieu ten khach hang.');
  if (!items.length) throw new Error('Don hang chua co san pham.');
  return { order, items };
}

async function saveOrderSafe(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  await loadBepsiProducts();
  const { order, items } = collectOrder();
  try {
    configureSupabaseV2();
    if (!isSupabaseV2Ready()) throw new Error('DB not ready');
    await syncOrder(order, items);
    order.sync_status = 'synced';
    toast('Da luu don hang len DB.');
  } catch (err) {
    order.sync_status = 'error';
    enqueueSync('order', { order, items });
    toast('Da luu don hang tren may, cho sync.');
  }
  upsertCachedRow(STORAGE_KEYS_V2.orders, { order, items });
  location.hash = '#dataSection';
  setTimeout(() => document.querySelector('[data-data-view="orders"]')?.click(), 50);
}

async function loadAiHistorySafe(event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  const box = document.getElementById('aiHistoryList');
  try {
    configureSupabaseV2();
    if (!isSupabaseV2Ready()) throw new Error('Chua cau hinh DB');
    const rows = await loadAiSummaries();
    cacheRows(STORAGE_KEYS_V2.aiSummaries, rows);
    if (box) box.innerHTML = rows.map((r) => `<article class="ai-history-card"><header><div><h3>${r.title || r.id}</h3><small>${r.created_at || ''}</small></div><span class="ai-pill">${r.status || 'draft'}</span></header><p class="ai-source-note">${r.result?.executive_summary || ''}</p></article>`).join('') || '<article class="empty-sync-card">Chua co bao cao AI.</article>';
    toast('Da tai lich su AI.');
  } catch (err) {
    const rows = readCachedRows(STORAGE_KEYS_V2.aiSummaries);
    if (box) box.innerHTML = rows.length ? rows.map((r) => `<article class="ai-history-card"><h3>${r.title || r.id}</h3><p class="ai-source-note">${r.result?.executive_summary || ''}</p></article>`).join('') : '<article class="empty-sync-card">AI DB loi, dang hien cache local.</article>';
    toast('Load AI DB loi, da hien cache local.');
  }
}

async function init() {
  ensureVisibleActions();
  document.addEventListener('click', async (event) => {
    const type = event.target.closest('[data-create-type]')?.dataset.createType;
    if (type === 'order') { event.preventDefault(); openPanel('orderFormPanel'); await loadBepsiProducts(); refreshOrderSelects(); }
    if (type === 'test') { setTimeout(() => openPanel('testFormPanel'), 300); }
    if (type === 'market') { setTimeout(() => openPanel('marketFormPanel'), 300); }
    if (event.target.closest('#loadBepsiProductsBtn')) { await seedBepsiToDb(); refreshOrderSelects(); }
  }, true);
  document.addEventListener('submit', (event) => { if (event.target?.id === 'orderForm') saveOrderSafe(event); }, true);
  document.addEventListener('click', (event) => { if (event.target.closest('#loadAiHistoryBtn')) loadAiHistorySafe(event); }, true);
  setTimeout(async () => {
    const productDialog = document.getElementById('productDialog .dialog-body') || document.querySelector('#productDialog .dialog-body');
    if (productDialog && !document.getElementById('loadBepsiProductsBtn')) productDialog.insertAdjacentHTML('beforeend', '<button type="button" class="primary" id="loadBepsiProductsBtn">Nap san pham Bep Si</button>');
    try { await loadBepsiProducts(); refreshOrderSelects(); } catch (e) { console.warn('Cannot load Bepsi products', e); }
  }, 900);
}

init();
