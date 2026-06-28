import {
  TABLES_V2,
  STORAGE_KEYS_V2,
  compactRow,
  assertRequired,
  makeCustomerMaster,
  makeOrder,
  makeOrderItem,
  makeOnaTest,
  makeOnaTestItem,
  makeMarketReport,
  makeMarketReportProduct,
  makeMarketReportCompetitor,
  makeAiSummary,
  makeExportRow
} from './data-model.js';

const PUBLIC_CONFIG = globalThis.BEPI_CONFIG || {};
const DEFAULT_SUPABASE_URL = PUBLIC_CONFIG.supabaseUrl || 'https://noiadkpkvdohljgopgfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = PUBLIC_CONFIG.supabaseAnonKey || 'sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66';
const EXPORT_BUCKET = 'report-exports';

let config = {
  supabaseUrl: DEFAULT_SUPABASE_URL,
  supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Không đọc được localStorage', key, error);
    return fallback;
  }
}

function normalizeSupabaseUrl(value = '') {
  const raw = String(value || '').trim();
  const match = raw.match(/dashboard\/project\/([a-z0-9]+)/i);
  if (match) return `https://${match[1]}.supabase.co`;
  if (!raw) return DEFAULT_SUPABASE_URL;
  return raw.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

export function readSupabaseSettings() {
  const legacy = readJson(STORAGE_KEYS_V2.settings, { settings: {} });
  return {
    supabaseUrl: normalizeSupabaseUrl(legacy.settings?.supabaseUrl || DEFAULT_SUPABASE_URL),
    supabaseAnonKey: String(legacy.settings?.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY).trim()
  };
}

export function configureSupabaseV2(next = {}) {
  const fromStorage = readSupabaseSettings();
  config = {
    supabaseUrl: normalizeSupabaseUrl(next.supabaseUrl || fromStorage.supabaseUrl || DEFAULT_SUPABASE_URL),
    supabaseAnonKey: String(next.supabaseAnonKey ?? fromStorage.supabaseAnonKey ?? DEFAULT_SUPABASE_ANON_KEY).trim()
  };
  return { ...config };
}

export function getSupabaseV2Config() {
  return { ...config };
}

export function isSupabaseV2Ready() {
  return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl || '') && Boolean(config.supabaseAnonKey);
}

export function assertSafePublicKey(key = config.supabaseAnonKey) {
  const value = String(key || '').trim();
  if (!value) throw new Error('Thiếu Supabase publishable/anon key.');
  if (/sb_secret_|service_role/i.test(value)) {
    throw new Error('Sai key: không dùng secret/service_role trong PWA. Chỉ dùng publishable/anon public key.');
  }
  return value;
}

function sbHeaders(extra = {}) {
  const key = assertSafePublicKey();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra
  };
}

async function sbFetch(path, options = {}) {
  configureSupabaseV2();
  assertSafePublicKey();
  if (!isSupabaseV2Ready()) throw new Error('Chưa cấu hình Supabase URL/key hợp lệ.');
  const url = `${config.supabaseUrl}/rest/v1/${path.replace(/^\/+/, '')}`;
  const res = await fetch(url, { ...options, headers: sbHeaders(options.headers || {}) });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data?.message || data?.error || `Supabase lỗi ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function sbSelect(table, query = '') {
  const suffix = query ? `?${query.replace(/^\?/, '')}` : '';
  return sbFetch(`${table}${suffix}`, { method: 'GET', headers: { Prefer: '' } });
}

export async function sbInsert(table, rows) {
  const payload = Array.isArray(rows) ? rows : [rows];
  return sbFetch(table, { method: 'POST', body: JSON.stringify(payload) });
}

export async function sbUpsert(table, rows, onConflict = 'id') {
  const payload = Array.isArray(rows) ? rows : [rows];
  return sbFetch(`${table}?on_conflict=${encodeURIComponent(onConflict)}`, {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload)
  });
}

export async function sbUpdate(table, id, patch) {
  return sbFetch(`${table}?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(compactRow({ ...patch, updated_at: new Date().toISOString() }))
  });
}

export async function loadProducts() {
  try {
    const rows = await sbSelect(TABLES_V2.products, 'select=*&active=eq.true&order=name.asc');
    localStorage.setItem(STORAGE_KEYS_V2.products, JSON.stringify(rows));
    return rows;
  } catch (error) {
    const cached = readJson(STORAGE_KEYS_V2.products, []);
    if (cached.length) return cached;
    throw error;
  }
}

