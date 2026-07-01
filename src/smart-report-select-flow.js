import { makeAiSummary, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal } from '../local-db.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v = '') => String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
const parse = (v = '') => { try { return JSON.parse(v); } catch { return null; } };
let state = { reportType: '', config: null, data: {}, flat: new Map(), payload: null };

const reportConfig = {
  executive_report: { title: 'Báo cáo điều hành', file: 'bao-cao-dieu-hanh', hint: 'Chọn từng file dữ liệu cần tổng hợp cho báo cáo quản lý.', sources: ['mcp', 'orders', 'tests', 'reports'] },
  customer_action_report: { title: 'Khách cần xử lý', file: 'khach-can-xu-ly', hint: 'Chọn file/khách/dữ liệu liên quan đến khách cần xử lý.', sources: ['orders', 'tests', 'reports', 'mcp'] },
  product_market_report: { title: 'Sản phẩm & thị trường', file: 'san-pham-thi-truong', hint: 'Chọn file test, đơn hoặc báo cáo có liên quan đến sản phẩm cần phân tích.', sources: ['tests', 'orders', 'reports'] },
  route_sales_report: { title: 'Tuyến & hiệu suất sales', file: 'bao-cao-tuyen-sales', hint: 'Chọn tuyến, phiên đi tuyến, đơn hoặc báo cáo cần đánh giá.', sources: ['mcp', 'orders', 'reports'] }
};
const sourceMeta = {
  mcp: { label: 'MCP tuyến', store: LOCAL_STORES.mcpRouteSessions, icon: '🧭', snap: 'mcp_sessions' },
  orders: { label: 'Đơn hàng', store: LOCAL_STORES.orders, icon: '🛒', snap: 'orders' },
  tests: { label: 'Test sản phẩm', store: LOCAL_STORES.onaTests, icon: '🧪', snap: 'tests' },
  reports: { label: 'Báo cáo thị trường', store: LOCAL_STORES.marketReports, icon: '📊', snap: 'market_reports' }
};

