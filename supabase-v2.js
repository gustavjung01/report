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

const DEFAULT_SUPABASE_URL = 'https://aumcufisjmlmwywoogug.supabase.co';
const EXPORT_BUCKET = 'report-exports';
const NETWORK_ERROR_COOLDOWN_MS = 2 * 60 * 1000;

let config = {
  supabaseUrl: DEFAULT_SUPABASE_URL,
  supabaseAnonKey: ''
};

let networkFailure = {
  url: '',
  until: 0,
  message: ''
};

const selectInFlight = new Map();

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
  const dashboard = raw.match(/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboard) return `https://${dashboard[1]}.supabase.co`;
  if (!raw) return DEFAULT_SUPABASE_URL;
  if (/^[a-z0-9]{15,40}$/i.test(raw)) return `https://${raw}.supabase.co`;
  if (/^[a-z0-9-]+\.supabase\.co/i.test(raw)) return `https://${raw}`.replace(/\/+$/, '');
  try {
    const url = new URL(raw);
    if (url.hostname.endsWith('.supabase.co')) return `${url.protocol}//${url.hostname}`.replace(/\/+$/, '');
  } catch {}
  return raw.replace(/\/+$/, '');
}

function networkCooldownActive() {
  return networkFailure.url === config.supabaseUrl && Date.now() < Number(networkFailure.until || 0);
}

function networkCooldownMessage() {
  const seconds = Math.max(1, Math.ceil((Number(networkFailure.until || 0) - Date.now()) / 1000));
  return `Supabase chưa truy cập được (${networkFailure.message || 'lỗi mạng/DNS'}). App tạm ngưng gọi DB ${seconds}s để tránh spam lỗi.`;
}

function rememberNetworkFailure(error) {
  networkFailure = {
    url: config.supabaseUrl,
    until: Date.now() + NETWORK_ERROR_COOLDOWN_MS,
    message: error?.message || String(error || 'Network error')
  };
}

function clearNetworkFailure() {
  if (networkFailure.url === config.supabaseUrl) networkFailure = { url: '', until: 0, message: '' };
}

export function readSupabaseSettings() {
  const legacy = readJson(STORAGE_KEYS_V2.settings, { settings: {} });
  return {
    supabaseUrl: normalizeSupabaseUrl(legacy.settings?.supabaseUrl || DEFAULT_SUPABASE_URL),
    supabaseAnonKey: String(legacy.settings?.supabaseAnonKey || '').trim()
  };
}

export function configureSupabaseV2(next = {}) {
  const fromStorage = readSupabaseSettings();
  const nextConfig = {
    supabaseUrl: normalizeSupabaseUrl(next.supabaseUrl || fromStorage.supabaseUrl || DEFAULT_SUPABASE_URL),
    supabaseAnonKey: String(next.supabaseAnonKey ?? fromStorage.supabaseAnonKey ?? '').trim()
  };
  if (nextConfig.supabaseUrl !== config.supabaseUrl || nextConfig.supabaseAnonKey !== config.supabaseAnonKey) {
    selectInFlight.clear();
    networkFailure = { url: '', until: 0, message: '' };
  }
  config = nextConfig;
  return { ...config };
}

export function getSupabaseV2Config() {
  return { ...config };
}

export function getSupabaseNetworkState() {
  return {
    blocked: networkCooldownActive(),
    message: networkCooldownActive() ? networkCooldownMessage() : '',
    url: networkFailure.url,
    retryAt: networkFailure.until || 0
  };
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
    ...extra
  };
}

function tableUrl(table, query = '') {
  const suffix = query ? `?${query.replace(/^\?/, '')}` : '';
  return `${config.supabaseUrl}/rest/v1/${table}${suffix}`;
}

async function parseMaybeJson(response) {
  const text = await response.text();
  if (!text) return null;
  try { return JSON.parse(text); }
  catch { return text; }
}

