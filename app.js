const STORAGE_KEY = 'bepi-field-report-v3';
const OLD_KEYS = ['tea-survey-reports-v2', 'tea-survey-reports-v1'];

const TEA_PRODUCTS = [
  'Trà Đen',
  'Trà Quả Mộng',
  'Trà Gạo Rang',
  'Trà Lài',
  'Trà Olong',
  'Trà Olong Sen'
];

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Chưa thử', icon: '○' },
  { id: 'ok', label: 'OK', icon: '✓' },
  { id: 'interested', label: 'Quan tâm', icon: '◎' },
  { id: 'sample', label: 'Cần mẫu', icon: '+' },
  { id: 'follow', label: 'Báo Tân', icon: '↗' },
  { id: 'bad', label: 'Chưa tốt', icon: '!' },
  { id: 'retry', label: 'Thử lại', icon: '↻' }
];

const MARKET_OPTIONS = [
  'Giá tốt',
  'Giá cao',
  'Ngọt',
  'Lạt',
  'Béo',
  'Thơm',
  'Đậm',
  'Nhạt',
  'Dễ bán',
  'Khó uống',
  'Đang bán hãng khác',
  'Cần mẫu lớn',
  'Chủ đi vắng',
  'Báo sau cho A Tân'
];

const els = {
  installBtn: document.querySelector('#installBtn'),
  connectionStatus: document.querySelector('#connectionStatus'),
  homeStats: document.querySelector('#homeStats'),
  reportForm: document.querySelector('#reportForm'),
  reportDate: document.querySelector('#reportDate'),
  reportMarket: document.querySelector('#reportMarket'),
  reportSales: document.querySelector('#reportSales'),
  reportNote: document.querySelector('#reportNote'),
  seedBtn: document.querySelector('#seedBtn'),
  clearBtn: document.querySelector('#clearBtn'),
  sheetUrl: document.querySelector('#sheetUrl'),
  sheetStatus: document.querySelector('#sheetStatus'),
  saveSheetBtn: document.querySelector('#saveSheetBtn'),
  openSheetApiBtn: document.querySelector('#openSheetApiBtn'),
  testSheetBtn: document.querySelector('#testSheetBtn'),
  syncAllReportsBtn: document.querySelector('#syncAllReportsBtn'),
  reportCount: document.querySelector('#reportCount'),
  reportList: document.querySelector('#reportList'),
  emptyState: document.querySelector('#emptyState'),
  reportDetail: document.querySelector('#reportDetail'),
  activeReportDate: document.querySelector('#activeReportDate'),
  activeReportTitle: document.querySelector('#activeReportTitle'),
  activeReportMeta: document.querySelector('#activeReportMeta'),
  activeSyncStatus: document.querySelector('#activeSyncStatus'),
  syncActiveReportBtn: document.querySelector('#syncActiveReportBtn'),
  copySummaryBtn: document.querySelector('#copySummaryBtn'),
  exportCsvBtn: document.querySelector('#exportCsvBtn'),
  statsGrid: document.querySelector('#statsGrid'),
  searchInput: document.querySelector('#searchInput'),
  productFilter: document.querySelector('#productFilter'),
  actionFilter: document.querySelector('#actionFilter'),
  customerEditor: document.querySelector('#customerEditor'),
  editorTitle: document.querySelector('#editorTitle'),
  customerForm: document.querySelector('#customerForm'),
  editingCustomerId: document.querySelector('#editingCustomerId'),
  customerName: document.querySelector('#customerName'),
  customerArea: document.querySelector('#customerArea'),
  testType: document.querySelector('#testType'),
  followDate: document.querySelector('#followDate'),
  customerNote: document.querySelector('#customerNote'),
  teaTests: document.querySelector('#teaTests'),
  marketChips: document.querySelector('#marketChips'),
  cancelEditBtn: document.querySelector('#cancelEditBtn'),
  customerCount: document.querySelector('#customerCount'),
  customerList: document.querySelector('#customerList'),
  quickAddBtn: document.querySelector('#quickAddBtn'),
  toast: document.querySelector('#toast')
};

let state = {
  reports: [],
  activeReportId: '',
  settings: {
    sheetEndpoint: ''
  }
};

