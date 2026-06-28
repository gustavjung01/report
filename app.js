const STORAGE_KEY = 'bepi-field-report-v5';
const OLD_KEYS = ['bepi-field-report-v4', 'bepi-field-report-v3', 'tea-survey-reports-v2', 'tea-survey-reports-v1'];
const DEFAULT_SUPABASE_URL = 'https://aumcufisjmlmwywoogug.supabase.co';
const EXPORT_BUCKET = 'report-exports';

const PRODUCTS = [
  { id: 'den', name: 'Trà Đen' },
  { id: 'qua-mong', name: 'Trà Quả Mộng' },
  { id: 'gao-rang', name: 'Trà Gạo Rang' },
  { id: 'lai', name: 'Trà Lài' },
  { id: 'olong', name: 'Trà Olong' },
  { id: 'olong-sen', name: 'Trà Olong Sen' }
];

const STATUS = [
  { id: 'pending', label: 'Chưa thử', icon: '○' },
  { id: 'ok', label: 'OK', icon: '✓' },
  { id: 'interested', label: 'Quan tâm', icon: '◎' },
  { id: 'sample', label: 'Cần mẫu', icon: '+' },
  { id: 'follow', label: 'Báo Tân', icon: '↗' },
  { id: 'bad', label: 'Chưa tốt', icon: '!' },
  { id: 'retry', label: 'Thử lại', icon: '↻' }
];

const MARKET = ['Giá tốt', 'Giá cao', 'Ngọt', 'Lạt', 'Béo', 'Thơm', 'Đậm', 'Nhạt', 'Dễ bán', 'Khó uống', 'Đang bán hãng khác', 'Cần mẫu lớn', 'Chủ đi vắng', 'Báo sau cho A Tân'];
const $ = (id) => document.getElementById(id);

const els = {
  installBtn: $('installBtn'), connectionStatus: $('connectionStatus'), homeStats: $('homeStats'),
  reportForm: $('reportForm'), reportDate: $('reportDate'), reportKind: $('reportKind'), reportMarket: $('reportMarket'), reportSales: $('reportSales'), reportNote: $('reportNote'),
  seedBtn: $('seedBtn'), clearBtn: $('clearBtn'),
  supabaseUrl: $('supabaseUrl'), supabaseAnonKey: $('supabaseAnonKey'), supabaseStatus: $('supabaseStatus'), saveSupabaseBtn: $('saveSupabaseBtn'), testSupabaseBtn: $('testSupabaseBtn'), syncAllSupabaseBtn: $('syncAllSupabaseBtn'),
  sheetUrl: $('sheetUrl'), sheetStatus: $('sheetStatus'), saveSheetBtn: $('saveSheetBtn'), openSheetApiBtn: $('openSheetApiBtn'), testSheetBtn: $('testSheetBtn'), syncAllReportsBtn: $('syncAllReportsBtn'), driveFolderId: $('driveFolderId'), createDriveFile: $('createDriveFile'),
  reportCount: $('reportCount'), reportList: $('reportList'), emptyState: $('emptyState'), reportDetail: $('reportDetail'), activeReportDate: $('activeReportDate'), activeReportTitle: $('activeReportTitle'), activeReportMeta: $('activeReportMeta'), activeSyncStatus: $('activeSyncStatus'), syncActiveReportBtn: $('syncActiveReportBtn'), copySummaryBtn: $('copySummaryBtn'), exportTxtBtn: $('exportTxtBtn'), exportCsvBtn: $('exportCsvBtn'), statsGrid: $('statsGrid'),
  searchInput: $('searchInput'), productFilter: $('productFilter'), actionFilter: $('actionFilter'), customerEditor: $('customerEditor'), editorTitle: $('editorTitle'), customerForm: $('customerForm'), editingCustomerId: $('editingCustomerId'), customerName: $('customerName'), customerArea: $('customerArea'), testType: $('testType'), followDate: $('followDate'), customerNote: $('customerNote'), teaTests: $('teaTests'), marketChips: $('marketChips'), cancelEditBtn: $('cancelEditBtn'), customerCount: $('customerCount'), customerList: $('customerList'), quickAddBtn: $('quickAddBtn'), toast: $('toast')
};

let state = {
  reports: [],
  activeReportId: '',
  settings: {
    sheetEndpoint: '',
    createDriveFile: false,
    driveFolderId: '',
    supabaseUrl: DEFAULT_SUPABASE_URL,
    supabaseAnonKey: ''
  }
};
let installPrompt = null;
let saveTimer = null;

