import { makeMcpRoute, makeMcpRouteCustomer, nowIso } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal } from '../local-db.js';
import { getActiveMcpSessionDetail, recalcMcpRouteSession } from './mcp-core.js';

const IMPORT_SAMPLE = `route_name	weekday	customer_name	phone	area	address	sort_order	note	geo_lat	geo_lng	google_maps_url
Tuyến A	1	Quán Minh Anh	0909000001	Chợ Lớn	12 Nguyễn Trãi	1	Ghé sáng	10.762622	106.660172	
Tuyến A	1	Tạp hoá Cô Lan	0909000002	Chợ Lớn	34 Trần Hưng Đạo	2	`;

let lastPlan = null;

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function norm(value = '') {
  return String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/\s+/g, ' ');
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

function activeMcpPage() {
  return document.querySelector('section.page[data-page="mcp"]');
}

function activeCustomer(row = {}) {
  return row.active !== false && row.status !== 'deleted' && !row.deleted_at && !row.raw_payload?.deleted_at;
}

function duplicateKey(value = {}) {
  const phone = norm(value.phone || value.customer_phone || '');
  if (phone) return `phone:${phone}`;
  const name = norm(value.customer_name || value.name || '');
  const area = norm(value.area || '');
  const address = norm(value.address || value.delivery_address || '');
  if (!name) return '';
  return `name:${name}|${area}|${address}`;
}

