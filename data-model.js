export const STORAGE_KEYS_V2 = Object.freeze({
  settings: 'bepi-field-report-v5',
  products: 'bepi-v2-products',
  customers: 'bepi-v2-customers',
  orders: 'bepi-v2-orders',
  onaTests: 'bepi-v2-ona-tests',
  marketReports: 'bepi-v2-market-reports',
  aiSummaries: 'bepi-v2-ai-summaries',
  syncQueue: 'bepi-v2-sync-queue'
});

export const TABLES_V2 = Object.freeze({
  products: 'products',
  customers: 'customers_master',
  orders: 'orders',
  orderItems: 'order_items',
  onaTests: 'ona_tests',
  onaTestItems: 'ona_test_items',
  marketReports: 'market_reports',
  marketReportProducts: 'market_report_products',
  marketReportCompetitors: 'market_report_competitors',
  aiSummaries: 'ai_summaries',
  exports: 'exports'
});

export const ORDER_STATUSES = Object.freeze([
  'draft',
  'pending_confirm',
  'confirmed',
  'delivering',
  'delivered',
  'cancelled'
]);

export const TEST_STATUSES = Object.freeze([
  'pending',
  'ok',
  'interested',
  'sample',
  'follow',
  'bad',
  'retry'
]);

export const DEFAULT_ONA_PRODUCTS = Object.freeze([
  { id: 'prod-tra-den', sku: 'TRA-DEN', name: 'Trà Đen', category: 'Trà ONA', unit: 'gói' },
  { id: 'prod-tra-qua-mong', sku: 'TRA-QUA-MONG', name: 'Trà Quả Mộng', category: 'Trà ONA', unit: 'gói' },
  { id: 'prod-tra-gao-rang', sku: 'TRA-GAO-RANG', name: 'Trà Gạo Rang', category: 'Trà ONA', unit: 'gói' },
  { id: 'prod-tra-lai', sku: 'TRA-LAI', name: 'Trà Lài', category: 'Trà ONA', unit: 'gói' },
  { id: 'prod-tra-olong', sku: 'TRA-OLONG', name: 'Trà Olong', category: 'Trà ONA', unit: 'gói' },
  { id: 'prod-tra-olong-sen', sku: 'TRA-OLONG-SEN', name: 'Trà Olong Sen', category: 'Trà ONA', unit: 'gói' }
]);

export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

export function nowIso() {
  return new Date().toISOString();
}

