import { getOrderRevenueDataset, buildRevenueSummary } from './order-summary.js?v=revenue-1';

function text(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function number(value = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function csvCell(value = '') {
  const raw = text(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

function csv(rows = []) {
  return `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`;
}

function dateStamp() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${y}${m}${d}-${hh}${mm}`;
}

function saveCsv(filename, rows) {
  const blob = new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function summaryRows(summary = {}) {
  const k = summary.kpis || {};
  const rows = [
    ['Báo cáo doanh thu'],
    ['Chỉ số', 'Giá trị'],
    ['Tổng doanh thu', number(k.revenue)],
    ['Số đơn', number(k.order_count)],
    ['Số dòng sản phẩm', number(k.line_count)],
    ['Tổng số lượng', number(k.quantity)],
    ['Khách mua', number(k.customer_count)],
    ['SKU bán', number(k.sku_count)],
    ['Giá trị đơn TB', number(k.average_order_value)],
    [],
    ['Theo khách'],
    ['Khách hàng', 'Doanh thu', 'Số đơn', 'Số lượng', 'Khu vực/SĐT']
  ];
  (summary.by_customer || []).forEach((row) => rows.push([row.label, row.revenue, row.order_count, row.quantity, [row.area, row.phone].filter(Boolean).join(' · ')]));
  rows.push([], ['Theo ngành'], ['Ngành', 'Doanh thu', 'Số đơn', 'Số lượng', 'Mã ngành']);
  (summary.by_industry || []).forEach((row) => rows.push([row.label, row.revenue, row.order_count, row.quantity, row.industry_key || row.key]));
  rows.push([], ['Theo SKU'], ['SKU', 'Tên sản phẩm', 'Ngành', 'Doanh thu', 'Số đơn', 'Số lượng']);
  (summary.by_sku || []).forEach((row) => rows.push([row.sku || row.key, row.product_name || row.label, row.industry || '', row.revenue, row.order_count, row.quantity]));
  rows.push([], ['Theo tuyến'], ['Tuyến', 'Doanh thu', 'Số đơn', 'Số lượng', 'Khu vực']);
  (summary.by_route || []).forEach((row) => rows.push([row.label, row.revenue, row.order_count, row.quantity, row.area || '']));
  rows.push([], ['Theo sales'], ['Sales', 'Doanh thu', 'Số đơn', 'Số lượng']);
  (summary.by_sales || []).forEach((row) => rows.push([row.label, row.revenue, row.order_count, row.quantity]));
  return rows;
}

function detailRows(dataset = {}) {
  return [
    ['Mã đơn', 'Ngày', 'Khách hàng', 'SĐT', 'Khu vực', 'Tuyến', 'Sales', 'SKU', 'Sản phẩm', 'Vị/Phân loại', 'Ngành', 'Danh mục', 'ĐVT', 'Số lượng', 'Đơn giá', 'Thành tiền', 'Trạng thái'],
    ...(dataset.lines || []).map((line) => [
      line.order_code,
      line.order_date,
      line.customer_name,
      line.customer_phone,
      line.area,
      line.route_name,
      line.sales,
      line.sku,
      line.product_name,
      line.choice_text,
      line.industry,
      line.category,
      line.unit,
      line.quantity,
      line.unit_price,
      line.line_total,
      line.status
    ])
  ];
}

export async function exportRevenueSummaryCsv(filters = {}) {
  const dataset = await getOrderRevenueDataset(filters);
  const summary = buildRevenueSummary(dataset);
  saveCsv(`doanh-thu-tong-hop-${dateStamp()}.csv`, summaryRows(summary));
  return summary.kpis || {};
}

export async function exportOrderDetailCsv(filters = {}) {
  const dataset = await getOrderRevenueDataset(filters);
  saveCsv(`don-hang-chi-tiet-${dateStamp()}.csv`, detailRows(dataset));
  return { line_count: dataset.lines?.length || 0 };
}