let deferredInstallPrompt = null;
let sheetSaveTimer = null;

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return '--';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(new Date(`${value}T00:00:00`));
}

function formatDateTime(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttribute(value = '') {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.remove('show'), 3300);
}

function normalizeReport(report = {}) {
  return {
    id: report.id || uid('report'),
    date: report.date || today(),
    market: report.market || '',
    sales: report.sales || 'A Tân',
    note: report.note || '',
    createdAt: report.createdAt || new Date().toISOString(),
    updatedAt: report.updatedAt || report.createdAt || new Date().toISOString(),
    sync: report.sync || { status: 'pending', lastAt: '', message: '' },
    customers: Array.isArray(report.customers) ? report.customers.map(normalizeCustomer) : []
  };
}

function normalizeCustomer(customer = {}) {
  const tests = {};
  TEA_PRODUCTS.forEach((product) => {
    const current = customer.tests?.[product] || {};
    tests[product] = {
      status: current.status || 'pending',
      note: current.note || ''
    };
  });

  return {
    id: customer.id || uid('cus'),
    name: customer.name || '',
    area: customer.area || '',
    testType: customer.testType || 'Trà ONA Test',
    followDate: customer.followDate || '',
    note: customer.note || '',
    marketTags: Array.isArray(customer.marketTags) ? customer.marketTags : [],
    tests
  };
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    let raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      for (const key of OLD_KEYS) {
        raw = localStorage.getItem(key);
        if (raw) break;
      }
    }
    if (!raw) return;

    const parsed = JSON.parse(raw);
    state = {
      reports: Array.isArray(parsed.reports) ? parsed.reports.map(normalizeReport) : [],
      activeReportId: parsed.activeReportId || '',
      settings: {
        sheetEndpoint: parsed.settings?.sheetEndpoint || ''
      }
    };
    save();
  } catch (error) {
    console.error(error);
    toast('Không đọc được dữ liệu cũ. App sẽ tạo dữ liệu mới.');
  }
}

function getActiveReport() {
  return state.reports.find((report) => report.id === state.activeReportId) || null;
}

function setReportDirty(report) {
  if (!report) return;
  report.updatedAt = new Date().toISOString();
  if (report.sync.status === 'synced') {
    report.sync = { status: 'pending', lastAt: report.sync.lastAt, message: 'Có chỉnh sửa mới' };
  }
}

function statusLabel(statusId) {
  return STATUS_OPTIONS.find((item) => item.id === statusId)?.label || 'Chưa thử';
}

function statusIcon(statusId) {
  return STATUS_OPTIONS.find((item) => item.id === statusId)?.icon || '○';
}

function statusClass(statusId) {
  if (['ok', 'interested', 'sample'].includes(statusId)) return 'good';
  if (['follow', 'retry'].includes(statusId)) return 'warn';
  if (statusId === 'bad') return 'bad';
  return 'pending';
}

function statusGroup(statusId) {
  return statusId === 'retry' ? 'bad' : statusId;
}

function customerNeeds(customer, group) {
  const tests = Object.values(customer.tests || {});
  if (group === 'follow') {
    return tests.some((test) => statusGroup(test.status) === 'follow')
      || customer.marketTags.some((tag) => tag.toLowerCase().includes('báo sau'))
      || /báo\s*(a\s*)?tân|báo sau/i.test(customer.note || '');
  }
  if (group === 'sample') {
    return tests.some((test) => statusGroup(test.status) === 'sample')
      || customer.marketTags.some((tag) => tag.toLowerCase().includes('mẫu'))
      || /mẫu/i.test(customer.note || '');
  }
  if (group === 'bad') {
    return tests.some((test) => ['bad', 'retry'].includes(test.status))
      || customer.marketTags.some((tag) => ['khó uống', 'nhạt', 'giá cao'].includes(tag.toLowerCase()));
  }
  return tests.some((test) => statusGroup(test.status) === group);
}

function syncMeta(report) {
  const status = report.sync?.status || 'pending';
  if (status === 'synced') return { cls: 'synced', text: `Đã gửi${report.sync.lastAt ? ` · ${formatDateTime(report.sync.lastAt)}` : ''}` };
  if (status === 'sending') return { cls: 'sending', text: 'Đang gửi...' };
  if (status === 'error') return { cls: 'error', text: 'Lỗi đồng bộ' };
  return { cls: '', text: 'Chưa đồng bộ' };
}