function uid(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
function today() { return new Date().toISOString().slice(0, 10); }
function viDate(v) { return v ? new Intl.DateTimeFormat('vi-VN').format(new Date(`${v}T00:00:00`)) : '--'; }
function viTime(v) { return v ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : ''; }
function esc(v = '') { return String(v).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
function toast(msg) { els.toast.textContent = msg; els.toast.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => els.toast.classList.remove('show'), 3400); }
function statusLabel(id) { return STATUS.find((x) => x.id === id)?.label || 'Chưa thử'; }
function statusClass(id) { return ['ok', 'interested', 'sample'].includes(id) ? 'good' : ['follow', 'retry'].includes(id) ? 'warn' : id === 'bad' ? 'bad' : 'pending'; }
function statusGroup(id) { return id === 'retry' ? 'bad' : id; }
function fileSafe(v) { return String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'bao-cao'; }

function emptyTests() { const out = {}; PRODUCTS.forEach((p) => out[p.name] = { status: 'pending', note: '' }); return out; }
function normalizeCustomer(c = {}) { return { id: c.id || uid('cus'), name: c.name || '', area: c.area || '', testType: c.testType || 'Trà ONA Test', followDate: c.followDate || '', note: c.note || '', marketTags: Array.isArray(c.marketTags) ? c.marketTags : [], tests: { ...emptyTests(), ...(c.tests || {}) } }; }
function normalizeReport(r = {}) { return { id: r.id || uid('report'), kind: r.kind || r.reportType || 'Thị trường', date: r.date || today(), market: r.market || '', sales: r.sales || 'A Tân', note: r.note || '', createdAt: r.createdAt || new Date().toISOString(), updatedAt: r.updatedAt || new Date().toISOString(), sync: r.sync || { status: 'pending', lastAt: '', message: '' }, customers: Array.isArray(r.customers) ? r.customers.map(normalizeCustomer) : [] }; }
function normalizeSupabaseUrl(value = '') { const raw = String(value || '').trim(); const match = raw.match(/dashboard\/project\/([a-z0-9]+)/i); if (match) return `https://${match[1]}.supabase.co`; if (!raw) return DEFAULT_SUPABASE_URL; return raw.replace(/\/+$/, ''); }
function isPublishableKey(key = '') { return String(key).trim().startsWith('sb_publishable_'); }

function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) for (const key of OLD_KEYS) { raw = localStorage.getItem(key); if (raw) break; }
    if (!raw) return;
    const old = JSON.parse(raw);
    state = {
      reports: (old.reports || []).map(normalizeReport),
      activeReportId: old.activeReportId || '',
      settings: {
        sheetEndpoint: old.settings?.sheetEndpoint || '',
        createDriveFile: !!old.settings?.createDriveFile,
        driveFolderId: old.settings?.driveFolderId || '',
        supabaseUrl: normalizeSupabaseUrl(old.settings?.supabaseUrl || DEFAULT_SUPABASE_URL),
        supabaseAnonKey: old.settings?.supabaseAnonKey || ''
      }
    };
    save();
  } catch (e) { console.error(e); }
}

function activeReport() { return state.reports.find((r) => r.id === state.activeReportId) || null; }
function dirty(report) { report.updatedAt = new Date().toISOString(); if (report.sync.status === 'synced') report.sync = { status: 'pending', lastAt: report.sync.lastAt, message: 'Có chỉnh sửa mới' }; }
function needs(c, group) { const tests = Object.values(c.tests || {}); if (group === 'follow') return tests.some((t) => statusGroup(t.status) === 'follow') || c.marketTags.some((t) => t.toLowerCase().includes('báo sau')) || /báo|tân/i.test(c.note || ''); if (group === 'sample') return tests.some((t) => statusGroup(t.status) === 'sample') || c.marketTags.some((t) => t.toLowerCase().includes('mẫu')) || /mẫu/i.test(c.note || ''); if (group === 'bad') return tests.some((t) => ['bad', 'retry'].includes(t.status)) || c.marketTags.some((t) => ['khó uống', 'nhạt', 'giá cao'].includes(t.toLowerCase())); return tests.some((t) => statusGroup(t.status) === group); }

function renderSupabase() {
  const s = state.settings;
  if (els.supabaseUrl) els.supabaseUrl.value = s.supabaseUrl || DEFAULT_SUPABASE_URL;
  if (els.supabaseAnonKey) els.supabaseAnonKey.value = s.supabaseAnonKey || '';
  const ok = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(s.supabaseUrl || '') && Boolean(s.supabaseAnonKey);
  els.connectionStatus.textContent = ok ? 'Đã nối Supabase DB' : 'Chưa nối Supabase';
  if (els.supabaseStatus) {
    els.supabaseStatus.className = `sheet-status ${ok ? 'ok' : 'warn'}`;
    els.supabaseStatus.innerHTML = ok ? `DB OK: <b>${esc(s.supabaseUrl)}</b>` : 'Dán <b>Project URL</b> dạng https://xxxxx.supabase.co và publishable/anon key.';
  }
}

