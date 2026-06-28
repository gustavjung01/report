import { STORAGE_KEYS_V2, uid } from './data-model.js';
import { configureSupabaseV2, isSupabaseV2Ready, uploadExportBlob, syncExport } from './supabase-v2.js';
import { readCachedRows, cacheRows } from './sync-queue.js';

const FILE_LOG_KEY = 'bepi-v2-file-outputs';
const ROUTE_DB_KEY = 'bepi-v2-market-routes-db';
const ROUTE_CUSTOMERS_DB_KEY = 'bepi-v2-market-route-customers-db';

function loadCss(href) {
  if (document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove('show'), 3200);
}

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
}

function readJson(key, fallback) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
}
function writeJson(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
function dateStamp() { return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); }
function readLogs() { return readJson(FILE_LOG_KEY, []); }
function writeLogs(rows) { writeJson(FILE_LOG_KEY, rows.slice(0, 30)); }

function collectPayload(kind) {
  const data = {
    orders: readCachedRows(STORAGE_KEYS_V2.orders),
    ona_tests: readCachedRows(STORAGE_KEYS_V2.onaTests),
    market_reports: readCachedRows(STORAGE_KEYS_V2.marketReports),
    ai_summaries: readCachedRows(STORAGE_KEYS_V2.aiSummaries),
    customers: readCachedRows(STORAGE_KEYS_V2.customers),
    market_routes: readJson(ROUTE_DB_KEY, []),
    market_route_customers: readJson(ROUTE_CUSTOMERS_DB_KEY, [])
  };
  if (kind === 'orders') return { label: 'orders', data: data.orders };
  if (kind === 'tests') return { label: 'ona-tests', data: data.ona_tests };
  if (kind === 'market') return { label: 'market-reports', data: data.market_reports };
  if (kind === 'ai') return { label: 'ai-summaries', data: data.ai_summaries };
  return { label: 'all-data', data };
}

function flattenRecord(kind, row) {
  if (kind === 'orders') {
    const order = row.order || {};
    return { type: 'order', id: order.id, code: order.order_code, date: order.order_date, sales: order.sales, customer: order.customer_name, area: order.area, total: order.grand_total, status: order.status, sync: order.sync_status };
  }
  if (kind === 'tests') {
    const test = row.test || {};
    return { type: 'ona_test', id: test.id, code: test.raw_payload?.test_code, date: test.test_date, sales: test.sales, customer: test.customer_name, area: test.area, item_count: (row.items || []).length, need_sample: test.need_sample, sync: test.sync_status };
  }
  if (kind === 'market') {
    const report = row.report || {};
    return { type: 'market_report', id: report.id, code: report.raw_payload?.report_code, date: report.report_date, sales: report.sales, area: report.market_area, route: report.route_name, route_day: report.route_day || report.raw_payload?.route_day, customer: report.selected_customer_name || report.raw_payload?.selected_customer, sync: report.sync_status };
  }
  if (kind === 'ai') {
    return { type: 'ai_summary', id: row.id, title: row.title, date: row.created_at, sales: row.sales, area: row.market_area, summary: row.result?.executive_summary || '' };
  }
  return row;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce((set, row) => { Object.keys(row).forEach((k) => set.add(k)); return set; }, new Set()));
  const cell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.map(cell).join(','), ...rows.map((row) => headers.map((h) => cell(row[h])).join(','))].join('\n');
}

function toText(kind, payload) {
  const rows = Array.isArray(payload.data) ? payload.data : [];
  if (kind === 'ai' && rows.length) {
    return rows.map((row) => {
      const result = row.result || {};
      return [`# ${row.title || row.id}`, result.executive_summary, ...(result.market_insights || []), ...(result.product_insights || []), ...(result.sales_opportunities || []), ...(result.customer_actions || []), ...(result.risks || []), ...(result.next_steps || [])].filter(Boolean).join('\n');
    }).join('\n\n---\n\n');
  }
  return JSON.stringify(payload.data, null, 2);
}

function toHtml(kind, payload) {
  const title = `Bep Si Bao Cao - ${payload.label}`;
  const body = kind === 'ai' && Array.isArray(payload.data)
    ? payload.data.map((row) => `<section><h2>${esc(row.title || row.id)}</h2><p>${esc(row.result?.executive_summary || '')}</p><pre>${esc(JSON.stringify(row.result || {}, null, 2))}</pre></section>`).join('')
    : `<pre>${esc(JSON.stringify(payload.data, null, 2))}</pre>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font-family:Arial,sans-serif;max-width:900px;margin:32px auto;line-height:1.5}pre{white-space:pre-wrap;background:#f6f8fa;padding:12px;border-radius:8px}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`;
}

