import { LOCAL_STORES, getAllLocal } from '../local-db.js';
import { isActiveBusinessRow } from './soft-delete.js';

const UNKNOWN = 'Chưa rõ';

function text(value = '', fallback = '') {
  const clean = String(value ?? '').trim();
  return clean || fallback;
}

function number(value = 0, fallback = 0) {
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const f = Number(fallback);
  return Number.isFinite(f) ? f : 0;
}

function dateValue(order = {}) {
  return text(order.order_date || order.date || order.created_at?.slice?.(0, 10));
}

function inDateRange(order = {}, filters = {}) {
  const date = dateValue(order);
  if (filters.date_from && date && date < filters.date_from) return false;
  if (filters.date_to && date && date > filters.date_to) return false;
  return true;
}

function isRevenueOrder(order = {}, filters = {}) {
  const status = text(order.status, 'draft');
  if (filters.include_cancelled !== true && !isActiveBusinessRow(order)) return false;
  if (filters.status && status !== filters.status) return false;
  if (filters.sales && text(order.sales) !== filters.sales) return false;
  if (filters.customer_id && text(order.customer_id) !== filters.customer_id) return false;
  if (filters.customer_name && !text(order.customer_name).toLowerCase().includes(String(filters.customer_name).toLowerCase())) return false;
  if (filters.route_name) {
    const route = routeNameOf(order);
    if (route !== filters.route_name) return false;
  }
  return inDateRange(order, filters);
}

function catalogOf(item = {}) {
  return item.raw_payload?.catalog_product || {};
}

function choicesOf(item = {}) {
  return item.raw_payload?.choices || {};
}

function choiceTextOf(item = {}) {
  return text(item.choice_text || item.flavor || Object.values(choicesOf(item)).filter(Boolean).join(' · '));
}

function industryKeyOf(item = {}) {
  const product = catalogOf(item);
  return text(item.industry_key || product.industry_key || item.category_key || product.category_key || 'khac');
}

function industryNameOf(item = {}) {
  const product = catalogOf(item);
  return text(item.industry || product.industry || item.category || product.category || 'Khác');
}

function categoryNameOf(item = {}) {
  const product = catalogOf(item);
  return text(item.category || product.category || industryNameOf(item), 'Khác');
}

function routeNameOf(order = {}) {
  return text(order.route_name || order.raw_payload?.mcp_route_name || order.area, UNKNOWN);
}

function routeIdOf(order = {}) {
  return text(order.route_id || order.raw_payload?.mcp_route_id || order.source_id || '');
}

function lineAmount(item = {}) {
  const quantity = number(item.quantity);
  const unitPrice = number(item.unit_price);
  return number(item.line_total, quantity * unitPrice);
}

function normalizeLine(order = {}, item = {}) {
  const amount = lineAmount(item);
  const quantity = number(item.quantity);
  return {
    order_id: order.id,
    order_code: text(order.order_code),
    order_date: dateValue(order),
    status: text(order.status, 'draft'),
    sales: text(order.sales, UNKNOWN),
    customer_id: text(order.customer_id),
    customer_name: text(order.customer_name, 'Khách lẻ'),
    customer_phone: text(order.customer_phone),
    area: text(order.area),
    route_id: routeIdOf(order),
    route_name: routeNameOf(order),
    product_id: text(item.product_id),
    sku: text(item.sku, 'NO-SKU'),
    product_name: text(item.product_name, 'Sản phẩm chưa rõ'),
    brand: text(item.brand || catalogOf(item).brand),
    industry_key: industryKeyOf(item),
    industry: industryNameOf(item),
    category: categoryNameOf(item),
    choice_text: choiceTextOf(item),
    unit: text(item.unit),
    quantity,
    unit_price: number(item.unit_price),
    line_total: amount,
    item,
    order
  };
}

function fallbackOrderLine(order = {}) {
  const amount = number(order.grand_total || order.subtotal);
  return {
    order_id: order.id,
    order_code: text(order.order_code),
    order_date: dateValue(order),
    status: text(order.status, 'draft'),
    sales: text(order.sales, UNKNOWN),
    customer_id: text(order.customer_id),
    customer_name: text(order.customer_name, 'Khách lẻ'),
    customer_phone: text(order.customer_phone),
    area: text(order.area),
    route_id: routeIdOf(order),
    route_name: routeNameOf(order),
    product_id: '',
    sku: 'NO-ITEM',
    product_name: 'Đơn chưa có dòng sản phẩm',
    brand: '',
    industry_key: 'khac',
    industry: 'Khác',
    category: 'Khác',
    choice_text: '',
    unit: '',
    quantity: 0,
    unit_price: 0,
    line_total: amount,
    item: null,
    order
  };
}