function renderSheet() {
  const s = state.settings;
  if (els.sheetUrl) els.sheetUrl.value = s.sheetEndpoint;
  if (els.createDriveFile) els.createDriveFile.checked = s.createDriveFile;
  if (els.driveFolderId) els.driveFolderId.value = s.driveFolderId;
  if (!els.sheetStatus) return;
  if (!s.sheetEndpoint) { els.sheetStatus.className = 'sheet-status warn'; els.sheetStatus.innerHTML = 'Dự phòng: dán link <b>/exec</b> nếu vẫn dùng Sheet.'; return; }
  const ok = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(s.sheetEndpoint);
  els.sheetStatus.className = `sheet-status ${ok ? 'ok' : 'warn'}`;
  els.sheetStatus.innerHTML = ok ? `Sheet dự phòng OK.${s.createDriveFile ? '<br>Sẽ tạo/cập nhật Google Doc.' : ''}` : 'Link phải có dạng <b>https://script.google.com/macros/s/.../exec</b>.';
}

function renderHome() { const customers = state.reports.reduce((n, r) => n + r.customers.length, 0); els.homeStats.innerHTML = `<b>${state.reports.length}</b><small>báo cáo</small><b>${customers}</b><small>khách</small>`; }
function syncMeta(r) { const s = r.sync?.status || 'pending'; if (s === 'synced') return { cls: 'synced', text: `Đã đẩy DB${r.sync.lastAt ? ` · ${viTime(r.sync.lastAt)}` : ''}` }; if (s === 'sending') return { cls: 'sending', text: 'Đang đẩy...' }; if (s === 'error') return { cls: 'error', text: 'Lỗi DB' }; return { cls: '', text: 'Chưa đồng bộ' }; }
function renderReports() { els.reportCount.textContent = state.reports.length; if (!state.reports.length) { els.reportList.innerHTML = '<p class="note">Chưa có báo cáo nào.</p>'; return; } els.reportList.innerHTML = state.reports.map((r) => { const s = syncMeta(r); return `<button type="button" class="report-card ${r.id === state.activeReportId ? 'active' : ''}" data-report-id="${r.id}"><h3>${esc(r.kind || 'Thị trường')} · ${esc(r.market || 'Chưa ghi')}</h3><p>${viDate(r.date)} · ${r.customers.length} khách</p><p>Sales: ${esc(r.sales)}</p><em class="${s.cls}">${s.text}</em></button>`; }).join(''); }
function renderStats(r) { const rows = [['Tổng khách', r.customers.length], ['Cần mẫu', r.customers.filter((c) => needs(c, 'sample')).length], ['Báo A Tân', r.customers.filter((c) => needs(c, 'follow')).length], ['Cần xử lý', r.customers.filter((c) => needs(c, 'bad')).length]]; els.statsGrid.innerHTML = rows.map(([a, b]) => `<div class="stat-card"><span>${a}</span><strong>${b}</strong></div>`).join(''); }
function customerMatch(c) { const q = els.searchInput.value.trim().toLowerCase(); const pf = els.productFilter.value; const af = els.actionFilter.value; const text = [c.name, c.area, c.testType, c.note, ...c.marketTags, ...Object.entries(c.tests).flatMap(([p, t]) => [p, statusLabel(t.status), t.note])].join(' ').toLowerCase(); return (!q || text.includes(q)) && (pf === 'all' || c.tests[pf]?.status !== 'pending' || c.tests[pf]?.note) && (af === 'all' || needs(c, af) || Object.values(c.tests).some((t) => statusGroup(t.status) === af)); }
function renderCustomers(r) { const list = r.customers.filter(customerMatch); els.customerCount.textContent = `${list.length} khách`; if (!list.length) { els.customerList.innerHTML = '<p class="note">Chưa có khách phù hợp.</p>'; return; } els.customerList.innerHTML = list.map((c) => { const active = PRODUCTS.map((p) => ({ p: p.name, t: c.tests[p.name] || { status: 'pending', note: '' } })).filter(({ t }) => t.status !== 'pending' || t.note); const tags = active.length ? active.map(({ p, t }) => `<span class="tag ${statusClass(t.status)} compact-test">${p.replace('Trà ', '')}: ${statusLabel(t.status)}${t.note ? ` · ${esc(t.note)}` : ''}</span>`).join('') : '<span class="tag pending compact-test">6 SP chưa thử</span>'; const market = c.marketTags.map((t) => `<span class="tag warn">${esc(t)}</span>`).join(''); return `<article class="customer-card"><div class="customer-top"><div><h3>${esc(c.name)}</h3><div class="customer-meta"><span>${esc(c.area || 'Chưa ghi khu vực')}</span><span>·</span><span>${esc(c.testType)}</span>${c.followDate ? `<span>· Hẹn: ${viDate(c.followDate)}</span>` : ''}</div></div><div class="customer-actions"><button class="tiny-btn" data-edit-customer="${c.id}" type="button">Sửa</button><button class="tiny-btn danger" data-delete-customer="${c.id}" type="button">Xóa</button></div></div><div class="tag-row compact-tests">${tags}</div>${market ? `<div class="tag-row market-row">${market}</div>` : ''}${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}</article>`; }).join(''); }
function renderDetail() { const r = activeReport(); els.emptyState.hidden = !!r; els.reportDetail.hidden = !r; if (!r) return; const s = syncMeta(r); els.activeReportDate.textContent = viDate(r.date); els.activeReportTitle.textContent = `${r.kind || 'Thị trường'} · ${r.market || 'chưa ghi'}`; els.activeReportMeta.textContent = `Sales: ${r.sales}${r.note ? ` · ${r.note}` : ''}`; els.activeSyncStatus.className = s.cls; els.activeSyncStatus.textContent = s.text; renderStats(r); renderCustomers(r); }
function render() { renderHome(); renderSupabase(); renderSheet(); renderReports(); renderDetail(); }