function renderHomeStats() {
  const totalReports = state.reports.length;
  const totalCustomers = state.reports.reduce((sum, report) => sum + report.customers.length, 0);
  els.homeStats.innerHTML = `
    <div><strong>${totalReports}</strong><span>báo cáo</span></div>
    <div><strong>${totalCustomers}</strong><span>khách</span></div>
  `;
}

function renderSheetStatus() {
  const endpoint = state.settings.sheetEndpoint;
  els.sheetUrl.value = endpoint;
  if (!endpoint) {
    els.connectionStatus.textContent = 'Chưa nối Google Sheet';
    els.sheetStatus.className = 'sheet-status warn';
    els.sheetStatus.innerHTML = 'Chưa có link. Dán Web App URL kết thúc bằng <b>/exec</b>; app sẽ tự lưu.';
    return;
  }

  const looksRight = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/.test(endpoint);
  els.connectionStatus.textContent = looksRight ? 'Đã lưu link Google Sheet' : 'Link Sheet chưa đúng định dạng';
  els.sheetStatus.className = `sheet-status ${looksRight ? 'ok' : 'warn'}`;
  els.sheetStatus.innerHTML = looksRight
    ? 'Đã lưu link. Bấm <b>Mở link</b> phải thấy JSON OK, rồi bấm <b>Gửi test</b>.'
    : 'Link chưa giống Web App URL. Cần link dạng <b>https://script.google.com/macros/s/.../exec</b>.';
}

function renderReports() {
  els.reportCount.textContent = state.reports.length;
  if (!state.reports.length) {
    els.reportList.innerHTML = '<p class="note">Chưa có báo cáo nào.</p>';
    return;
  }

  els.reportList.innerHTML = state.reports
    .slice()
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
    .map((report) => {
      const sync = syncMeta(report);
      return `
        <button type="button" class="report-card ${report.id === state.activeReportId ? 'active' : ''}" data-report-id="${report.id}">
          <h3>${escapeHtml(report.market || 'Chưa ghi thị trường')}</h3>
          <p>${formatDate(report.date)} · ${report.customers.length} khách</p>
          <p>Sales: ${escapeHtml(report.sales || 'Chưa ghi')}</p>
          <em class="${sync.cls}">${sync.text}</em>
        </button>
      `;
    }).join('');
}

function renderDetail() {
  const report = getActiveReport();
  els.emptyState.hidden = Boolean(report);
  els.reportDetail.hidden = !report;
  if (!report) return;

  const sync = syncMeta(report);
  els.activeReportDate.textContent = formatDate(report.date);
  els.activeReportTitle.textContent = `Thị trường ${report.market || 'chưa ghi'}`;
  els.activeReportMeta.textContent = `Sales: ${report.sales || 'Chưa ghi'}${report.note ? ` · ${report.note}` : ''}`;
  els.activeSyncStatus.className = sync.cls;
  els.activeSyncStatus.textContent = sync.text;

  renderStats(report);
  renderCustomers(report);
}

function renderStats(report) {
  const customers = report.customers;
  const stats = [
    { label: 'Tổng khách', value: customers.length },
    { label: 'Cần mẫu', value: customers.filter((customer) => customerNeeds(customer, 'sample')).length },
    { label: 'Báo A Tân', value: customers.filter((customer) => customerNeeds(customer, 'follow')).length },
    { label: 'Cần xử lý', value: customers.filter((customer) => customerNeeds(customer, 'bad')).length }
  ];

  els.statsGrid.innerHTML = stats.map((item) => `
    <div class="stat-card"><span>${item.label}</span><strong>${item.value}</strong></div>
  `).join('');
}