async function sbFetch(url, options = {}) {
  if (!isSupabaseV2Ready()) throw new Error('Thiếu Supabase URL/key.');
  if (networkCooldownActive()) throw new Error(networkCooldownMessage());

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        ...sbHeaders(),
        ...(options.headers || {})
      }
    });
    clearNetworkFailure();
  } catch (error) {
    rememberNetworkFailure(error);
    throw new Error(`Không truy cập được Supabase Project URL: ${config.supabaseUrl}. Kiểm tra Project URL, project có bị pause/deleted không, hoặc DNS/mạng máy đang chặn Supabase.`);
  }

  if (!response.ok) {
    const detail = await parseMaybeJson(response);
    const message = typeof detail === 'string' ? detail : detail?.message || detail?.hint || JSON.stringify(detail);
    throw new Error(message || `Supabase lỗi ${response.status}`);
  }

  return response;
}

export async function sbSelect(table, query = 'select=*') {
  const url = tableUrl(table, query);
  const key = `GET ${url}`;
  if (selectInFlight.has(key)) return selectInFlight.get(key);
  const promise = sbFetch(url, { method: 'GET' })
    .then((response) => parseMaybeJson(response) || [])
    .finally(() => selectInFlight.delete(key));
  selectInFlight.set(key, promise);
  return promise;
}

export async function sbInsert(table, rows) {
  const payload = Array.isArray(rows) ? rows : [rows];
  if (!payload.length) return [];
  const response = await sbFetch(tableUrl(table), {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(payload.map(compactRow))
  });
  return parseMaybeJson(response) || [];
}

export async function sbUpsert(table, rows, conflict = 'id') {
  const payload = Array.isArray(rows) ? rows : [rows];
  if (!payload.length) return [];
  const response = await sbFetch(tableUrl(table, `on_conflict=${encodeURIComponent(conflict)}`), {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(payload.map(compactRow))
  });
  return parseMaybeJson(response) || [];
}

export async function sbDelete(table, query) {
  await sbFetch(tableUrl(table, query), { method: 'DELETE' });
  return true;
}

export async function syncCustomerMaster(input) {
  const customer = assertRequired(makeCustomerMaster(input), ['id', 'name'], 'Khách hàng');
  const [saved] = await sbUpsert(TABLES_V2.customers, [customer]);
  return saved || customer;
}

export async function syncOrder(orderInput, itemInputs = []) {
  const order = assertRequired(makeOrder(orderInput), ['id', 'order_date'], 'Đơn hàng');
  const items = itemInputs.map((item) => assertRequired(makeOrderItem({ ...item, order_id: order.id }), ['id', 'order_id', 'product_name'], 'Dòng đơn hàng'));

  if (order.customer_name) {
    await syncCustomerMaster({
      id: order.customer_id || `cus-${order.id}`,
      name: order.customer_name,
      phone: order.customer_phone,
      area: order.area,
      address: order.delivery_address,
      raw_payload: order.raw_payload
    });
    order.customer_id = order.customer_id || `cus-${order.id}`;
  }

  const [savedOrder] = await sbUpsert(TABLES_V2.orders, [order]);
  await sbDelete(TABLES_V2.orderItems, `order_id=eq.${encodeURIComponent(order.id)}`);
  if (items.length) await sbInsert(TABLES_V2.orderItems, items);
  return { order: savedOrder || order, items };
}

export async function syncOnaTest(testInput, itemInputs = []) {
  const test = assertRequired(makeOnaTest(testInput), ['id', 'test_date'], 'Phiếu test');
  const items = itemInputs.map((item) => assertRequired(makeOnaTestItem({ ...item, test_id: test.id }), ['id', 'test_id', 'product_name'], 'Dòng test'));

  if (test.customer_name) {
    await syncCustomerMaster({
      id: test.customer_id || `cus-${test.id}`,
      name: test.customer_name,
      phone: test.customer_phone,
      area: test.area,
      shop_type: test.shop_type,
      raw_payload: test.raw_payload
    });
    test.customer_id = test.customer_id || `cus-${test.id}`;
  }

  const [savedTest] = await sbUpsert(TABLES_V2.onaTests, [test]);
  await sbDelete(TABLES_V2.onaTestItems, `test_id=eq.${encodeURIComponent(test.id)}`);
  if (items.length) await sbInsert(TABLES_V2.onaTestItems, items);
  return { test: savedTest || test, items };
}

