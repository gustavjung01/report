import { LOCAL_STORES, getAllLocal, putLocal, localStats } from '../local-db.js';

let cfg = { supabaseUrl: '', supabaseKey: '', loaded: false };
let syncing = false;

const MCP_ROUTE_COLUMNS = ['id', 'route_name', 'weekday', 'area', 'distributor_id', 'active', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const MCP_ROUTE_CUSTOMER_COLUMNS = ['id', 'route_id', 'customer_id', 'customer_name', 'phone', 'area', 'address', 'sort_order', 'active', 'note', 'geo_lat', 'geo_lng', 'geo_accuracy', 'geo_captured_at', 'geo_source', 'google_maps_url', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const MCP_ROUTE_SESSION_COLUMNS = ['id', 'route_id', 'route_name', 'session_date', 'weekday', 'sales', 'area', 'status', 'planned_customers', 'visited_customers', 'order_count', 'test_count', 'report_count', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const MCP_VISIT_COLUMNS = ['id', 'session_id', 'route_id', 'route_customer_id', 'visit_date', 'status', 'has_order', 'has_test', 'has_report', 'order_id', 'test_id', 'report_id', 'checkin_at', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const ORDER_COLUMNS = ['id', 'order_code', 'order_date', 'sales', 'customer_id', 'customer_name', 'customer_phone', 'area', 'delivery_address', 'source_type', 'source_id', 'status', 'subtotal', 'discount_total', 'grand_total', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];
const ORDER_ITEM_COLUMNS = ['id', 'order_id', 'product_id', 'product_name', 'sku', 'unit', 'quantity', 'unit_price', 'discount', 'line_total', 'note', 'raw_payload', 'created_at'];
const MARKET_REPORT_COLUMNS = ['id', 'report_date', 'sales', 'market_area', 'route_name', 'market_type', 'total_shops', 'competitor_summary', 'price_summary', 'demand_summary', 'company_product_summary', 'opportunity_summary', 'risk_summary', 'next_action', 'note', 'sync_status', 'raw_payload', 'created_at', 'updated_at', 'synced_at'];

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2600);
}

function setSyncButtonBusy(isBusy) {
  const button = document.querySelector('#syncBtn');
  if (!button) return;
  button.disabled = isBusy;
  button.textContent = isBusy ? 'Đang sync...' : 'Đồng bộ';
}

function setSyncState(label, online = false) {
  const state = document.querySelector('#syncState');
  if (!state) return;
  state.className = `sync-state ${online ? 'online' : 'error'}`;
  state.innerHTML = `<span></span><b>${label}</b>`;
}

function setAdminInfo(message) {
  const info = document.querySelector('#dbInfo');
  if (info) info.textContent = message;
}

async function refreshAdminStats(extra = '') {
  const element = document.querySelector('#adminStats');
  if (!element) return;
  const stats = await localStats();
  const lines = [
    `Tổng local: ${stats.records}`,
    `Hàng đợi sync: ${stats.pending}`,
    `Lỗi sync: ${stats.error}`
  ];
  if (extra) lines.push(extra);
  element.innerHTML = lines.map((line) => String(line)).join('<br>');
}

async function loadConfig() {
  if (cfg.loaded) return cfg;
  try {
    const response = await fetch('/api/config', { cache: 'no-store' });
    if (response.ok) {
      const json = await response.json();
      cfg.supabaseUrl = String(json.supabaseUrl || '').replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
      cfg.supabaseKey = String(json.supabaseKey || '');
    }
  } catch (error) {
    console.warn('business sync config failed', error);
  }
  cfg.loaded = true;
  return cfg;
}

function hasSupabase() {
  return Boolean(cfg.supabaseUrl && cfg.supabaseKey && navigator.onLine);
}

function apiUrl(table) {
  return `${cfg.supabaseUrl}/rest/v1/${table}?on_conflict=id`;
}

function headers() {
  return {
    apikey: cfg.supabaseKey,
    Authorization: `Bearer ${cfg.supabaseKey}`,
    'Content-Type': 'application/json',
    Prefer: 'resolution=merge-duplicates,return=minimal'
  };
}

function nowIso() {
  return new Date().toISOString();
}

function needsSync(row = {}) {
  if (row.sync_status !== 'synced' || !row.synced_at) return true;
  const changedAt = row.updated_at || row.created_at || '';
  return Boolean(changedAt && String(changedAt) > String(row.synced_at));
}

function pickColumns(row = {}, columns = [], syncedAt = '') {
  return columns.reduce((record, column) => {
    let value = row[column];
    if (column === 'sync_status') value = 'synced';
    if (column === 'synced_at') value = syncedAt;
    if (value === undefined) value = null;
    record[column] = value;
    return record;
  }, {});
}

function markSynced(row = {}, syncedAt = '') {
  return {
    ...row,
    sync_status: 'synced',
    synced_at: syncedAt
  };
}

async function upsert(table, rows) {
  if (!rows.length) return 0;
  const response = await fetch(apiUrl(table), {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(rows)
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${table}: ${response.status} ${text}`);
  }
  return rows.length;
}

async function syncStore({ store, table, columns, label }) {
  const rows = (await getAllLocal(store)).filter(needsSync);
  if (!rows.length) return { label, count: 0 };
  const syncedAt = nowIso();
  await upsert(table, rows.map((row) => pickColumns(row, columns, syncedAt)));
  for (const row of rows) await putLocal(store, markSynced(row, syncedAt));
  return { label, count: rows.length };
}

async function syncMcp() {
  const groups = [
    { store: LOCAL_STORES.mcpRoutes, table: 'mcp_routes', columns: MCP_ROUTE_COLUMNS, label: 'tuyến' },
    { store: LOCAL_STORES.mcpRouteCustomers, table: 'mcp_route_customers', columns: MCP_ROUTE_CUSTOMER_COLUMNS, label: 'khách tuyến' },
    { store: LOCAL_STORES.mcpRouteSessions, table: 'mcp_route_sessions', columns: MCP_ROUTE_SESSION_COLUMNS, label: 'phiên tuyến' },
    { store: LOCAL_STORES.mcpVisits, table: 'mcp_visits', columns: MCP_VISIT_COLUMNS, label: 'lượt ghé' }
  ];
  const results = [];
  for (const group of groups) results.push(await syncStore(group));
  return results;
}

async function syncOrders() {
  const [orders, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems)
  ]);
  const pendingOrders = orders.filter(needsSync);
  if (!pendingOrders.length) return [{ label: 'đơn', count: 0 }, { label: 'dòng đơn', count: 0 }];

  const syncedAt = nowIso();
  const orderIds = new Set(pendingOrders.map((order) => order.id));
  const scopedItems = items.filter((item) => orderIds.has(item.order_id));
  await upsert('orders', pendingOrders.map((order) => pickColumns(order, ORDER_COLUMNS, syncedAt)));
  await upsert('order_items', scopedItems.map((item) => pickColumns(item, ORDER_ITEM_COLUMNS, syncedAt)));
  for (const order of pendingOrders) await putLocal(LOCAL_STORES.orders, markSynced(order, syncedAt));
  return [{ label: 'đơn', count: pendingOrders.length }, { label: 'dòng đơn', count: scopedItems.length }];
}

async function syncReports() {
  return [await syncStore({ store: LOCAL_STORES.marketReports, table: 'market_reports', columns: MARKET_REPORT_COLUMNS, label: 'báo cáo' })];
}

function summarize(results = []) {
  const flat = results.flat();
  const total = flat.reduce((sum, item) => sum + Number(item.count || 0), 0);
  const detail = flat.filter((item) => item.count).map((item) => `${item.count} ${item.label}`).join(' · ');
  return { total, detail: detail || 'không có dòng mới' };
}

export async function syncBusinessNow({ silent = false } = {}) {
  if (syncing) return { total: 0, detail: 'đang sync' };
  syncing = true;
  setSyncButtonBusy(true);
  try {
    await loadConfig();
    if (!hasSupabase()) {
      setSyncState('Local DB', false);
      setAdminInfo('Thiếu Supabase env hoặc đang offline. Dữ liệu vẫn lưu máy.');
      if (!silent) toast('Chưa có Supabase env hoặc đang offline.');
      await refreshAdminStats();
      return { total: 0, detail: 'offline' };
    }

    setSyncState('Supabase', true);
    setAdminInfo(`Đã nối Supabase\n${cfg.supabaseUrl}`);
    const results = [];
    results.push(await syncMcp());
    results.push(await syncOrders());
    results.push(await syncReports());
    const summary = summarize(results);
    await refreshAdminStats(`Business sync: ${summary.detail}`);
    if (!silent) toast(`Đã sync business: ${summary.detail}.`);
    window.dispatchEvent(new CustomEvent('mcp:session-changed'));
    window.dispatchEvent(new CustomEvent('report:changed'));
    window.dispatchEvent(new CustomEvent('order:changed'));
    return summary;
  } catch (error) {
    console.warn('business sync failed', error);
    setAdminInfo(`Lỗi sync business: ${error.message}`);
    await refreshAdminStats('Business sync: lỗi');
    if (!silent) toast('Sync business lỗi. Xem Admin để biết thêm.');
    return { total: 0, detail: 'error', error };
  } finally {
    syncing = false;
    setSyncButtonBusy(false);
  }
}

function handleSyncClick(event) {
  if (!event.target.closest('#syncBtn')) return;
  syncBusinessNow().catch((error) => {
    console.warn('business sync click failed', error);
    toast('Sync business lỗi.');
  });
}

async function boot() {
  await loadConfig();
  setSyncState(hasSupabase() ? 'Supabase' : 'Local DB', hasSupabase());
  setAdminInfo(hasSupabase() ? `Đã nối Supabase\n${cfg.supabaseUrl}` : 'Thiếu Supabase env hoặc đang offline.');
}

document.addEventListener('click', handleSyncClick);
window.bepSiSyncBusiness = syncBusinessNow;
boot();
window.addEventListener('DOMContentLoaded', boot);