export async function upsertCustomerFromPayload(payload = {}) {
  const name = payload.customer_name || payload.customer || payload.name;
  assertRequired({ name }, ['name'], 'khách hàng');
  const id = payload.customer_id || `cust-${String(name).trim().toLowerCase().replace(/\s+/g, '-')}-${payload.phone || payload.customer_phone || ''}`.replace(/[^a-z0-9-]/g, '');
  const row = makeCustomerMaster({
    id,
    name,
    phone: payload.customer_phone || payload.phone || null,
    area: payload.area || payload.market_area || null,
    source: payload.source || 'pwa',
    raw_payload: payload
  });
  const [saved] = await sbUpsert(TABLES_V2.customers, [row]);
  return saved || row;
}

export async function syncOrder(orderPayload, itemPayloads = []) {
  assertRequired(orderPayload, ['id', 'customer_name', 'order_date'], 'đơn hàng');
  const customer = await upsertCustomerFromPayload(orderPayload);
  const order = makeOrder({ ...orderPayload, customer_id: customer.id, sync_status: 'synced', synced_at: new Date().toISOString() });
  const items = itemPayloads.map((item, index) => makeOrderItem({ ...item, order_id: order.id, line_no: item.line_no || index + 1 }));
  await sbUpsert(TABLES_V2.orders, [order]);
  if (items.length) await sbUpsert(TABLES_V2.orderItems, items);
  return { order, items, customer };
}

export async function syncOnaTest(testPayload, itemPayloads = []) {
  assertRequired(testPayload, ['id', 'customer_name', 'test_date'], 'phiếu test');
  const customer = await upsertCustomerFromPayload(testPayload);
  const test = makeOnaTest({ ...testPayload, customer_id: customer.id, sync_status: 'synced', synced_at: new Date().toISOString() });
  const items = itemPayloads.map((item) => makeOnaTestItem({ ...item, test_id: test.id }));
  await sbUpsert(TABLES_V2.onaTests, [test]);
  if (items.length) await sbUpsert(TABLES_V2.onaTestItems, items);
  return { test, items, customer };
}

export async function syncMarketReport(reportPayload, productPayloads = [], competitorPayloads = []) {
  assertRequired(reportPayload, ['id', 'report_date'], 'báo cáo thị trường');
  const report = makeMarketReport({ ...reportPayload, sync_status: 'synced', synced_at: new Date().toISOString() });
  const products = productPayloads.map((item) => makeMarketReportProduct({ ...item, market_report_id: report.id }));
  const competitors = competitorPayloads.map((item) => makeMarketReportCompetitor({ ...item, market_report_id: report.id }));
  await sbUpsert(TABLES_V2.marketReports, [report]);
  if (products.length) await sbUpsert(TABLES_V2.marketReportProducts, products);
  if (competitors.length) await sbUpsert(TABLES_V2.marketReportCompetitors, competitors);
  return { report, products, competitors };
}

export async function saveAiSummary(summaryPayload = {}) {
  const row = makeAiSummary({ ...summaryPayload, sync_status: 'synced', synced_at: new Date().toISOString() });
  const [saved] = await sbUpsert(TABLES_V2.aiSummaries, [row]);
  return saved || row;
}

export async function syncAiSummary(summaryPayload = {}) {
  return saveAiSummary(summaryPayload);
}

export async function saveExportRow(exportPayload = {}) {
  const row = makeExportRow({ ...exportPayload, sync_status: 'synced', synced_at: new Date().toISOString() });
  const [saved] = await sbUpsert(TABLES_V2.exports, [row]);
  return saved || row;
}

export async function syncExport(exportPayload = {}) {
  return saveExportRow(exportPayload);
}

export async function uploadExportFile(path, blob, contentType = 'text/plain') {
  configureSupabaseV2();
  assertSafePublicKey();
  const url = `${config.supabaseUrl}/storage/v1/object/${EXPORT_BUCKET}/${encodeURIComponent(path)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: config.supabaseAnonKey,
      Authorization: `Bearer ${config.supabaseAnonKey}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: blob
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Storage lỗi ${res.status}`);
  return data;
}