export async function syncMarketReport(reportInput, productInputs = [], competitorInputs = []) {
  const report = assertRequired(makeMarketReport(reportInput), ['id', 'report_date'], 'Báo cáo thị trường');
  const products = productInputs.map((item) => assertRequired(makeMarketReportProduct({ ...item, market_report_id: report.id }), ['id', 'market_report_id', 'product_name'], 'Sản phẩm trong báo cáo'));
  const competitors = competitorInputs.map((item) => assertRequired(makeMarketReportCompetitor({ ...item, market_report_id: report.id }), ['id', 'market_report_id', 'competitor_name'], 'Đối thủ trong báo cáo'));

  const [savedReport] = await sbUpsert(TABLES_V2.marketReports, [report]);
  await sbDelete(TABLES_V2.marketReportProducts, `market_report_id=eq.${encodeURIComponent(report.id)}`);
  await sbDelete(TABLES_V2.marketReportCompetitors, `market_report_id=eq.${encodeURIComponent(report.id)}`);
  if (products.length) await sbInsert(TABLES_V2.marketReportProducts, products);
  if (competitors.length) await sbInsert(TABLES_V2.marketReportCompetitors, competitors);
  return { report: savedReport || report, products, competitors };
}

export async function syncAiSummary(input) {
  const summary = assertRequired(makeAiSummary(input), ['id'], 'AI summary');
  const [saved] = await sbUpsert(TABLES_V2.aiSummaries, [summary]);
  return saved || summary;
}

export async function syncExport(input) {
  const row = assertRequired(makeExportRow(input), ['id', 'source_type', 'source_id', 'export_type'], 'Export');
  const [saved] = await sbUpsert(TABLES_V2.exports, [row]);
  return saved || row;
}

export async function loadProducts({ activeOnly = true } = {}) {
  const query = activeOnly ? 'select=*&active=eq.true&order=name.asc' : 'select=*&order=name.asc';
  return sbSelect(TABLES_V2.products, query);
}

export async function loadOrders(query = 'select=*&order=order_date.desc,created_at.desc') {
  return sbSelect(TABLES_V2.orders, query);
}

export async function loadOnaTests(query = 'select=*&order=test_date.desc,created_at.desc') {
  return sbSelect(TABLES_V2.onaTests, query);
}

export async function loadMarketReports(query = 'select=*&order=report_date.desc,created_at.desc') {
  return sbSelect(TABLES_V2.marketReports, query);
}

export async function loadAiSummaries(query = 'select=*&order=created_at.desc') {
  return sbSelect(TABLES_V2.aiSummaries, query);
}

export async function uploadExportBlob(blob, path, contentType = 'application/octet-stream') {
  const key = assertSafePublicKey();
  const cleanPath = String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/');
  if (!cleanPath) throw new Error('Thiếu đường dẫn file export.');
  if (networkCooldownActive()) throw new Error(networkCooldownMessage());

  const uploadUrl = `${config.supabaseUrl}/storage/v1/object/${EXPORT_BUCKET}/${cleanPath}`;
  let response;
  try {
    response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'x-upsert': 'true',
        'Content-Type': contentType
      },
      body: blob
    });
    clearNetworkFailure();
  } catch (error) {
    rememberNetworkFailure(error);
    throw new Error(`Không truy cập được Supabase Storage: ${config.supabaseUrl}.`);
  }

  if (!response.ok) throw new Error(await response.text());
  return `${config.supabaseUrl}/storage/v1/object/public/${EXPORT_BUCKET}/${cleanPath}`;
}

configureSupabaseV2();