function buildTeaEditor(c = null) { els.teaTests.innerHTML = PRODUCTS.map((p) => { const t = c?.tests?.[p.name] || { status: 'pending', note: '' }; const pills = STATUS.map((s) => `<button type="button" class="status-pill ${t.status === s.id ? 'active' : ''}" data-product="${p.id}" data-status="${s.id}">${s.icon} ${s.label}</button>`).join(''); return `<div class="tea-row" data-product-row="${p.id}"><div class="tea-title"><span>${p.name}</span><small>test</small></div><div class="pill-row">${pills}</div><input data-note-for="${p.id}" type="text" value="${esc(t.note)}" placeholder="Ghi chú..." /></div>`; }).join(''); }
function buildMarketChips(selected = []) { els.marketChips.innerHTML = MARKET.map((m) => `<button type="button" class="market-chip ${selected.includes(m) ? 'active' : ''}" data-market-chip="${esc(m)}">${m}</button>`).join(''); }
function buildProductFilter() { els.productFilter.innerHTML = '<option value="all">Tất cả sản phẩm</option>' + PRODUCTS.map((p) => `<option value="${esc(p.name)}">${p.name}</option>`).join(''); }
function resetCustomerForm() { els.editingCustomerId.value = ''; els.customerForm.reset(); els.testType.value = 'Trà ONA Test'; els.editorTitle.textContent = 'Thêm khách hàng'; els.cancelEditBtn.hidden = true; buildTeaEditor(); buildMarketChips(); }
function collectCustomer() { const tests = {}; PRODUCTS.forEach((p) => { const row = document.querySelector(`[data-product-row="${p.id}"]`); const active = row?.querySelector('.status-pill.active'); const note = row?.querySelector(`[data-note-for="${p.id}"]`)?.value.trim() || ''; tests[p.name] = { status: active?.dataset.status || 'pending', note }; }); return normalizeCustomer({ id: els.editingCustomerId.value || uid('cus'), name: els.customerName.value.trim(), area: els.customerArea.value.trim(), testType: els.testType.value, followDate: els.followDate.value, note: els.customerNote.value.trim(), marketTags: [...els.marketChips.querySelectorAll('.market-chip.active')].map((x) => x.dataset.marketChip), tests }); }