function mountStyle() {
  let style = document.querySelector('style[data-mcp-import-ui]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpImportUi = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] [data-mcp-import-customers]{background:#fff8ef!important;border-color:#ffd8a8!important;color:#b95f00!important}
    #modal[data-type="mcp-import"] .modal{max-height:calc(100dvh - 26px);overflow:auto}
    #modal[data-type="mcp-import"] textarea{width:100%;min-height:190px;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:16px;line-height:1.35;white-space:pre;overflow:auto}
    #modal[data-type="mcp-import"] .mcp-import-help{display:grid;gap:5px;border:1px dashed #dce8e5;border-radius:14px;background:#fbfffd;padding:10px;color:#425863;font-size:12px;line-height:1.35}
    #modal[data-type="mcp-import"] .mcp-import-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
    #modal[data-type="mcp-import"] .mcp-import-preview{display:grid;gap:7px;border:1px solid #dce8e5;border-radius:14px;background:#fff;padding:10px;font-size:12px;color:#425863}
    #modal[data-type="mcp-import"] .mcp-import-preview b{font-size:14px;color:#17343d}
    #modal[data-type="mcp-import"] .mcp-import-preview ul{margin:4px 0 0;padding-left:18px;max-height:120px;overflow:auto}
    #modal[data-type="mcp-import"] .mcp-import-file{display:grid;gap:4px}
    #modal[data-type="mcp-import"] .mcp-import-file input{width:100%;border:1px solid #cad7d4;border-radius:12px;background:#fff;padding:8px;font-size:12px}
  `;
}

function ensureImportButton() {
  const page = activeMcpPage();
  const filters = page?.querySelector('.mcp-filters');
  if (!filters || filters.querySelector('[data-mcp-import-customers]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'mcp-filter';
  button.dataset.mcpImportCustomers = '1';
  button.textContent = 'Import';
  const after = filters.querySelector('[data-mcp-add-customer]');
  if (after?.nextSibling) filters.insertBefore(button, after.nextSibling);
  else filters.appendChild(button);
}

function splitCsvLine(line, delimiter) {
  const cells = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];
    if (char === '"' && quoted && next === '"') {
      value += '"';
      i += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === delimiter && !quoted) {
      cells.push(value.trim());
      value = '';
      continue;
    }
    value += char;
  }
  cells.push(value.trim());
  return cells;
}

function headerKey(value) {
  const key = norm(value).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const aliases = {
    tuyen: 'route_name', ten_tuyen: 'route_name', route: 'route_name', route_name: 'route_name', mcp_route: 'route_name',
    thu: 'weekday', ngay_thu: 'weekday', weekday: 'weekday', day: 'weekday',
    khach: 'customer_name', ten_khach: 'customer_name', customer: 'customer_name', customer_name: 'customer_name', name: 'customer_name',
    sdt: 'phone', dien_thoai: 'phone', phone: 'phone', customer_phone: 'phone',
    khu_vuc: 'area', area: 'area', market: 'area',
    dia_chi: 'address', address: 'address', delivery_address: 'address',
    thu_tu: 'sort_order', stt: 'sort_order', sort: 'sort_order', sort_order: 'sort_order',
    ghi_chu: 'note', note: 'note', notes: 'note',
    lat: 'geo_lat', latitude: 'geo_lat', geo_lat: 'geo_lat',
    lng: 'geo_lng', long: 'geo_lng', longitude: 'geo_lng', geo_lng: 'geo_lng',
    maps: 'google_maps_url', google_maps: 'google_maps_url', google_maps_url: 'google_maps_url'
  };
  return aliases[key] || key;
}

function parseWeekday(value) {
  const raw = norm(value);
  if (!raw) return null;
  if (/^[0-6]$/.test(raw)) return Number(raw);
  if (/^(t?2|thu 2|thu hai|monday)$/.test(raw)) return 1;
  if (/^(t?3|thu 3|thu ba|tuesday)$/.test(raw)) return 2;
  if (/^(t?4|thu 4|thu tu|wednesday)$/.test(raw)) return 3;
  if (/^(t?5|thu 5|thu nam|thursday)$/.test(raw)) return 4;
  if (/^(t?6|thu 6|thu sau|friday)$/.test(raw)) return 5;
  if (/^(t?7|thu 7|thu bay|saturday)$/.test(raw)) return 6;
  if (/^(cn|chu nhat|sunday)$/.test(raw)) return 0;
  return null;
}

function parseNumber(value) {
  const number = Number(String(value ?? '').trim().replace(',', '.'));
  return Number.isFinite(number) ? number : null;
}

function parsePaste(text) {
  const lines = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter((line) => line.trim());
  if (!lines.length) return { rows: [], errors: ['Chưa có dữ liệu paste hoặc file CSV/TSV.'] };
  const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : ',';
  const headers = splitCsvLine(lines[0], delimiter).map(headerKey);
  const rows = [];
  const errors = [];
  lines.slice(1).forEach((line, index) => {
    const cells = splitCsvLine(line, delimiter);
    const row = {};
    headers.forEach((key, cellIndex) => { row[key] = cells[cellIndex] ?? ''; });
    if (!Object.values(row).some((value) => String(value || '').trim())) return;
    row.__line = index + 2;
    rows.push(row);
  });
  if (!headers.includes('customer_name')) errors.push('Thiếu cột customer_name hoặc tên khách.');
  return { rows, errors };
}

function routeKey(row, fallbackRoute) {
  const routeName = row.route_name || fallbackRoute?.route_name || '';
  const weekday = parseWeekday(row.weekday);
  const routeWeekday = weekday ?? (Number.isFinite(Number(fallbackRoute?.weekday)) ? Number(fallbackRoute.weekday) : null);
  return `${norm(routeName)}|${routeWeekday ?? ''}`;
}

async function buildPlan(text) {
  const parsed = parsePaste(text);
  const [activeDetail, routes, customers] = await Promise.all([
    getActiveMcpSessionDetail().catch(() => null),
    getAllLocal(LOCAL_STORES.mcpRoutes),
    getAllLocal(LOCAL_STORES.mcpRouteCustomers)
  ]);
  const fallbackRoute = activeDetail?.route || null;
  const errors = [...parsed.errors];
  const routeByKey = new Map();
  routes.filter((route) => route.active !== false).forEach((route) => {
    routeByKey.set(`${norm(route.route_name)}|${Number(route.weekday ?? '')}`, route);
    if (!routeByKey.has(`${norm(route.route_name)}|`)) routeByKey.set(`${norm(route.route_name)}|`, route);
  });
  const routeDrafts = new Map();
  const currentCustomersByRoute = new Map();
  const existingKeys = new Set();
  customers.filter(activeCustomer).forEach((customer) => {
    const list = currentCustomersByRoute.get(customer.route_id) || [];
    list.push(customer);
    currentCustomersByRoute.set(customer.route_id, list);
    const key = duplicateKey(customer);
    if (key) existingKeys.add(key);
  });
  const newCustomers = [];
  const newKeys = new Set();
  let duplicates = 0;
  let invalid = 0;

  parsed.rows.forEach((row) => {
    const name = String(row.customer_name || '').trim();
    if (!name) {
      invalid += 1;
      errors.push(`Dòng ${row.__line}: thiếu tên khách.`);
      return;
    }
    const key = routeKey(row, fallbackRoute);
    let route = routeByKey.get(key) || routeDrafts.get(key);
    const inputWeekday = parseWeekday(row.weekday);
    if (!route) {
      const routeName = String(row.route_name || fallbackRoute?.route_name || '').trim();
      if (!routeName) {
        invalid += 1;
        errors.push(`Dòng ${row.__line}: thiếu route_name khi chưa có tuyến đang mở.`);
        return;
      }
      route = makeMcpRoute({ route_name: routeName, weekday: inputWeekday ?? fallbackRoute?.weekday, area: row.area || fallbackRoute?.area, sync_status: 'local', raw_payload: { source: 'mcp_file_import' } });
      routeDrafts.set(key, route);
      routeByKey.set(key, route);
    }
    const importKey = duplicateKey({ customer_name: name, phone: row.phone, area: row.area || route.area, address: row.address });
    if (importKey && (existingKeys.has(importKey) || newKeys.has(importKey))) {
      duplicates += 1;
      return;
    }
    const existing = currentCustomersByRoute.get(route.id) || [];
    const duplicateInRoute = existing.concat(newCustomers.filter((customer) => customer.route_id === route.id)).some((customer) => {
      const sameName = norm(customer.customer_name) === norm(name);
      const phone = norm(row.phone);
      return sameName && (!phone || norm(customer.phone) === phone);
    });
    if (duplicateInRoute) {
      duplicates += 1;
      return;
    }
    const maxOrder = Math.max(0, ...existing.concat(newCustomers.filter((customer) => customer.route_id === route.id)).map((customer) => Number(customer.sort_order || 0)));
    const sortOrder = parseNumber(row.sort_order) || maxOrder + 1;
    const geoLat = parseNumber(row.geo_lat);
    const geoLng = parseNumber(row.geo_lng);
    const customer = makeMcpRouteCustomer({
      route_id: route.id,
      customer_name: name,
      phone: row.phone,
      area: row.area || route.area,
      address: row.address,
      sort_order: sortOrder,
      note: row.note,
      geo_lat: geoLat,
      geo_lng: geoLng,
      geo_source: geoLat !== null && geoLng !== null ? 'import' : '',
      google_maps_url: row.google_maps_url,
      sync_status: 'local',
      raw_payload: { source: 'mcp_file_import', line: row.__line, row }
    });
    newCustomers.push(customer);
    if (importKey) newKeys.add(importKey);
  });

  return {
    activeSessionId: activeDetail?.session?.id || '',
    activeRouteId: activeDetail?.session?.route_id || '',
    routes: [...routeDrafts.values()],
    customers: newCustomers,
    duplicates,
    invalid,
    errors
  };
}

function renderPreview(plan) {
  const preview = document.querySelector('#mcpImportPreview');
  if (!preview) return;
  const warnings = plan.errors.slice(0, 8).map((error) => `<li>${esc(error)}</li>`).join('');
  preview.innerHTML = `<b>Xem trước import</b><span>${plan.routes.length} tuyến mới · ${plan.customers.length} khách mới · ${plan.duplicates} trùng bỏ qua · ${plan.invalid} lỗi dòng</span>${warnings ? `<ul>${warnings}</ul>` : '<small>Dữ liệu hợp lệ, có thể import.</small>'}`;
}

function openImportModal() {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-import';
  dialog.innerHTML = `<form class="modal" data-mcp-import-form><header><h2>Import tuyến + khách</h2><button type="button" data-close>Đóng</button></header><div class="form"><div class="mcp-import-help"><b>Import từ Excel/CSV</b><span>Có thể dán bảng từ Excel/Google Sheet hoặc chọn file CSV/TSV export từ Excel.</span><span>Cột tối thiểu: customer_name. Cột hỗ trợ: route_name, weekday, customer_name, phone, area, address, sort_order, note, geo_lat, geo_lng, google_maps_url.</span><span>Chống trùng theo SĐT; nếu không có SĐT thì theo tên + khu vực + địa chỉ.</span></div><label class="mcp-import-file"><span>Chọn file CSV/TSV</span><input id="mcpImportFile" type="file" accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values"></label><label><span>Dữ liệu paste</span><textarea id="mcpImportText" spellcheck="false" placeholder="${esc(IMPORT_SAMPLE)}"></textarea></label><div id="mcpImportPreview" class="mcp-import-preview"><small>Chọn file hoặc paste dữ liệu rồi bấm Xem trước.</small></div><div class="mcp-import-actions"><button type="button" class="secondary" data-mcp-preview-import>Xem trước</button><button class="primary" data-mcp-run-import>Import</button></div></div></form>`;
  lastPlan = null;
  if (!dialog.open) dialog.showModal();
  document.querySelector('#mcpImportText')?.focus();
}

async function previewImport() {
  const text = document.querySelector('#mcpImportText')?.value || '';
  lastPlan = await buildPlan(text);
  renderPreview(lastPlan);
  if (!lastPlan.customers.length && !lastPlan.routes.length) toast('Chưa có dòng hợp lệ để import.');
}

async function loadImportFile(file) {
  if (!file) return;
  const name = String(file.name || '').toLowerCase();
  if (/\.xlsx?$/.test(name)) return toast('File .xlsx chưa đọc trực tiếp. Hãy Save as CSV hoặc copy từ Excel rồi paste.');
  const text = await file.text();
  const box = document.querySelector('#mcpImportText');
  if (box) box.value = text;
  lastPlan = null;
  await previewImport();
  toast('Đã load file import.');
}

async function runImport(event) {
  event.preventDefault();
  if (!lastPlan) await previewImport();
  const plan = lastPlan;
  if (!plan || (!plan.routes.length && !plan.customers.length)) return toast('Không có dữ liệu hợp lệ để import.');
  const now = nowIso();
  for (const route of plan.routes) await putLocal(LOCAL_STORES.mcpRoutes, { ...route, updated_at: now });
  for (const customer of plan.customers) await putLocal(LOCAL_STORES.mcpRouteCustomers, { ...customer, updated_at: now });
  if (plan.activeSessionId && plan.customers.some((customer) => customer.route_id === plan.activeRouteId)) {
    await recalcMcpRouteSession(plan.activeSessionId);
  }
  document.querySelector('#modal')?.close();
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  toast(`Đã import ${plan.customers.length} khách${plan.routes.length ? ` và ${plan.routes.length} tuyến` : ''}.`);
}

function handleClick(event) {
  const importButton = event.target.closest('[data-mcp-import-customers]');
  if (importButton) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openImportModal();
    return;
  }
  const previewButton = event.target.closest('[data-mcp-preview-import]');
  if (previewButton && event.target.closest('#modal[data-type="mcp-import"]')) {
    event.preventDefault();
    previewImport().catch((error) => {
      console.warn('mcp import preview failed', error);
      toast('Không đọc được dữ liệu import.');
    });
  }
}

function boot() {
  mountStyle();
  ensureImportButton();
}

window.addEventListener('click', handleClick, true);
document.addEventListener('change', (event) => {
  if (event.target?.id === 'mcpImportFile') {
    loadImportFile(event.target.files?.[0]).catch((error) => {
      console.warn('mcp import file failed', error);
      toast('Không đọc được file import.');
    });
  }
}, true);
document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-import-form]')) return;
  runImport(event).catch((error) => {
    console.warn('mcp import failed', error);
    toast('Import chưa thành công. Kiểm tra dữ liệu paste/file.');
  });
});
window.addEventListener('mcp:session-changed', () => setTimeout(ensureImportButton, 0));
const observer = new MutationObserver(() => ensureImportButton());
observer.observe(document.documentElement, { childList: true, subtree: true });
boot();
window.addEventListener('DOMContentLoaded', boot);