export function cleanText(value = '') {
  return String(value ?? '').trim();
}

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function keepStatus(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

export function makeProduct(input = {}) {
  const name = cleanText(input.name);
  return {
    id: input.id || uid('prod'),
    source: cleanText(input.source) || 'manual',
    external_id: cleanText(input.external_id),
    sku: cleanText(input.sku),
    name,
    category: cleanText(input.category),
    brand: cleanText(input.brand),
    unit: cleanText(input.unit),
    wholesale_price: toNumber(input.wholesale_price),
    retail_price: toNumber(input.retail_price),
    active: input.active !== false,
    raw_payload: input.raw_payload || {},
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso()
  };
}

export function makeCustomerMaster(input = {}) {
  return {
    id: input.id || uid('cus'),
    name: cleanText(input.name || input.customer_name),
    phone: cleanText(input.phone || input.customer_phone),
    area: cleanText(input.area),
    address: cleanText(input.address || input.delivery_address),
    shop_type: cleanText(input.shop_type),
    note: cleanText(input.note),
    tags: Array.isArray(input.tags) ? input.tags.map(cleanText).filter(Boolean) : [],
    raw_payload: input.raw_payload || input,
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso()
  };
}

export function makeOrder(input = {}) {
  const subtotal = toNumber(input.subtotal);
  const discountTotal = toNumber(input.discount_total);
  return {
    id: input.id || uid('order'),
    order_code: cleanText(input.order_code),
    order_date: input.order_date || input.date || todayIsoDate(),
    sales: cleanText(input.sales),
    customer_id: cleanText(input.customer_id),
    customer_name: cleanText(input.customer_name),
    customer_phone: cleanText(input.customer_phone),
    area: cleanText(input.area),
    delivery_address: cleanText(input.delivery_address),
    source_type: cleanText(input.source_type) || 'manual',
    source_id: cleanText(input.source_id),
    status: keepStatus(input.status, ORDER_STATUSES, 'draft'),
    subtotal,
    discount_total: discountTotal,
    grand_total: toNumber(input.grand_total, Math.max(subtotal - discountTotal, 0)),
    note: cleanText(input.note),
    sync_status: cleanText(input.sync_status) || 'pending',
    raw_payload: input.raw_payload || input,
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso(),
    synced_at: input.synced_at || null
  };
}

export function makeOrderItem(input = {}) {
  const quantity = toNumber(input.quantity, 1);
  const unitPrice = toNumber(input.unit_price);
  const discount = toNumber(input.discount);
  return {
    id: input.id || uid('order-item'),
    order_id: cleanText(input.order_id),
    product_id: cleanText(input.product_id),
    product_name: cleanText(input.product_name || input.name),
    sku: cleanText(input.sku),
    unit: cleanText(input.unit),
    quantity,
    unit_price: unitPrice,
    discount,
    line_total: toNumber(input.line_total, Math.max(quantity * unitPrice - discount, 0)),
    note: cleanText(input.note),
    raw_payload: input.raw_payload || input,
    created_at: input.created_at || nowIso()
  };
}

export function makeOnaTest(input = {}) {
  return {
    id: input.id || uid('ona-test'),
    test_date: input.test_date || input.date || todayIsoDate(),
    sales: cleanText(input.sales),
    customer_id: cleanText(input.customer_id),
    customer_name: cleanText(input.customer_name),
    customer_phone: cleanText(input.customer_phone),
    area: cleanText(input.area),
    shop_type: cleanText(input.shop_type),
    test_type: cleanText(input.test_type) || 'Trà ONA Test',
    follow_date: input.follow_date || null,
    need_sample: Boolean(input.need_sample),
    overall_status: cleanText(input.overall_status) || 'draft',
    overall_note: cleanText(input.overall_note || input.note),
    sync_status: cleanText(input.sync_status) || 'pending',
    raw_payload: input.raw_payload || input,
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso(),
    synced_at: input.synced_at || null
  };
}

export function makeOnaTestItem(input = {}) {
  return {
    id: input.id || uid('ona-test-item'),
    test_id: cleanText(input.test_id),
    product_id: cleanText(input.product_id),
    product_name: cleanText(input.product_name || input.name),
    status: keepStatus(input.status, TEST_STATUSES, 'pending'),
    note: cleanText(input.note),
    created_at: input.created_at || nowIso()
  };
}

export function makeMarketReport(input = {}) {
  return {
    id: input.id || uid('market-report'),
    report_date: input.report_date || input.date || todayIsoDate(),
    sales: cleanText(input.sales),
    market_area: cleanText(input.market_area || input.area),
    route_name: cleanText(input.route_name),
    market_type: cleanText(input.market_type),
    total_shops: Math.max(0, Math.trunc(toNumber(input.total_shops))),
    competitor_summary: cleanText(input.competitor_summary),
    price_summary: cleanText(input.price_summary),
    demand_summary: cleanText(input.demand_summary),
    company_product_summary: cleanText(input.company_product_summary),
    opportunity_summary: cleanText(input.opportunity_summary),
    risk_summary: cleanText(input.risk_summary),
    next_action: cleanText(input.next_action),
    note: cleanText(input.note),
    sync_status: cleanText(input.sync_status) || 'pending',
    raw_payload: input.raw_payload || input,
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso(),
    synced_at: input.synced_at || null
  };
}

export function makeMarketReportProduct(input = {}) {
  return {
    id: input.id || uid('market-product'),
    market_report_id: cleanText(input.market_report_id),
    product_id: cleanText(input.product_id),
    product_name: cleanText(input.product_name || input.name),
    company_product: input.company_product !== false,
    market_position: cleanText(input.market_position),
    feedback: cleanText(input.feedback),
    opportunity_level: cleanText(input.opportunity_level),
    risk_level: cleanText(input.risk_level),
    note: cleanText(input.note),
    created_at: input.created_at || nowIso()
  };
}

export function makeMarketReportCompetitor(input = {}) {
  return {
    id: input.id || uid('market-competitor'),
    market_report_id: cleanText(input.market_report_id),
    competitor_name: cleanText(input.competitor_name || input.name),
    product_line: cleanText(input.product_line),
    price_range: cleanText(input.price_range),
    strength: cleanText(input.strength),
    weakness: cleanText(input.weakness),
    note: cleanText(input.note),
    created_at: input.created_at || nowIso()
  };
}

export function makeAiSummary(input = {}) {
  return {
    id: input.id || uid('ai-summary'),
    title: cleanText(input.title),
    summary_type: cleanText(input.summary_type) || 'company_report',
    date_from: input.date_from || null,
    date_to: input.date_to || null,
    sales: cleanText(input.sales),
    market_area: cleanText(input.market_area),
    source_filters: input.source_filters || {},
    source_refs: Array.isArray(input.source_refs) ? input.source_refs : [],
    result: input.result || {},
    status: cleanText(input.status) || 'draft',
    agent_id: cleanText(input.agent_id),
    agent_name: cleanText(input.agent_name),
    note: cleanText(input.note),
    created_at: input.created_at || nowIso(),
    updated_at: input.updated_at || nowIso()
  };
}

export function makeExportRow(input = {}) {
  return {
    id: input.id || uid('export'),
    source_type: cleanText(input.source_type),
    source_id: cleanText(input.source_id),
    export_type: cleanText(input.export_type),
    file_path: cleanText(input.file_path),
    file_url: cleanText(input.file_url),
    title: cleanText(input.title),
    note: cleanText(input.note),
    created_at: input.created_at || nowIso()
  };
}

export function compactRow(row) {
  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => value !== undefined)
  );
}

export function assertRequired(row, fields, label = 'Dữ liệu') {
  const missing = fields.filter((field) => row[field] === null || row[field] === undefined || row[field] === '');
  if (missing.length) throw new Error(`${label} thiếu trường: ${missing.join(', ')}`);
  return row;
}