function createReport(e) { e.preventDefault(); const r = normalizeReport({ id: uid('report'), kind: els.reportKind?.value || 'Thị trường', date: els.reportDate.value, market: els.reportMarket.value.trim(), sales: els.reportSales.value.trim() || 'A Tân', note: els.reportNote.value.trim(), createdAt: new Date().toISOString(), customers: [] }); state.reports.unshift(r); state.activeReportId = r.id; save(); els.reportForm.reset(); els.reportDate.value = today(); els.reportSales.value = 'A Tân'; if (els.reportKind) els.reportKind.value = 'Thị trường'; render(); toast('Đã tạo báo cáo.'); }
function saveCustomer(e) { e.preventDefault(); const r = activeReport(); if (!r) return toast('Tạo hoặc chọn báo cáo trước.'); const c = collectCustomer(); if (!c.name) return toast('Nhập tên khách hàng trước.'); const i = r.customers.findIndex((x) => x.id === c.id); if (i >= 0) r.customers[i] = c; else r.customers.push(c); dirty(r); save(); resetCustomerForm(); render(); toast(i >= 0 ? 'Đã cập nhật khách.' : 'Đã thêm khách.'); }
function editCustomer(id) { const c = activeReport()?.customers.find((x) => x.id === id); if (!c) return; els.editingCustomerId.value = c.id; els.customerName.value = c.name; els.customerArea.value = c.area; els.testType.value = c.testType; els.followDate.value = c.followDate; els.customerNote.value = c.note; els.editorTitle.textContent = `Đang sửa: ${c.name}`; els.cancelEditBtn.hidden = false; buildTeaEditor(c); buildMarketChips(c.marketTags); els.customerEditor.open = true; els.customerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
function deleteCustomer(id) { const r = activeReport(); if (!r) return; const c = r.customers.find((x) => x.id === id); if (!c || !confirm(`Xóa khách ${c.name}?`)) return; r.customers = r.customers.filter((x) => x.id !== id); dirty(r); save(); render(); toast('Đã xóa khách.'); }

function summary(r) { const lines = [`BÁO CÁO ${String(r.kind || 'THỊ TRƯỜNG').toUpperCase()}`, `Ngày: ${viDate(r.date)}`, `Loại: ${r.kind || 'Thị trường'}`, `Thị trường: ${r.market}`, `Sales: ${r.sales}`, '', `Tổng khách: ${r.customers.length}`, '']; r.customers.forEach((c, i) => { lines.push(`${i + 1}. ${c.name}${c.area ? ` - ${c.area}` : ''}`); PRODUCTS.forEach((p) => { const t = c.tests[p.name]; if (t.status !== 'pending' || t.note) lines.push(`- ${p.name}: ${statusLabel(t.status)}${t.note ? ` (${t.note})` : ''}`); }); if (c.marketTags.length) lines.push(`- Thị trường: ${c.marketTags.join(', ')}`); if (c.followDate) lines.push(`- Hẹn báo lại: ${viDate(c.followDate)}`); if (c.note) lines.push(`- Ghi chú: ${c.note}`); lines.push(''); }); return lines.join('\n'); }
async function copySummary() { const r = activeReport(); if (!r) return; try { await navigator.clipboard.writeText(summary(r)); toast('Đã copy báo cáo.'); } catch { toast('Không copy được.'); } }
function csvCell(v) { return `"${String(v ?? '').replaceAll('"', '""')}"`; }
function buildCsv(r) { const headers = ['Loại báo cáo', 'Ngày', 'Thị trường', 'Sales', 'Tên khách', 'Khu vực', ...PRODUCTS.flatMap((p) => [`${p.name} - trạng thái`, `${p.name} - ghi chú`]), 'Tags', 'Ghi chú']; const rows = r.customers.map((c) => [r.kind || 'Thị trường', r.date, r.market, r.sales, c.name, c.area, ...PRODUCTS.flatMap((p) => [statusLabel(c.tests[p.name]?.status), c.tests[p.name]?.note || '']), c.marketTags.join('; '), c.note]); return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n'); }
function downloadBlob(blob, filename) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1200); }
async function exportCsv() { const r = activeReport(); if (!r) return; const filename = `${fileSafe(`bao-cao-${r.kind}-${r.market}-${r.date}`)}.csv`; const blob = new Blob([`\ufeff${buildCsv(r)}`], { type: 'text/csv;charset=utf-8' }); downloadBlob(blob, filename); uploadExport(blob, filename, 'csv', r); toast('Đã tải CSV về máy.'); }
async function exportTxt() { const r = activeReport(); if (!r) return; const filename = `${fileSafe(`bao-cao-${r.kind}-${r.market}-${r.date}`)}.txt`; const blob = new Blob([summary(r)], { type: 'text/plain;charset=utf-8' }); downloadBlob(blob, filename); uploadExport(blob, filename, 'txt', r); toast('Đã tải TXT về máy.'); }