function makeFile(kind, format) {
  const payload = collectPayload(kind);
  const rows = Array.isArray(payload.data) ? payload.data.map((row) => flattenRecord(kind, row)) : [];
  if (format === 'csv') return { payload, ext: 'csv', type: 'text/csv;charset=utf-8', text: toCsv(rows) };
  if (format === 'txt') return { payload, ext: 'txt', type: 'text/plain;charset=utf-8', text: toText(kind, payload) };
  if (format === 'html') return { payload, ext: 'html', type: 'text/html;charset=utf-8', text: toHtml(kind, payload) };
  return { payload, ext: 'json', type: 'application/json;charset=utf-8', text: JSON.stringify(payload.data, null, 2) };
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function saveFile(kind, format) {
  const file = makeFile(kind, format);
  const blob = new Blob([file.text], { type: file.type });
  const filename = `${file.payload.label}-${dateStamp()}.${file.ext}`;
  downloadBlob(blob, filename);
  const row = { id: uid('fileout'), source_type: kind, source_id: file.payload.label, export_type: file.ext, file_path: filename, title: filename, note: `rows=${Array.isArray(file.payload.data) ? file.payload.data.length : 'bundle'}` };
  try {
    configureSupabaseV2();
    if (isSupabaseV2Ready()) {
      const url = await uploadExportBlob(blob, `exports/${filename}`, file.type);
      await syncExport({ ...row, file_url: url, file_path: `exports/${filename}` });
      addLog({ ...row, file_url: url, created_at: new Date().toISOString(), status: 'db' });
      toast('Đã xuất file và lưu metadata DB.');
    } else {
      addLog({ ...row, created_at: new Date().toISOString(), status: 'local' });
      toast('Đã tải file về máy. Chưa cấu hình DB.');
    }
  } catch (error) {
    addLog({ ...row, created_at: new Date().toISOString(), status: 'local_error', note: error.message });
    toast('File đã tải về máy, upload DB lỗi.');
  }
}

function addLog(row) {
  const logs = [row, ...readLogs()];
  writeLogs(logs);
  cacheRows('bepi-v2-exports', logs);
  renderLogs();
}

function installPanel() {
  const ai = document.getElementById('aiSummaryModule') || document.getElementById('aiSection');
  if (!ai || document.getElementById('fileOutPanel')) return;
  ai.insertAdjacentHTML('beforeend', `
    <section class="panel-card fileout-panel" id="fileOutPanel">
      <h2>Xuất file</h2>
      <p>Xuất dữ liệu đang có trong cache. Nếu Supabase sẵn sàng, file sẽ upload vào bucket report-exports và ghi metadata vào bảng exports.</p>
      <div class="form-grid two">
        <label><span>Nguồn</span><select id="fileOutKind"><option value="all">Tất cả</option><option value="orders">Đơn hàng</option><option value="tests">Test SP</option><option value="market">Báo cáo thị trường</option><option value="ai">Báo cáo AI</option></select></label>
        <label><span>Định dạng</span><select id="fileOutFormat"><option value="json">JSON</option><option value="csv">CSV</option><option value="txt">TXT</option><option value="html">HTML</option></select></label>
      </div>
      <div class="fileout-grid"><button class="primary" type="button" id="runFileOutBtn">Xuất file</button><button type="button" id="refreshFileOutLogBtn">Làm mới log</button></div>
      <div class="fileout-log" id="fileOutLog"></div>
    </section>`);
}

function renderLogs() {
  const box = document.getElementById('fileOutLog');
  if (!box) return;
  const logs = readLogs();
  if (!logs.length) {
    box.innerHTML = '<article><strong>Chưa có file xuất</strong><small>Xuất JSON/CSV/TXT/HTML để lưu log.</small></article>';
    return;
  }
  box.innerHTML = logs.slice(0, 8).map((row) => `<article><strong>${esc(row.title || row.file_path)}</strong><small>${esc(row.created_at || '')} · ${esc(row.export_type || '')} · ${esc(row.status || '')}</small>${row.file_url ? `<a href="${esc(row.file_url)}" target="_blank" rel="noreferrer">Mở file DB</a>` : ''}</article>`).join('');
}

function bindPanel() {
  document.getElementById('runFileOutBtn')?.addEventListener('click', () => saveFile(document.getElementById('fileOutKind')?.value || 'all', document.getElementById('fileOutFormat')?.value || 'json'));
  document.getElementById('refreshFileOutLogBtn')?.addEventListener('click', renderLogs);
}

function initFileOut() {
  loadCss('file-out.css');
  installPanel();
  bindPanel();
  renderLogs();
}

window.addEventListener('load', () => setTimeout(initFileOut, 700));