function filteredCustomers(report) {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const product = els.productFilter.value;
  const action = els.actionFilter.value;

  return report.customers.filter((customer) => {
    const text = [
      customer.name,
      customer.area,
      customer.testType,
      customer.note,
      ...customer.marketTags,
      ...Object.entries(customer.tests).flatMap(([name, test]) => [name, statusLabel(test.status), test.note])
    ].join(' ').toLowerCase();

    const keywordMatch = !keyword || text.includes(keyword);
    const productMatch = product === 'all' || customer.tests[product]?.status !== 'pending' || customer.tests[product]?.note;
    const actionMatch = action === 'all' || customerNeeds(customer, action) || Object.values(customer.tests).some((test) => statusGroup(test.status) === action);
    return keywordMatch && productMatch && actionMatch;
  });
}

function renderCustomers(report) {
  const customers = filteredCustomers(report);
  els.customerCount.textContent = `${customers.length} khách`;
  if (!customers.length) {
    els.customerList.innerHTML = '<p class="note">Chưa có khách phù hợp bộ lọc.</p>';
    return;
  }

  els.customerList.innerHTML = customers.map((customer) => {
    const productGrid = TEA_PRODUCTS.map((product) => {
      const test = customer.tests[product] || { status: 'pending', note: '' };
      return `
        <div class="product-cell">
          <b>${product}</b>
          <span class="tag ${statusClass(test.status)}">${statusIcon(test.status)} ${statusLabel(test.status)}</span>
          ${test.note ? `<p class="note">${escapeHtml(test.note)}</p>` : ''}
        </div>
      `;
    }).join('');

    const marketTags = customer.marketTags.map((tag) => `<span class="tag warn">${escapeHtml(tag)}</span>`).join('');

    return `
      <article class="customer-card" data-customer-id="${customer.id}">
        <div class="customer-top">
          <div>
            <h3>${escapeHtml(customer.name)}</h3>
            <div class="customer-meta">
              <span>${escapeHtml(customer.area || 'Chưa ghi khu vực')}</span>
              <span>·</span>
              <span>${escapeHtml(customer.testType)}</span>
              ${customer.followDate ? `<span>· Hẹn: ${formatDate(customer.followDate)}</span>` : ''}
            </div>
          </div>
          <div class="customer-actions">
            <button class="tiny-btn" type="button" data-edit-customer="${customer.id}">Sửa</button>
            <button class="tiny-btn danger" type="button" data-delete-customer="${customer.id}">Xóa</button>
          </div>
        </div>
        <div class="product-grid">${productGrid}</div>
        ${marketTags ? `<div class="tag-row">${marketTags}</div>` : ''}
        ${customer.note ? `<p class="note">${escapeHtml(customer.note)}</p>` : ''}
      </article>
    `;
  }).join('');
}

function render() {
  renderHomeStats();
  renderSheetStatus();
  renderReports();
  renderDetail();
}

function buildTeaEditor(customer = null) {
  els.teaTests.innerHTML = TEA_PRODUCTS.map((product) => {
    const test = customer?.tests?.[product] || { status: 'pending', note: '' };
    const pills = STATUS_OPTIONS.map((status) => `
      <button type="button" class="status-pill ${test.status === status.id ? 'active' : ''}" data-product="${escapeAttribute(product)}" data-status="${status.id}">${status.icon} ${status.label}</button>
    `).join('');

    return `
      <div class="tea-row" data-tea-row="${escapeAttribute(product)}">
        <div class="tea-title"><span>${product}</span><small>test</small></div>
        <div class="pill-row">${pills}</div>
        <input type="text" data-note-for="${escapeAttribute(product)}" value="${escapeAttribute(test.note)}" placeholder="Ghi chú: nhạt, thơm, giống cũ..." />
      </div>
    `;
  }).join('');
}

function buildMarketChips(selected = []) {
  els.marketChips.innerHTML = MARKET_OPTIONS.map((item) => `
    <button type="button" class="market-chip ${selected.includes(item) ? 'active' : ''}" data-market-chip="${escapeAttribute(item)}">${item}</button>
  `).join('');
}

function buildProductFilter() {
  els.productFilter.innerHTML = '<option value="all">Tất cả sản phẩm</option>' + TEA_PRODUCTS.map((product) => `<option value="${escapeAttribute(product)}">${product}</option>`).join('');
}

function resetCustomerForm() {
  els.editingCustomerId.value = '';
  els.customerForm.reset();
  els.testType.value = 'Trà ONA Test';
  els.editorTitle.textContent = 'Thêm khách hàng';
  els.cancelEditBtn.hidden = true;
  buildTeaEditor();
  buildMarketChips();
}