function saveSupabase(show = true) { state.settings.supabaseUrl = normalizeSupabaseUrl(els.supabaseUrl?.value || DEFAULT_SUPABASE_URL); state.settings.supabaseAnonKey = els.supabaseAnonKey?.value.trim() || ''; save(); renderSupabase(); if (show) toast('Đã lưu Supabase.'); }
function supabaseReady(show = true) { saveSupabase(false); if (!state.settings.supabaseUrl || !state.settings.supabaseAnonKey) { if (show) toast('Dán Supabase URL và anon/publishable key trước.'); return false; } return true; }
function sbHeaders(extra = {}) { const key = state.settings.supabaseAnonKey; const headers = { apikey: key, 'Content-Type': 'application/json', ...extra }; if (!isPublishableKey(key)) headers.Authorization = `Bearer ${key}`; return headers; }
async function sbFetch(path, options = {}) { if (!supabaseReady(false)) throw new Error('Thiếu Supabase URL/key'); const res = await fetch(`${state.settings.supabaseUrl}${path}`, { ...options, headers: { ...sbHeaders(), ...(options.headers || {}) } }); if (!res.ok) { const text = await res.text(); throw new Error(text || `Supabase lỗi ${res.status}`); } return res; }
async function sbUpsert(table, rows, conflict = 'id') { if (!rows.length) return; const path = `/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`; await sbFetch(path, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) }); }
async function sbInsert(table, rows) { if (!rows.length) return; await sbFetch(`/rest/v1/${table}`, { method: 'POST', body: JSON.stringify(rows) }); }
async function sbDelete(table, query) { await sbFetch(`/rest/v1/${table}?${query}`, { method: 'DELETE' }); }

function reportRow(r) { return { id: r.id, kind: r.kind || 'Thị trường', report_date: r.date || null, market: r.market || '', sales: r.sales || '', note: r.note || '', total_customers: r.customers.length, need_sample: r.customers.filter((c) => needs(c, 'sample')).length, follow_count: r.customers.filter((c) => needs(c, 'follow')).length, bad_count: r.customers.filter((c) => needs(c, 'bad')).length, raw_payload: payload(r), created_at: r.createdAt || new Date().toISOString(), updated_at: r.updatedAt || new Date().toISOString(), synced_at: new Date().toISOString() }; }
function customerRows(r) { return r.customers.map((c) => ({ id: c.id, report_id: r.id, name: c.name, area: c.area || '', test_type: c.testType || '', follow_date: c.followDate || null, market_tags: c.marketTags || [], note: c.note || '', updated_at: new Date().toISOString() })); }
function productTestRows(r) { return r.customers.flatMap((c) => PRODUCTS.map((p) => { const t = c.tests[p.name] || { status: 'pending', note: '' }; return { report_id: r.id, customer_id: c.id, product_name: p.name, status: t.status || 'pending', note: t.note || '' }; })); }

async function syncReport(r) {
  if (!r || !supabaseReady()) return false;
  r.sync = { status: 'sending', lastAt: new Date().toISOString(), message: 'Đang đẩy DB' };
  save(); render();
  try {
    await sbUpsert('reports', [reportRow(r)]);
    await sbDelete('customers', `report_id=eq.${encodeURIComponent(r.id)}`);
    await sbInsert('customers', customerRows(r));
    await sbInsert('product_tests', productTestRows(r));
    r.sync = { status: 'synced', lastAt: new Date().toISOString(), message: 'Đã đẩy DB' };
    save(); render();
    return true;
  } catch (error) {
    console.error(error);
    r.sync = { status: 'error', lastAt: new Date().toISOString(), message: error.message };
    save(); render();
    toast(`Lỗi DB: ${error.message.slice(0, 110)}`);
    return false;
  }
}
async function syncActiveReport() { const r = activeReport(); if (!r) return toast('Chọn báo cáo trước.'); const ok = await syncReport(r); if (ok) toast('Đã đẩy báo cáo lên Supabase DB.'); }
async function syncAllSupabase() { let ok = 0; for (const r of state.reports) if (await syncReport(r)) ok++; toast(`Đã đẩy ${ok}/${state.reports.length} báo cáo lên DB.`); }
async function testSupabase() { const r = normalizeReport({ id: `test-${Date.now()}`, kind: 'Test', date: today(), market: 'TEST SUPABASE DB', sales: 'Bépi App', note: 'Dòng test từ PWA.', createdAt: new Date().toISOString(), customers: [makeCustomer('Khách test Supabase', 'Test app', { 'Trà Đen': ['ok', 'test ghi DB'] }, ['Giá tốt'], 'Có thể xóa dòng test này.')] }); const ok = await syncReport(r); if (ok) toast('Test DB OK. Vào Supabase xem bảng reports/customers.'); }