function active(r = {}) { return r.status !== 'deleted' && !r.deleted_at && !r.raw_payload?.deleted_at; }
function val(r = {}, keys = []) { for (const k of keys) { const v = k.split('.').reduce((a, p) => a?.[p], r); if (v !== undefined && v !== null && String(v).trim()) return v; } return ''; }
function dateOf(r = {}) { return String(val(r, ['file_date', 'session_date', 'route_date', 'date', 'visit_date', 'order_date', 'test_date', 'report_date', 'created_at', 'createdAt', 'updated_at']) || '').slice(0, 10); }
function first(rows = [], keys = []) { for (const row of rows) { const v = val(row, keys); if (v) return v; } return ''; }
function uniqueCount(rows = [], keys = []) { const set = new Set(); rows.forEach(row => { const v = val(row, keys); if (v) set.add(String(v).trim()); }); return set.size; }
function fileKey(source, r = {}, i = 0) {
  const keys = {
    tests: ['file_id', 'test_file_id', 'session_id', 'batch_id', 'test_session_id', 'raw_payload.file_id', 'raw_payload.session_id', 'created_at'],
    mcp: ['file_id', 'session_id', 'route_session_id', 'mcp_session_id', 'route_id', 'route_name', 'date', 'visit_date', 'created_at'],
    orders: ['id', 'order_id', 'order_code', 'code', 'local_id', 'created_at'],
    reports: ['id', 'report_id', 'file_id', 'session_id', 'title', 'date', 'created_at']
  }[source] || ['id', 'created_at'];
  return `${source}:${val(r, keys) || i}`;
}
function titleOf(source, rows = [], i = 0) {
  const r = rows[0] || {};
  const date = dateOf(r);
  const customer = first(rows, ['customer_name', 'customerName', 'customer.name', 'customer', 'shop_name', 'store_name', 'outlet_name']);
  const product = first(rows, ['product_name', 'productName', 'product.name', 'product', 'sku_name', 'item_name']);
  const route = first(rows, ['route_name', 'routeName', 'route', 'route_id', 'routeId']);
  const sales = first(rows, ['sales_name', 'salesName', 'seller_name', 'user_name', 'created_by_name']);
  if (source === 'mcp') return route ? `Tuyến ${route}${date ? ' - ' + date : ''}` : `Phiên MCP ${sales || customer || date || '#' + (i + 1)}`;
  if (source === 'orders') return `Đơn ${customer || val(r, ['code', 'order_code', 'id']) || date || '#' + (i + 1)}`;
  if (source === 'tests') return `File test ${product || customer || date || '#' + (i + 1)}`;
  if (source === 'reports') return `Báo cáo ${customer || first(rows, ['area', 'market', 'district', 'title']) || date || '#' + (i + 1)}`;
  return `File dữ liệu ${i + 1}`;
}
function metaOf(source, rows = []) {
  const r = rows[0] || {};
  const date = dateOf(r);
  const customers = uniqueCount(rows, ['customer_name', 'customerName', 'customer.name', 'customer', 'shop_name', 'store_name', 'outlet_name']);
  const products = uniqueCount(rows, ['product_name', 'productName', 'product.name', 'product', 'sku_name', 'item_name']);
  return [date, rows.length > 1 ? `${rows.length} dòng` : '', customers ? `${customers} khách` : '', products ? `${products} sản phẩm` : ''].filter(Boolean).join(' · ') || sourceMeta[source]?.label || 'File dữ liệu';
}
function groupRows(source, rows = []) {
  const map = new Map();
  rows.forEach((row, i) => { const key = fileKey(source, row, i); if (!map.has(key)) map.set(key, []); map.get(key).push(row); });
  return Array.from(map.entries()).map(([id, group], i) => ({ source, id, title: titleOf(source, group, i), meta: metaOf(source, group), date: dateOf(group[0] || {}), rows: group }));
}
async function collect(config) {
  await openLocalDb();
  const data = {};
  state.flat = new Map();
  for (const source of config.sources) {
    const rows = (await getAllLocal(sourceMeta[source].store)).filter(active);
    const groups = groupRows(source, rows).sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))).slice(0, 80);
    data[source] = groups;
    groups.forEach(g => state.flat.set(g.id, g));
  }
  return data;
}

function itemText(x) {
  if (x === null || x === undefined) return '';
  if (typeof x === 'string') return x;
  if (Array.isArray(x)) return x.filter(Boolean).join(', ');
  const main = x.customer || x.product || x.route || x.sales || x.title || x.name || x.area || 'Mục';
  const detail = x.action || x.insight || x.reason || x.note || x.status || x.result || x.summary || '';
  const products = Array.isArray(x.products) && x.products.length ? ` (${x.products.join(', ')})` : '';
  return `${main}${products}${detail ? ': ' + detail : ''}`;
}
function arr(...groups) { return groups.flat().filter(Boolean).map(itemText).filter(Boolean); }
function selectedLines(snapshot = {}) { return (snapshot.selected_items || []).map(x => `${x.title}${x.meta ? ' — ' + x.meta : ''}`); }
function resultSections(reportType, r = {}, snapshot = {}) {
  const selected = selectedLines(snapshot);
  const common = {
    executive_report: [
      { key: 'overview', label: 'Tổng quan', lead: r.summary || 'Chưa có tóm tắt.', items: arr(r.market_insights) },
      { key: 'customers', label: 'Khách', items: arr(r.customer_actions, r.follow_up_list) },
      { key: 'products', label: 'Sản phẩm', items: arr(r.product_insights, r.sample_requests, r.order_opportunities) },
      { key: 'next', label: 'Việc cần làm', items: arr(r.next_steps, r.risks) }
    ],
    customer_action_report: [
      { key: 'priority', label: 'Ưu tiên', lead: r.summary || '', items: arr(r.customer_actions, r.risks) },
      { key: 'callback', label: 'Gọi lại', items: arr(r.follow_up_list) },
      { key: 'sample', label: 'Gửi mẫu', items: arr(r.sample_requests) },
      { key: 'opportunity', label: 'Cơ hội', items: arr(r.order_opportunities, r.next_steps) }
    ],
    product_market_report: [
      { key: 'good', label: 'Sản phẩm tốt', lead: r.summary || '', items: arr(r.product_insights) },
      { key: 'weak', label: 'Sản phẩm yếu', items: arr(r.risks) },
      { key: 'feedback', label: 'Phản hồi', items: arr(r.market_insights, r.customer_actions, r.sample_requests) },
      { key: 'proposal', label: 'Đề xuất', items: arr(r.order_opportunities, r.next_steps) }
    ],
    route_sales_report: [
      { key: 'visited', label: 'Đã ghé', lead: r.summary || '', items: selected },
      { key: 'missed', label: 'Bỏ sót', items: arr(r.risks) },
      { key: 'route_opp', label: 'Cơ hội', items: arr(r.order_opportunities, r.market_insights) },
      { key: 'route_next', label: 'Việc tiếp', items: arr(r.next_steps, r.customer_actions) }
    ]
  };
  return common[reportType] || common.executive_report;
}