function buildDataset(orders = [], items = [], filters = {}) {
  const validOrders = orders.filter((order) => isRevenueOrder(order, filters));
  const orderMap = new Map(validOrders.map((order) => [order.id, order]));
  const lines = items
    .filter((item) => orderMap.has(item.order_id))
    .map((item) => normalizeLine(orderMap.get(item.order_id), item));

  const lineOrderIds = new Set(lines.map((line) => line.order_id));
  validOrders
    .filter((order) => !lineOrderIds.has(order.id) && number(order.grand_total || order.subtotal))
    .forEach((order) => lines.push(fallbackOrderLine(order)));

  const scopedLines = lines.filter((line) => {
    if (filters.industry_key && line.industry_key !== filters.industry_key) return false;
    if (filters.sku && line.sku !== filters.sku) return false;
    if (filters.product_id && line.product_id !== filters.product_id) return false;
    return true;
  });

  return { orders: validOrders, items, lines: scopedLines, filters };
}

export async function getOrderRevenueDataset(filters = {}) {
  const [orders, items] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.orderItems)
  ]);
  return buildDataset(orders, items, filters);
}

function sum(lines = [], field = 'line_total') {
  return lines.reduce((total, line) => total + number(line[field]), 0);
}

function uniqueCount(lines = [], field = '') {
  return new Set(lines.map((line) => line[field]).filter(Boolean)).size;
}

export function summarizeOrders(dataset = {}) {
  const lines = dataset.lines || [];
  const orderIds = new Set(lines.map((line) => line.order_id).filter(Boolean));
  const revenue = sum(lines);
  const orderCount = orderIds.size;
  return {
    revenue,
    order_count: orderCount,
    line_count: lines.length,
    quantity: sum(lines, 'quantity'),
    customer_count: uniqueCount(lines, 'customer_name'),
    sku_count: uniqueCount(lines, 'sku'),
    average_order_value: orderCount ? Math.round(revenue / orderCount) : 0
  };
}

function makeGroupSeed(key, label, extra = {}) {
  return {
    key: text(key, UNKNOWN),
    label: text(label || key, UNKNOWN),
    revenue: 0,
    quantity: 0,
    order_ids: new Set(),
    line_count: 0,
    ...extra
  };
}

function finalizeGroup(row) {
  return {
    ...row,
    order_count: row.order_ids.size,
    order_ids: [...row.order_ids],
    average_order_value: row.order_ids.size ? Math.round(row.revenue / row.order_ids.size) : 0
  };
}

function groupBy(lines = [], keyFn, labelFn, extraFn = () => ({})) {
  const map = new Map();
  lines.forEach((line) => {
    const key = text(keyFn(line), UNKNOWN);
    if (!map.has(key)) map.set(key, makeGroupSeed(key, labelFn(line), extraFn(line)));
    const row = map.get(key);
    row.revenue += number(line.line_total);
    row.quantity += number(line.quantity);
    row.line_count += 1;
    if (line.order_id) row.order_ids.add(line.order_id);
  });
  return [...map.values()].map(finalizeGroup).sort((a, b) => b.revenue - a.revenue);
}

export function groupRevenueByCustomer(dataset = {}) {
  return groupBy(dataset.lines || [],
    (line) => line.customer_id || line.customer_name,
    (line) => line.customer_name,
    (line) => ({ customer_id: line.customer_id, phone: line.customer_phone, area: line.area })
  );
}

export function groupRevenueByIndustry(dataset = {}) {
  return groupBy(dataset.lines || [],
    (line) => line.industry_key,
    (line) => line.industry,
    (line) => ({ industry_key: line.industry_key })
  );
}

export function groupRevenueBySku(dataset = {}) {
  return groupBy(dataset.lines || [],
    (line) => line.sku || line.product_name,
    (line) => line.sku || line.product_name,
    (line) => ({ sku: line.sku, product_id: line.product_id, product_name: line.product_name, industry: line.industry, category: line.category, unit: line.unit })
  );
}

export function groupRevenueByProduct(dataset = {}) {
  return groupBy(dataset.lines || [],
    (line) => line.product_id || line.product_name,
    (line) => line.product_name,
    (line) => ({ product_id: line.product_id, sku: line.sku, industry: line.industry, category: line.category, unit: line.unit })
  );
}

export function groupRevenueByRoute(dataset = {}) {
  return groupBy(dataset.lines || [],
    (line) => line.route_id || line.route_name,
    (line) => line.route_name,
    (line) => ({ route_id: line.route_id, area: line.area })
  );
}

export function groupRevenueBySales(dataset = {}) {
  return groupBy(dataset.lines || [],
    (line) => line.sales,
    (line) => line.sales
  );
}

export function buildRevenueSummary(dataset = {}) {
  return {
    kpis: summarizeOrders(dataset),
    by_customer: groupRevenueByCustomer(dataset),
    by_industry: groupRevenueByIndustry(dataset),
    by_sku: groupRevenueBySku(dataset),
    by_product: groupRevenueByProduct(dataset),
    by_route: groupRevenueByRoute(dataset),
    by_sales: groupRevenueBySales(dataset)
  };
}