function collectCustomerForm() {
  const tests = {};
  TEA_PRODUCTS.forEach((product) => {
    const row = els.teaTests.querySelector(`[data-tea-row="${CSS.escape(product)}"]`);
    const active = row?.querySelector('.status-pill.active');
    const note = row?.querySelector(`[data-note-for="${CSS.escape(product)}"]`)?.value.trim() || '';
    tests[product] = { status: active?.dataset.status || 'pending', note };
  });

  const marketTags = [...els.marketChips.querySelectorAll('.market-chip.active')].map((chip) => chip.dataset.marketChip);
  return normalizeCustomer({
    id: els.editingCustomerId.value || uid('cus'),
    name: els.customerName.value.trim(),
    area: els.customerArea.value.trim(),
    testType: els.testType.value,
    followDate: els.followDate.value,
    note: els.customerNote.value.trim(),
    marketTags,
    tests
  });
}

function createReport(event) {
  event.preventDefault();
  const report = normalizeReport({
    id: uid('report'),
    date: els.reportDate.value,
    market: els.reportMarket.value.trim(),
    sales: els.reportSales.value.trim() || 'A Tân',
    note: els.reportNote.value.trim(),
    createdAt: new Date().toISOString(),
    customers: []
  });

  state.reports.unshift(report);
  state.activeReportId = report.id;
  save();
  els.reportForm.reset();
  els.reportDate.value = today();
  els.reportSales.value = 'A Tân';
  render();
  toast('Đã tạo báo cáo.');
}

function saveCustomer(event) {
  event.preventDefault();
  const report = getActiveReport();
  if (!report) return toast('Tạo hoặc chọn báo cáo trước.');

  const customer = collectCustomerForm();
  if (!customer.name) return toast('Nhập tên khách hàng trước.');

  const index = report.customers.findIndex((item) => item.id === customer.id);
  if (index >= 0) report.customers[index] = customer;
  else report.customers.push(customer);

  setReportDirty(report);
  save();
  resetCustomerForm();
  render();
  toast(index >= 0 ? 'Đã cập nhật khách.' : 'Đã thêm khách.');
}

function editCustomer(id) {
  const report = getActiveReport();
  const customer = report?.customers.find((item) => item.id === id);
  if (!customer) return;

  els.editingCustomerId.value = customer.id;
  els.customerName.value = customer.name;
  els.customerArea.value = customer.area;
  els.testType.value = customer.testType;
  els.followDate.value = customer.followDate;
  els.customerNote.value = customer.note;
  els.editorTitle.textContent = `Đang sửa: ${customer.name}`;
  els.cancelEditBtn.hidden = false;
  buildTeaEditor(customer);
  buildMarketChips(customer.marketTags);
  els.customerEditor.open = true;
  els.customerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteCustomer(id) {
  const report = getActiveReport();
  if (!report) return;
  const customer = report.customers.find((item) => item.id === id);
  if (!customer || !confirm(`Xóa khách "${customer.name}"?`)) return;
  report.customers = report.customers.filter((item) => item.id !== id);
  setReportDirty(report);
  save();
  render();
  toast('Đã xóa khách.');
}

function buildSummary(report) {
  const lines = [
    'BÁO CÁO KHẢO SÁT THỊ TRƯỜNG TRÀ SỮA',
    `Ngày: ${formatDate(report.date)}`,
    `Thị trường: ${report.market}`,
    `Sales: ${report.sales || 'A Tân'}`,
    report.note ? `Ghi chú: ${report.note}` : '',
    '',
    `Tổng khách: ${report.customers.length}`,
    `Cần mẫu: ${report.customers.filter((customer) => customerNeeds(customer, 'sample')).length}`,
    `Báo sau / báo A Tân: ${report.customers.filter((customer) => customerNeeds(customer, 'follow')).length}`,
    ''
  ].filter(Boolean);

  report.customers.forEach((customer, index) => {
    lines.push(`${index + 1}. ${customer.name}${customer.area ? ` - ${customer.area}` : ''}`);
    TEA_PRODUCTS.forEach((product) => {
      const test = customer.tests[product] || { status: 'pending', note: '' };
      if (test.status !== 'pending' || test.note) {
        lines.push(`- ${product}: ${statusLabel(test.status)}${test.note ? ` (${test.note})` : ''}`);
      }
    });
    if (customer.marketTags.length) lines.push(`- Thị trường: ${customer.marketTags.join(', ')}`);
    if (customer.followDate) lines.push(`- Hẹn báo lại: ${formatDate(customer.followDate)}`);
    if (customer.note) lines.push(`- Ghi chú: ${customer.note}`);
    lines.push('');
  });

  return lines.join('\n');
}

async function copySummary() {
  const report = getActiveReport();
  if (!report) return;
  const text = buildSummary(report);
  try {
    await navigator.clipboard.writeText(text);
    toast('Đã copy báo cáo.');
  } catch {
    downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `bao-cao-${report.date}.txt`);
    toast('Không copy được, đã tải TXT.');
  }
}