function style() {
  if ($('style[data-smart-select-flow]')) return;
  const s = document.createElement('style');
  s.dataset.smartSelectFlow = '1';
  s.textContent = `#modal[data-type="smart-select"],#modal[data-type="smart-generating"],#modal[data-type="smart-generated"]{width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;padding:0!important;overflow:hidden!important}#modal[data-type="smart-select"]::backdrop,#modal[data-type="smart-generating"]::backdrop,#modal[data-type="smart-generated"]::backdrop{background:rgba(8,35,55,.42)!important}.ss-modal{height:100dvh;min-height:0;display:grid;grid-template-rows:auto auto auto minmax(0,1fr) auto;background:#f6fbf9;color:#082337}.ss-head{background:#fff;border-bottom:1px solid #dce8e5;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:10px}.ss-head h2{margin:0;font-size:19px;line-height:1.15}.ss-close{border:1px solid #dce8e5;background:#fff;color:#007866;border-radius:999px;min-height:34px;padding:0 12px;font-weight:950}.ss-brief{background:#fff;border-bottom:1px solid #dce8e5;padding:10px 14px;display:grid;gap:5px}.ss-brief b{font-size:14px}.ss-brief small{font-size:12px;color:#63727c;line-height:1.35}.ss-body{min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px;display:grid;gap:10px;align-content:start}.ss-tools{position:sticky;top:0;z-index:2;background:#f6fbf9;padding-bottom:2px;display:grid;gap:7px}.ss-search{width:100%;min-height:42px;border:1px solid #dce8e5;border-radius:14px;background:#fff;padding:0 12px;font-size:14px}.ss-count{border:1px solid #bfe9dc;background:#eefbf6;color:#007866;border-radius:999px;width:max-content;padding:5px 9px;font-size:12px;font-weight:950}.ss-group{background:#fff;border:1px solid #dce8e5;border-radius:17px;overflow:hidden;box-shadow:0 9px 22px rgba(12,55,50,.045);display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0}.ss-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;background:linear-gradient(180deg,#fff,#fbfffd);border-bottom:1px solid #edf2f0}.ss-group-head b{font-size:14px}.ss-group-head small{font-size:12px;color:#63727c}.ss-list{display:grid;max-height:min(42dvh,360px);overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.ss-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;padding:11px 12px;border-top:1px solid #f0f4f2;min-height:56px}.ss-row:first-child{border-top:0}.ss-row input{margin-top:3px;accent-color:#00957f;width:16px;height:16px}.ss-row span{display:grid;gap:3px;min-width:0}.ss-row strong{font-size:13px;line-height:1.2;color:#082337}.ss-row small{font-size:11.5px;line-height:1.3;color:#63727c}.ss-empty{padding:12px;color:#63727c;font-size:12px}.ss-foot{background:#fff;border-top:1px solid #dce8e5;padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px}.ss-foot button{min-height:44px;border-radius:13px;font-weight:950}.ss-secondary{border:1px solid #00957f;background:#fff;color:#007866}.ss-primary{border:0;background:linear-gradient(135deg,#00957f,#007866);color:#fff}.ss-primary:disabled{opacity:.45}.ss-card{background:#fff;border:1px solid #dce8e5;border-radius:17px;padding:13px;display:grid;gap:8px;box-shadow:0 9px 22px rgba(12,55,50,.045)}.ss-card h3{font-size:15px;margin:0}.ss-card p,.ss-card li,.ss-card small{font-size:12.5px;line-height:1.45;color:#425863}.ss-card ul{margin:0;padding-left:18px;display:grid;gap:5px}.ss-selected{display:grid;gap:6px}.ss-selected div{border:1px dashed #dce8e5;border-radius:12px;padding:8px;background:#fbfffd;font-size:12px;color:#425863}.ss-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;padding:9px 10px;background:#fff;border-bottom:1px solid #dce8e5}.ss-tab{border:1px solid #dce8e5;background:#fbfffd;border-radius:999px;min-height:34px;font-size:11px;font-weight:950;color:#425863}.ss-tab.active{background:#e1f8f1;border-color:#9bdccd;color:#007866}.ss-panel{display:none}.ss-panel.active{display:grid;gap:8px}`;
  document.head.appendChild(s);
}
function toast(t) { const el = $('#toast'); if (!el) return; el.textContent = t; el.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove('show'), 2200); }
function close() { const m = $('#modal'); if (m?.open) m.close(); if (m) m.dataset.type = ''; }
function updateCount() { const n = $$('input[data-ss-item]:checked').length; const c = $('[data-ss-count]'); if (c) c.textContent = `Đã chọn ${n} file`; const b = $('[data-ss-create]'); if (b) b.disabled = !n; }
function filterRows(value = '') { const q = value.trim().toLowerCase(); $$('.ss-row').forEach(row => { row.hidden = q && !row.textContent.toLowerCase().includes(q); }); }
function groupHtml(source, rows = []) {
  const meta = sourceMeta[source];
  const items = rows.length ? rows.map(row => `<label class="ss-row"><input type="checkbox" data-ss-item data-source="${source}" value="${esc(row.id)}"><span><strong>${esc(row.title)}</strong><small>${esc(row.meta)}</small></span></label>`).join('') : '<div class="ss-empty">Chưa có dữ liệu.</div>';
  return `<section class="ss-group" data-ss-source="${source}"><div class="ss-group-head"><b>${meta.icon} ${meta.label}</b><small>${rows.length} file</small></div><div class="ss-list">${items}</div></section>`;
}
async function openSelect(reportType) {
  const config = reportConfig[reportType] || reportConfig.executive_report;
  style();
  const modal = $('#modal'); if (!modal) return;
  state = { reportType, config, data: {}, flat: new Map(), payload: null };
  modal.dataset.type = 'smart-select';
  modal.innerHTML = `<div class="ss-modal"><header class="ss-head"><h2>${esc(config.title)}</h2><button class="ss-close" data-ss-close>Đóng</button></header><section class="ss-brief"><b>Chọn file dữ liệu phân tích</b><small>${esc(config.hint)} Tối thiểu chọn 1 file mới tạo báo cáo.</small></section><div class="ss-body"><div class="ss-tools"><input class="ss-search" data-ss-search placeholder="Tìm khách, sản phẩm, tuyến, ngày..."><span class="ss-count" data-ss-count>Đã chọn 0 file</span></div><div class="ss-empty">Đang đọc dữ liệu...</div></div><footer class="ss-foot"><button class="ss-secondary" data-ss-close>Đóng</button><button class="ss-primary" data-ss-create disabled>Tạo báo cáo</button></footer></div>`;
  if (!modal.open) modal.showModal();
  const data = await collect(config); state.data = data;
  const body = $('.ss-body', modal); if (!body) return;
  body.innerHTML = `<div class="ss-tools"><input class="ss-search" data-ss-search placeholder="Tìm khách, sản phẩm, tuyến, ngày..."><span class="ss-count" data-ss-count>Đã chọn 0 file</span></div>${config.sources.map(s => groupHtml(s, data[s] || [])).join('')}`;
}
function selectedGroups() { return $$('input[data-ss-item]:checked').map(input => state.flat.get(input.value)).filter(Boolean); }
function buildSnapshot(groups = []) {
  const snapshot = { today: todayIsoDate(), report_type: state.reportType, report_title: state.config?.title || 'Báo cáo thông minh', selected_items: [], orders: [], tests: [], market_reports: [], mcp_sessions: [], metrics: { orders: 0, tests: 0, market_reports: 0, mcp_sessions: 0, selected_files: groups.length, selected_rows: 0 } };
  for (const group of groups) {
    const key = sourceMeta[group.source]?.snap;
    if (key) snapshot[key].push(...group.rows);
    snapshot.selected_items.push({ source: group.source, title: group.title, meta: group.meta, row_count: group.rows.length });
    snapshot.metrics.selected_rows += group.rows.length;
  }
  snapshot.metrics.orders = snapshot.orders.length;
  snapshot.metrics.tests = snapshot.tests.length;
  snapshot.metrics.market_reports = snapshot.market_reports.length;
  snapshot.metrics.mcp_sessions = snapshot.mcp_sessions.length;
  return snapshot;
}
function showGenerating(snapshot) {
  const modal = $('#modal'); if (!modal) return;
  modal.dataset.type = 'smart-generating';
  modal.innerHTML = `<div class="ss-modal"><header class="ss-head"><h2>${esc(state.config?.title || 'Báo cáo thông minh')}</h2><button class="ss-close" data-ss-close>Đóng</button></header><section class="ss-brief"><b>Đang tạo báo cáo</b><small>Chỉ phân tích ${snapshot.metrics.selected_files} file đã chọn.</small></section><div class="ss-body"><article class="ss-card"><h3>Đang phân tích dữ liệu...</h3><p>File: ${snapshot.metrics.selected_files} · Dòng dữ liệu: ${snapshot.metrics.selected_rows}</p></article><section class="ss-card"><h3>Dữ liệu đã chọn</h3><div class="ss-selected">${snapshot.selected_items.map(x => `<div>${esc(x.title)}<br><small>${esc(x.meta)}</small></div>`).join('')}</div></section></div><footer class="ss-foot"><button class="ss-secondary" data-ss-close>Đóng</button><button class="ss-primary" disabled>Đang tạo...</button></footer></div>`;
}\nfunction list(items = []) { return Array.isArray(items) && items.length ? `<ul>${items.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p>Chưa có dữ liệu nổi bật.</p>'; }
function panelHtml(section, i) {
  return `<article class="ss-card ss-panel ${i === 0 ? 'active' : ''}" data-ss-panel="${section.key}"><h3>${esc(section.label)}</h3>${section.lead ? `<p>${esc(section.lead)}</p>` : ''}${list(section.items)}</article>`;
}
function showGenerated(payload) {
  state.payload = payload;
  const r = payload.result || {};
  const snapshot = payload.snapshot || {};
  const sections = resultSections(state.reportType, r, snapshot);
  const modal = $('#modal'); if (!modal) return;
  modal.dataset.type = 'smart-generated';
  modal.innerHTML = `<div class="ss-modal"><header class="ss-head"><h2>${esc(state.config?.title || 'Báo cáo thông minh')}</h2><button class="ss-close" data-ss-close>Đóng</button></header><section class="ss-brief"><b>Kết quả phân tích</b><small>Đã phân tích ${snapshot.metrics.selected_files} file đã chọn.</small></section><nav class="ss-tabs">${sections.map((s, i) => `<button class="ss-tab ${i === 0 ? 'active' : ''}" data-ss-tab="${s.key}">${esc(s.label)}</button>`).join('')}</nav><div class="ss-body">${sections.map(panelHtml).join('')}</div><footer class="ss-foot"><button class="ss-secondary" data-ss-save>Lưu báo cáo</button><button class="ss-primary" data-ss-export>Xuất TXT</button></footer></div>`;
}
function resultText(payload = state.payload) {
  const r = payload?.result || {};
  const s = payload?.snapshot || {};
  const sections = resultSections(s.report_type || state.reportType, r, s);
  const selected = selectedLines(s);
  const lines = [state.config?.title || 'Báo cáo thông minh', `Ngày tạo: ${s.today || todayIsoDate()}`, `Dữ liệu đã chọn: ${s.metrics?.selected_files || 0} file / ${s.metrics?.selected_rows || 0} dòng`, ''];
  lines.push('DỮ LIỆU ĐÃ CHỌN');
  lines.push(...(selected.length ? selected.map(x => `- ${x}`) : ['- Chưa có dữ liệu.']));
  for (const section of sections) {
    lines.push('', section.label.toUpperCase());
    if (section.lead) lines.push(section.lead);
    lines.push(...(section.items?.length ? section.items.map(x => `- ${x}`) : ['- Chưa có dữ liệu nổi bật.']));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
async function createReport() {
  const groups = selectedGroups();
  if (!groups.length) { toast('Vui lòng chọn ít nhất 1 file.'); return; }
  const snapshot = buildSnapshot(groups);
  showGenerating(snapshot);
  try {
    const res = await fetch('/api/report-agent', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8', Accept: 'application/json' }, body: JSON.stringify({ report_type: state.reportType, selected_items: snapshot.selected_items, snapshot }), cache: 'no-store' });
    const json = parse(await res.text()) || {};
    const payload = { ok: res.ok && !!json.ok, source: json.source || '', result: json.result || {}, snapshot };
    if (!payload.ok) payload.result = { summary: 'Chưa tạo được báo cáo. Vui lòng thử lại sau.', next_steps: ['Kiểm tra kết nối và thử lại.'] };
    showGenerated(payload);
    toast(payload.ok ? 'Đã tạo xong báo cáo' : 'Chưa tạo được báo cáo');
  } catch (_e) {
    showGenerated({ ok: false, result: { summary: 'Chưa tạo được báo cáo. Vui lòng thử lại sau.', next_steps: ['Kiểm tra kết nối và thử lại.'] }, snapshot });
    toast('Chưa tạo được báo cáo');
  }
}
async function saveReport() {
  if (!state.payload) { toast('Chưa có báo cáo để lưu'); return; }
  await openLocalDb();
  const row = makeAiSummary({ title: `${state.config?.title || 'Báo cáo thông minh'} ${state.payload.snapshot.today}`, summary_type: state.reportType, date_from: state.payload.snapshot.today, date_to: state.payload.snapshot.today, source_filters: { selected_items: state.payload.snapshot.selected_items, metrics: state.payload.snapshot.metrics }, source_refs: state.payload.snapshot.selected_items, result: { text: resultText(), json: state.payload.result, generated_at: new Date().toISOString() }, status: 'saved', note: 'Báo cáo từ dữ liệu đã chọn' });
  await putLocal(LOCAL_STORES.aiSummaries, row);
  toast('Đã lưu báo cáo');
}
function exportTxt() {
  if (!state.payload) { toast('Chưa có báo cáo để xuất'); return; }
  const name = `${state.config?.file || 'bao-cao-thong-minh'}-${state.payload.snapshot.today}.txt`;
  const blob = new Blob(['\ufeff' + resultText()], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Đã xuất TXT');
}

document.addEventListener('click', async e => {
  const card = e.target.closest('[data-report-type]');
  if (card) { e.preventDefault(); e.stopImmediatePropagation(); await openSelect(card.dataset.reportType); return; }
  const tab = e.target.closest('[data-ss-tab]');
  if (tab) { e.preventDefault(); $$('.ss-tab').forEach(b => b.classList.toggle('active', b === tab)); $$('.ss-panel').forEach(p => p.classList.toggle('active', p.dataset.ssPanel === tab.dataset.ssTab)); return; }
  if (e.target.closest('[data-ss-close]')) { e.preventDefault(); close(); return; }
  if (e.target.closest('[data-ss-create]')) { e.preventDefault(); await createReport(); return; }
  if (e.target.closest('[data-ss-save]')) { e.preventDefault(); await saveReport(); return; }
  if (e.target.closest('[data-ss-export]')) { e.preventDefault(); exportTxt(); }
}, true);
document.addEventListener('change', e => { if (e.target.matches('input[data-ss-item]')) updateCount(); }, true);
document.addEventListener('input', e => { if (e.target.matches('[data-ss-search]')) filterRows(e.target.value); }, true);
style();