async function uploadExport(blob, filename, type, r) {
  if (!state.settings.supabaseUrl || !state.settings.supabaseAnonKey) return;
  try {
    const path = `exports/${r.date || today()}/${r.id}/${filename}`;
    const uploadUrl = `${state.settings.supabaseUrl}/storage/v1/object/${EXPORT_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
    const res = await fetch(uploadUrl, { method: 'POST', headers: sbHeaders({ 'x-upsert': 'true', 'Content-Type': blob.type || 'application/octet-stream' }), body: blob });
    if (!res.ok) throw new Error(await res.text());
    const publicUrl = `${state.settings.supabaseUrl}/storage/v1/object/public/${EXPORT_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`;
    await sbInsert('exports', [{ report_id: r.id, export_type: type, file_path: path, file_url: publicUrl }]);
  } catch (error) { console.warn('Upload export failed', error); }
}

function saveSheet(show = true) { state.settings.sheetEndpoint = els.sheetUrl?.value.trim() || ''; state.settings.createDriveFile = !!els.createDriveFile?.checked; state.settings.driveFolderId = els.driveFolderId?.value.trim() || ''; save(); renderSheet(); if (show) toast('Đã lưu Sheet/Drive dự phòng.'); }
function autosaveSettings() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { saveSupabase(false); saveSheet(false); }, 400); }
function endpoint() { saveSheet(false); if (!state.settings.sheetEndpoint) { toast('Dán link Apps Script /exec trước.'); return ''; } return state.settings.sheetEndpoint; }
function openSheetApi() { const url = endpoint(); if (!url) return; window.open(url, '_blank', 'noopener,noreferrer'); }
function payload(r, action = 'upsertReport') { return { action, source: 'Bépi Field Report PWA', submittedAt: new Date().toISOString(), settings: { createDriveFile: state.settings.createDriveFile, driveFolderId: state.settings.driveFolderId }, report: { id: r.id, kind: r.kind || 'Thị trường', date: r.date, market: r.market, sales: r.sales, note: r.note, createdAt: r.createdAt, updatedAt: r.updatedAt, summary: { totalCustomers: r.customers.length, needSample: r.customers.filter((c) => needs(c, 'sample')).length, follow: r.customers.filter((c) => needs(c, 'follow')).length, bad: r.customers.filter((c) => needs(c, 'bad')).length } }, products: PRODUCTS.map((p) => p.name), customers: r.customers.map((c) => ({ id: c.id, name: c.name, area: c.area, testType: c.testType, followDate: c.followDate, marketTags: c.marketTags, note: c.note, tests: c.tests })) }; }
function post(url, data) { const name = `sheet_${Date.now()}`; const iframe = document.createElement('iframe'); const form = document.createElement('form'); const input = document.createElement('input'); iframe.name = name; iframe.hidden = true; form.hidden = true; form.method = 'POST'; form.action = url; form.target = name; input.type = 'hidden'; input.name = 'payload'; input.value = JSON.stringify(data); form.append(input); document.body.append(iframe, form); form.submit(); setTimeout(() => { iframe.remove(); form.remove(); }, 1600); }
async function sendTestSheet() { const r = normalizeReport({ id: `test-${Date.now()}`, kind: 'Test', date: today(), market: 'TEST KẾT NỐI SHEET', sales: 'Bépi App', note: 'Dòng test từ PWA.', createdAt: new Date().toISOString(), customers: [makeCustomer('Khách test', 'Test app', { 'Trà Đen': ['ok', 'test ghi Sheet'] }, ['Giá tốt'], 'Có thể xóa dòng test này.')] }); const url = endpoint(); if (!url) return; post(url, payload(r, 'testReport')); toast('Đã gửi test Sheet dự phòng.'); }
async function syncAllReports() { const url = endpoint(); if (!url) return; for (const r of state.reports) post(url, payload(r)); toast('Đã gửi tất cả báo cáo qua Sheet dự phòng.'); }

function makeCustomer(name, area = '', pairs = {}, tags = [], note = '') { const tests = emptyTests(); Object.entries(pairs).forEach(([p, [status, n]]) => tests[p] = { status, note: n || '' }); return normalizeCustomer({ name, area, testType: 'Trà ONA Test', marketTags: tags, note, tests }); }
function seedData() { const r = normalizeReport({ id: uid('report'), kind: 'Thị trường', date: today(), market: 'Chợ Gạo', sales: 'A Tân', note: 'Dữ liệu mẫu', createdAt: new Date().toISOString(), customers: [makeCustomer('Hai Phượng', 'Chợ Gạo', { 'Trà Quả Mộng': ['sample', 'cần mẫu lớn'], 'Trà Gạo Rang': ['sample', 'cần mẫu lớn'] }, ['Cần mẫu lớn']), makeCustomer('Châu', '', { 'Trà Quả Mộng': ['interested', 'sẽ thử'], 'Trà Gạo Rang': ['ok', 'giống cũ'] }), makeCustomer('ToTo', '', { 'Trà Quả Mộng': ['sample', 'ok'], 'Trà Lài': ['ok', 'thơm'] }, ['Đang bán hãng khác'])] }); state.reports.unshift(r); state.activeReportId = r.id; save(); render(); }
function clearAllData() { if (!confirm('Xóa toàn bộ dữ liệu lưu trên máy này?')) return; localStorage.removeItem(STORAGE_KEY); OLD_KEYS.forEach((k) => localStorage.removeItem(k)); state = { reports: [], activeReportId: '', settings: { sheetEndpoint: '', createDriveFile: false, driveFolderId: '', supabaseUrl: DEFAULT_SUPABASE_URL, supabaseAnonKey: '' } }; resetCustomerForm(); render(); }

function bind() {
  els.reportForm.addEventListener('submit', createReport);
  els.customerForm.addEventListener('submit', saveCustomer);
  els.seedBtn.addEventListener('click', seedData);
  els.clearBtn.addEventListener('click', clearAllData);
  els.saveSupabaseBtn?.addEventListener('click', () => saveSupabase(true));
  els.supabaseUrl?.addEventListener('input', autosaveSettings);
  els.supabaseAnonKey?.addEventListener('input', autosaveSettings);
  els.testSupabaseBtn?.addEventListener('click', testSupabase);
  els.syncAllSupabaseBtn?.addEventListener('click', syncAllSupabase);
  els.saveSheetBtn?.addEventListener('click', () => saveSheet(true));
  els.sheetUrl?.addEventListener('input', autosaveSettings);
  els.driveFolderId?.addEventListener('input', autosaveSettings);
  els.createDriveFile?.addEventListener('change', () => saveSheet(false));
  els.openSheetApiBtn?.addEventListener('click', openSheetApi);
  els.testSheetBtn?.addEventListener('click', sendTestSheet);
  els.syncActiveReportBtn.addEventListener('click', syncActiveReport);
  els.syncAllReportsBtn?.addEventListener('click', syncAllReports);
  els.copySummaryBtn.addEventListener('click', copySummary);
  els.exportTxtBtn?.addEventListener('click', exportTxt);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.cancelEditBtn.addEventListener('click', resetCustomerForm);
  els.searchInput.addEventListener('input', renderDetail);
  els.productFilter.addEventListener('change', renderDetail);
  els.actionFilter.addEventListener('change', renderDetail);
  els.reportList.addEventListener('click', (e) => { const card = e.target.closest('[data-report-id]'); if (!card) return; state.activeReportId = card.dataset.reportId; save(); render(); document.querySelector('#workspaceSection')?.scrollIntoView({ behavior: 'smooth' }); });
  els.teaTests.addEventListener('click', (e) => { const pill = e.target.closest('.status-pill'); if (!pill) return; const row = pill.closest('.tea-row'); row.querySelectorAll('.status-pill').forEach((x) => x.classList.remove('active')); pill.classList.add('active'); });
  els.marketChips.addEventListener('click', (e) => { const chip = e.target.closest('.market-chip'); if (chip) chip.classList.toggle('active'); });
  els.customerList.addEventListener('click', (e) => { const edit = e.target.closest('[data-edit-customer]'); const del = e.target.closest('[data-delete-customer]'); if (edit) editCustomer(edit.dataset.editCustomer); if (del) deleteCustomer(del.dataset.deleteCustomer); });
  els.quickAddBtn.addEventListener('click', () => { if (!activeReport()) return toast('Tạo hoặc chọn báo cáo trước.'); els.customerEditor.open = true; els.customerEditor.scrollIntoView({ behavior: 'smooth' }); });
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; els.installBtn.hidden = false; });
  els.installBtn.addEventListener('click', async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; els.installBtn.hidden = true; });
}

function boot() {
  els.reportDate.value = today();
  if (els.reportKind) els.reportKind.value = 'Thị trường';
  buildProductFilter(); buildTeaEditor(); buildMarketChips(); load();
  if (state.activeReportId && !state.reports.some((r) => r.id === state.activeReportId)) state.activeReportId = state.reports[0]?.id || '';
  bind(); render();
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.warn));
}

boot();