function exportCsv() {
  const report = getActiveReport();
  if (!report) return;
  const headers = [
    'Ngày', 'Thị trường', 'Sales', 'Tên khách hàng', 'Khu vực', 'Loại SP test',
    ...TEA_PRODUCTS.flatMap((product) => [`${product} - trạng thái`, `${product} - ghi chú`]),
    'Test chung thị trường', 'Hẹn báo lại', 'Ghi chú tổng'
  ];
  const rows = report.customers.map((customer) => [
    report.date,
    report.market,
    report.sales,
    customer.name,
    customer.area,
    customer.testType,
    ...TEA_PRODUCTS.flatMap((product) => [statusLabel(customer.tests[product]?.status), customer.tests[product]?.note || '']),
    customer.marketTags.join('; '),
    customer.followDate,
    customer.note
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  downloadBlob(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }), `bao-cao-${slugify(report.market)}-${report.date}.csv`);
  toast('Đã xuất CSV.');
}

function csvCell(value) {
  return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function slugify(value) {
  return String(value || 'bao-cao')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'bao-cao';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function saveSheetEndpoint(showToast = true) {
  state.settings.sheetEndpoint = els.sheetUrl.value.trim();
  save();
  renderSheetStatus();
  if (showToast) toast(state.settings.sheetEndpoint ? 'Đã lưu link Sheet.' : 'Đã xóa link Sheet.');
}

function scheduleSheetAutosave() {
  clearTimeout(sheetSaveTimer);
  sheetSaveTimer = setTimeout(() => saveSheetEndpoint(false), 450);
}

function getSheetEndpoint() {
  const currentInput = els.sheetUrl.value.trim();
  if (currentInput !== state.settings.sheetEndpoint) {
    state.settings.sheetEndpoint = currentInput;
    save();
    renderSheetStatus();
  }
  if (!state.settings.sheetEndpoint) {
    toast('Dán link Apps Script /exec trước.');
    document.querySelector('#sheetSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return '';
  }
  return state.settings.sheetEndpoint;
}

function openSheetApi() {
  const endpoint = getSheetEndpoint();
  if (!endpoint) return;
  window.open(endpoint, '_blank', 'noopener,noreferrer');
  toast('Tab mới phải hiện JSON OK. Nếu không, Apps Script chưa deploy đúng.');
}

function buildSheetPayload(report, action = 'upsertReport') {
  return {
    action,
    source: 'Bépi Field Report PWA',
    submittedAt: new Date().toISOString(),
    report: {
      id: report.id,
      date: report.date,
      market: report.market,
      sales: report.sales,
      note: report.note,
      createdAt: report.createdAt,
      updatedAt: report.updatedAt,
      summary: {
        totalCustomers: report.customers.length,
        needSample: report.customers.filter((customer) => customerNeeds(customer, 'sample')).length,
        follow: report.customers.filter((customer) => customerNeeds(customer, 'follow')).length,
        bad: report.customers.filter((customer) => customerNeeds(customer, 'bad')).length
      }
    },
    products: TEA_PRODUCTS,
    customers: report.customers.map((customer) => ({
      id: customer.id,
      name: customer.name,
      area: customer.area,
      testType: customer.testType,
      followDate: customer.followDate,
      marketTags: customer.marketTags,
      note: customer.note,
      tests: customer.tests
    }))
  };
}

function postToSheet(endpoint, payload) {
  return new Promise((resolve) => {
    const iframeName = `sheet_post_${Date.now()}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const payloadInput = document.createElement('input');

    iframe.name = iframeName;
    iframe.hidden = true;
    form.hidden = true;
    form.method = 'POST';
    form.action = endpoint;
    form.target = iframeName;
    form.enctype = 'application/x-www-form-urlencoded';

    payloadInput.type = 'hidden';
    payloadInput.name = 'payload';
    payloadInput.value = JSON.stringify(payload);

    form.append(payloadInput);
    document.body.append(iframe, form);
    form.submit();

    setTimeout(() => {
      iframe.remove();
      form.remove();
      resolve(true);
    }, 1600);
  });
}

async function syncReport(report) {
  const endpoint = getSheetEndpoint();
  if (!endpoint || !report) return false;

  report.sync = { status: 'sending', lastAt: new Date().toISOString(), message: 'Đang gửi...' };
  save();
  render();

  try {
    await postToSheet(endpoint, buildSheetPayload(report));
    report.sync = { status: 'synced', lastAt: new Date().toISOString(), message: 'Đã gửi yêu cầu lên Apps Script' };
    save();
    render();
    return true;
  } catch (error) {
    console.error(error);
    report.sync = { status: 'error', lastAt: new Date().toISOString(), message: error.message || 'Không gửi được' };
    save();
    render();
    return false;
  }
}

async function syncActiveReport() {
  const report = getActiveReport();
  if (!report) return toast('Chọn báo cáo trước.');
  els.syncActiveReportBtn.disabled = true;
  const ok = await syncReport(report);
  els.syncActiveReportBtn.disabled = false;
  toast(ok ? 'Đã gửi yêu cầu. Mở Sheet kiểm tra dữ liệu.' : 'Chưa gửi được.');
}

async function syncAllReports() {
  if (!state.reports.length) return toast('Chưa có báo cáo để đồng bộ.');
  els.syncAllReportsBtn.disabled = true;
  let success = 0;
  for (const report of state.reports) {
    if (await syncReport(report)) success += 1;
  }
  els.syncAllReportsBtn.disabled = false;
  toast(`Đã gửi ${success}/${state.reports.length} báo cáo.`);
}

async function sendTestSheet() {
  const endpoint = getSheetEndpoint();
  if (!endpoint) return;
  els.testSheetBtn.disabled = true;
  const testReport = normalizeReport({
    id: `test-${Date.now()}`,
    date: today(),
    market: 'TEST KẾT NỐI SHEET',
    sales: 'Bépi App',
    note: 'Dòng test từ PWA. Nếu thấy dòng này là Sheet đã nối đúng.',
    createdAt: new Date().toISOString(),
    customers: [makeCustomer('Khách test', 'Test app', { 'Trà Đen': ['ok', 'test ghi Sheet'] }, ['Giá tốt'], 'Có thể xóa dòng test này.')]
  });
  await postToSheet(endpoint, buildSheetPayload(testReport, 'testReport'));
  els.testSheetBtn.disabled = false;
  toast('Đã gửi test. Reload Google Sheet để kiểm tra.');
}

function seedData() {
  const report = normalizeReport({
    id: uid('report'),
    date: today(),
    market: 'Chợ Gạo',
    sales: 'A Tân',
    note: 'Dữ liệu mẫu từ khảo sát trà ONA',
    createdAt: new Date().toISOString(),
    customers: [
      makeCustomer('Hai Phượng', 'Chợ Gạo', { 'Trà Quả Mộng': ['sample', 'cần mẫu lớn'], 'Trà Gạo Rang': ['sample', 'cần mẫu lớn'] }, ['Cần mẫu lớn']),
      makeCustomer('Tigon', '', {}, ['Báo sau cho A Tân'], 'Đánh giá sau'),
      makeCustomer('Châu', '', { 'Trà Quả Mộng': ['interested', 'sẽ thử'], 'Trà Gạo Rang': ['ok', 'giống cũ'], 'Trà Đen': ['ok', ''] }),
      makeCustomer('Ba Li', '', { 'Trà Quả Mộng': ['bad', 'nhạt'], 'Trà Gạo Rang': ['bad', 'khó uống'] }, ['Nhạt', 'Khó uống']),
      makeCustomer('ToTo', '', { 'Trà Quả Mộng': ['sample', 'ok, cần mẫu'], 'Trà Gạo Rang': ['ok', 'đang bán Novia'], 'Trà Lài': ['ok', 'thơm'] }, ['Đang bán hãng khác'])
    ]
  });
  state.reports.unshift(report);
  state.activeReportId = report.id;
  save();
  render();
  toast('Đã nạp dữ liệu mẫu.');
}

function makeCustomer(name, area = '', testPairs = {}, marketTags = [], note = '') {
  const tests = {};
  TEA_PRODUCTS.forEach((product) => {
    const [status = 'pending', testNote = ''] = testPairs[product] || [];
    tests[product] = { status, note: testNote };
  });
  return normalizeCustomer({ name, area, testType: 'Trà ONA Test', marketTags, note, tests });
}

function clearAllData() {
  if (!confirm('Xóa toàn bộ dữ liệu lưu trên máy này?')) return;
  localStorage.removeItem(STORAGE_KEY);
  OLD_KEYS.forEach((key) => localStorage.removeItem(key));
  state = { reports: [], activeReportId: '', settings: { sheetEndpoint: '' } };
  resetCustomerForm();
  render();
  toast('Đã xóa dữ liệu trên máy.');
}

function bindEvents() {
  els.reportForm.addEventListener('submit', createReport);
  els.customerForm.addEventListener('submit', saveCustomer);
  els.seedBtn.addEventListener('click', seedData);
  els.clearBtn.addEventListener('click', clearAllData);
  els.saveSheetBtn.addEventListener('click', () => saveSheetEndpoint(true));
  els.sheetUrl.addEventListener('input', scheduleSheetAutosave);
  els.sheetUrl.addEventListener('blur', () => saveSheetEndpoint(false));
  els.openSheetApiBtn.addEventListener('click', openSheetApi);
  els.testSheetBtn.addEventListener('click', sendTestSheet);
  els.syncActiveReportBtn.addEventListener('click', syncActiveReport);
  els.syncAllReportsBtn.addEventListener('click', syncAllReports);
  els.copySummaryBtn.addEventListener('click', copySummary);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.cancelEditBtn.addEventListener('click', resetCustomerForm);
  els.searchInput.addEventListener('input', renderDetail);
  els.productFilter.addEventListener('change', renderDetail);
  els.actionFilter.addEventListener('change', renderDetail);

  els.reportList.addEventListener('click', (event) => {
    const card = event.target.closest('[data-report-id]');
    if (!card) return;
    state.activeReportId = card.dataset.reportId;
    save();
    render();
    document.querySelector('#workspaceSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.teaTests.addEventListener('click', (event) => {
    const pill = event.target.closest('.status-pill');
    if (!pill) return;
    const row = pill.closest('.tea-row');
    row.querySelectorAll('.status-pill').forEach((item) => item.classList.remove('active'));
    pill.classList.add('active');
  });

  els.marketChips.addEventListener('click', (event) => {
    const chip = event.target.closest('.market-chip');
    if (chip) chip.classList.toggle('active');
  });

  els.customerList.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-customer]');
    const remove = event.target.closest('[data-delete-customer]');
    if (edit) editCustomer(edit.dataset.editCustomer);
    if (remove) deleteCustomer(remove.dataset.deleteCustomer);
  });

  els.quickAddBtn.addEventListener('click', () => {
    if (!getActiveReport()) {
      toast('Tạo hoặc chọn báo cáo trước.');
      document.querySelector('#createSection')?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    els.customerEditor.open = true;
    els.customerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => els.customerName.focus(), 250);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installBtn.hidden = false;
  });

  els.installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installBtn.hidden = true;
  });
}

function boot() {
  els.reportDate.value = today();
  buildProductFilter();
  buildTeaEditor();
  buildMarketChips();
  load();
  if (state.activeReportId && !state.reports.some((report) => report.id === state.activeReportId)) {
    state.activeReportId = state.reports[0]?.id || '';
  }
  bindEvents();
  render();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => console.warn(error));
    });
  }
}

boot();
