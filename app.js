const STORAGE_KEY = 'tea-survey-reports-v2';
const LEGACY_STORAGE_KEY = 'tea-survey-reports-v1';

const TEA_PRODUCTS = [
  { id: 'den', name: 'Trà Đen' },
  { id: 'qua-mong', name: 'Trà Quả Mộng' },
  { id: 'gao-rang', name: 'Trà Gạo Rang' },
  { id: 'lai', name: 'Trà Lài' },
  { id: 'olong', name: 'Trà Olong' },
  { id: 'olong-sen', name: 'Trà Olong Sen' }
];

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Chưa thử', icon: '○' },
  { id: 'ok', label: 'OK', icon: '✓' },
  { id: 'interested', label: 'Quan tâm', icon: '◎' },
  { id: 'sample', label: 'Cần mẫu', icon: '＋' },
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

const LOGO_CANDIDATES = [
  'icons/bepi-logo.png',
  'icons/bepi-logo.jpg',
  'icons/bepi-logo.webp',
  'icons/bepi-logo.svg',
  'icons/logo-bepi.png',
  'icons/logo-bepi.jpg',
  'icons/logo-bepi.svg',
  'icons/be-pi-logo.png',
  'icons/be-pi-logo.svg',
  'icons/logo.png',
  'icons/logo.jpg',
  'icons/logo.webp',
  'icons/bepi.png',
  'icons/bepi.svg',
  'assets/logo.png',
  'assets/bepi-logo.png',
  'logo.png',
  'logo.jpg',
  'logo.webp',
  'bepi-logo.png',
  'bepi.png'
];

const els = {
  brandLogo: document.querySelector('#brandLogo'),
  brandFallback: document.querySelector('#brandFallback'),
  installBtn: document.querySelector('#installBtn'),
  connectionStatus: document.querySelector('#connectionStatus'),
  homeStats: document.querySelector('#homeStats'),
  reportForm: document.querySelector('#reportForm'),
  reportDate: document.querySelector('#reportDate'),
  reportMarket: document.querySelector('#reportMarket'),
  reportSales: document.querySelector('#reportSales'),
  reportNote: document.querySelector('#reportNote'),
  reportList: document.querySelector('#reportList'),
  reportCount: document.querySelector('#reportCount'),
  seedBtn: document.querySelector('#seedBtn'),
  clearBtn: document.querySelector('#clearBtn'),
  sheetUrl: document.querySelector('#sheetUrl'),
  saveSheetBtn: document.querySelector('#saveSheetBtn'),
  testSheetBtn: document.querySelector('#testSheetBtn'),
  syncAllReportsBtn: document.querySelector('#syncAllReportsBtn'),
  syncActiveReportBtn: document.querySelector('#syncActiveReportBtn'),
  sheetStatus: document.querySelector('#sheetStatus'),
  activeSyncStatus: document.querySelector('#activeSyncStatus'),
  emptyState: document.querySelector('#emptyState'),
  reportDetail: document.querySelector('#reportDetail'),
  activeReportDate: document.querySelector('#activeReportDate'),
  activeReportTitle: document.querySelector('#activeReportTitle'),
  activeReportMeta: document.querySelector('#activeReportMeta'),
  statsGrid: document.querySelector('#statsGrid'),
  searchInput: document.querySelector('#searchInput'),
  productFilter: document.querySelector('#productFilter'),
  actionFilter: document.querySelector('#actionFilter'),
  customerEditor: document.querySelector('#customerEditor'),
  customerForm: document.querySelector('#customerForm'),
  editingCustomerId: document.querySelector('#editingCustomerId'),
  customerName: document.querySelector('#customerName'),
  customerArea: document.querySelector('#customerArea'),
  testType: document.querySelector('#testType'),
  followDate: document.querySelector('#followDate'),
  customerNote: document.querySelector('#customerNote'),
  teaTests: document.querySelector('#teaTests'),
  marketChips: document.querySelector('#marketChips'),
  customerList: document.querySelector('#customerList'),
  customerCount: document.querySelector('#customerCount'),
  copySummaryBtn: document.querySelector('#copySummaryBtn'),
  exportCsvBtn: document.querySelector('#exportCsvBtn'),
  cancelEditBtn: document.querySelector('#cancelEditBtn'),
  editorTitle: document.querySelector('#editorTitle'),
  quickAddBtn: document.querySelector('#quickAddBtn'),
  toast: document.querySelector('#toast')
};

let state = {
  reports: [],
  activeReportId: null,
  settings: {
    sheetEndpoint: ''
  }
};

let deferredInstallPrompt = null;
let isSyncing = false;

function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(dateString) {
  if (!dateString) return '--';
  const date = new Date(`${dateString}T00:00:00`);
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).format(date);
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

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 3200);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state = {
      reports: Array.isArray(parsed.reports) ? parsed.reports.map(normalizeReport) : [],
      activeReportId: parsed.activeReportId || null,
      settings: {
        sheetEndpoint: parsed.settings?.sheetEndpoint || ''
      }
    };
    save();
  } catch (error) {
    console.error(error);
    toast('Không đọc được dữ liệu cũ, app sẽ tạo dữ liệu mới.');
  }
}

function getActiveReport() {
  return state.reports.find((report) => report.id === state.activeReportId) || null;
}

function normalizeReport(report) {
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

function normalizeCustomer(customer) {
  return {
    id: customer.id || uid('cus'),
    name: customer.name || '',
    area: customer.area || '',
    testType: customer.testType || 'Trà ONA Test',
    followDate: customer.followDate || '',
    note: customer.note || '',
    marketTags: Array.isArray(customer.marketTags) ? customer.marketTags : [],
    tests: TEA_PRODUCTS.reduce((acc, product) => {
      const current = customer.tests?.[product.name] || customer.tests?.[product.id] || {};
      acc[product.name] = {
        status: current.status || 'pending',
        note: current.note || ''
      };
      return acc;
    }, {})
  };
}

function markReportDirty(report) {
  if (!report) return;
  report.updatedAt = new Date().toISOString();
  if (report.sync?.status === 'synced') {
    report.sync = { status: 'pending', lastAt: report.sync.lastAt || '', message: 'Có chỉnh sửa mới' };
  }
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
  if (statusId === 'retry') return 'bad';
  return statusId;
}

async function resolveLogo() {
  if (!els.brandLogo || !els.brandFallback) return;

  for (const src of LOGO_CANDIDATES) {
    const exists = await imageExists(src);
    if (exists) {
      els.brandLogo.src = src;
      els.brandLogo.hidden = false;
      els.brandFallback.hidden = true;
      return;
    }
  }
}

function imageExists(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(true);
    image.onerror = () => resolve(false);
    image.src = `${src}?v=2`;
  });
}

function buildTeaEditor(customer = null) {
  els.teaTests.innerHTML = TEA_PRODUCTS.map((product) => {
    const test = customer?.tests?.[product.name] || { status: 'pending', note: '' };
    const pills = STATUS_OPTIONS.map((option) => `
      <button
        class="status-pill ${test.status === option.id ? 'active' : ''}"
        type="button"
        data-product-id="${product.id}"
        data-status="${option.id}"
      >${option.icon} ${option.label}</button>
    `).join('');

    return `
      <div class="tea-row" data-product-id="${product.id}">
        <div class="tea-row-title">
          <strong>${product.name}</strong>
          <span class="badge">test</span>
        </div>
        <div class="status-pills">${pills}</div>
        <input type="text" data-note-product-id="${product.id}" value="${escapeAttribute(test.note)}" placeholder="VD: nhạt, thơm, giống cũ..." />
      </div>
    `;
  }).join('');
}

function buildMarketChips(selected = []) {
  els.marketChips.innerHTML = MARKET_OPTIONS.map((item) => `
    <button class="market-chip ${selected.includes(item) ? 'active' : ''}" type="button" data-market-chip="${escapeAttribute(item)}">${item}</button>
  `).join('');
}

function buildProductFilter() {
  els.productFilter.innerHTML = '<option value="all">Tất cả sản phẩm</option>' + TEA_PRODUCTS.map((product) => (
    `<option value="${escapeAttribute(product.name)}">${product.name}</option>`
  )).join('');
}

function renderHomeStats() {
  const totalReports = state.reports.length;
  const totalCustomers = state.reports.reduce((sum, report) => sum + (report.customers?.length || 0), 0);
  els.homeStats.innerHTML = `
    <div><strong>${totalReports}</strong><span>báo cáo</span></div>
    <div><strong>${totalCustomers}</strong><span>khách</span></div>
  `;
}

function renderConnectionStatus() {
  const endpoint = state.settings.sheetEndpoint;
  els.sheetUrl.value = endpoint;
  els.connectionStatus.textContent = endpoint ? 'Offline-first · Đã nối Google Sheet' : 'Offline-first · Chưa nối Sheet';
  els.sheetStatus.innerHTML = endpoint
    ? `Đã lưu link Sheet. Bấm <b>Gửi test</b> trước; nếu Sheet có dòng test thì bấm <b>Đẩy Sheet</b> cho báo cáo thật.`
    : 'Chưa cấu hình Sheet. App vẫn lưu offline trên máy, nhưng chưa đẩy được báo cáo lên Google Sheet.';
}

function renderReports() {
  els.reportCount.textContent = state.reports.length;

  if (!state.reports.length) {
    els.reportList.innerHTML = '<p class="muted small">Chưa có báo cáo nào. Tạo báo cáo đầu tiên ở trên.</p>';
    return;
  }

  els.reportList.innerHTML = state.reports
    .slice()
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
    .map((report) => {
      const customerCount = report.customers?.length || 0;
      const sync = getSyncMeta(report);
      return `
        <button class="report-card ${report.id === state.activeReportId ? 'active' : ''}" type="button" data-report-id="${report.id}">
          <h4>${escapeHtml(report.market || 'Chưa ghi thị trường')}</h4>
          <p>${formatDate(report.date)} · ${customerCount} khách</p>
          <p>Sales: ${escapeHtml(report.sales || 'Chưa ghi')}</p>
          <span class="report-sync-line ${sync.className}">${sync.text}</span>
        </button>
      `;
    }).join('');
}

function renderDetail() {
  const report = getActiveReport();

  els.emptyState.hidden = Boolean(report);
  els.reportDetail.hidden = !report;

  if (!report) return;

  els.activeReportDate.textContent = formatDate(report.date);
  els.activeReportTitle.textContent = `Thị trường ${report.market || 'chưa ghi'}`;
  els.activeReportMeta.textContent = `Sales: ${report.sales || 'Chưa ghi'}${report.note ? ` · ${report.note}` : ''}`;
  renderSyncStatus(report);
  renderStats(report);
  renderCustomers(report);
}

function getSyncMeta(report) {
  const status = report.sync?.status || 'pending';
  if (status === 'synced') return { className: 'synced', text: `✓ Đã gửi${report.sync.lastAt ? ` · ${formatDateTime(report.sync.lastAt)}` : ''}` };
  if (status === 'sending') return { className: 'sending', text: '↗ Đang gửi Sheet...' };
  if (status === 'error') return { className: 'error', text: '⚠ Lỗi đồng bộ' };
  return { className: '', text: '○ Chưa đồng bộ' };
}

function renderSyncStatus(report) {
  const sync = getSyncMeta(report);
  els.activeSyncStatus.className = `sync-pill ${sync.className}`;
  els.activeSyncStatus.textContent = sync.text;
}

function renderStats(report) {
  const customers = report.customers || [];
  const needSample = customers.filter((customer) => customerNeeds(customer, 'sample')).length;
  const follow = customers.filter((customer) => customerNeeds(customer, 'follow')).length;
  const bad = customers.filter((customer) => customerNeeds(customer, 'bad')).length;

  els.statsGrid.innerHTML = [
    { label: 'Tổng khách', value: customers.length },
    { label: 'Cần mẫu', value: needSample },
    { label: 'Báo A Tân', value: follow },
    { label: 'Cần xử lý', value: bad }
  ].map((item) => `
    <div class="stat-card">
      <span>${item.label}</span>
      <strong>${item.value}</strong>
    </div>
  `).join('');
}

function customerNeeds(customer, group) {
  const tests = Object.values(customer.tests || {});
  if (group === 'follow') {
    return tests.some((test) => statusGroup(test.status) === 'follow')
      || customer.marketTags?.some((tag) => tag.toLowerCase().includes('báo sau'))
      || /báo\s*(a\s*)?tân|báo sau/i.test(customer.note || '');
  }

  if (group === 'sample') {
    return tests.some((test) => statusGroup(test.status) === 'sample')
      || customer.marketTags?.some((tag) => tag.toLowerCase().includes('mẫu'))
      || /mẫu/i.test(customer.note || '');
  }

  if (group === 'bad') {
    return tests.some((test) => ['bad', 'retry'].includes(test.status))
      || customer.marketTags?.some((tag) => ['khó uống', 'nhạt', 'giá cao'].includes(tag.toLowerCase()));
  }

  return tests.some((test) => statusGroup(test.status) === group);
}

function getFilteredCustomers(report) {
  const keyword = els.searchInput.value.trim().toLowerCase();
  const product = els.productFilter.value;
  const action = els.actionFilter.value;

  return (report.customers || []).filter((customer) => {
    const text = [
      customer.name,
      customer.area,
      customer.testType,
      customer.note,
      ...(customer.marketTags || []),
      ...Object.entries(customer.tests || {}).flatMap(([name, test]) => [name, statusLabel(test.status), test.note])
    ].join(' ').toLowerCase();

    const keywordMatch = !keyword || text.includes(keyword);
    const productMatch = product === 'all' || customer.tests?.[product]?.status !== 'pending' || customer.tests?.[product]?.note;
    const actionMatch = action === 'all' || customerNeeds(customer, action) || Object.values(customer.tests || {}).some((test) => statusGroup(test.status) === action);

    return keywordMatch && productMatch && actionMatch;
  });
}

function renderCustomers(report) {
  const customers = getFilteredCustomers(report);
  els.customerCount.textContent = `${customers.length} khách`;

  if (!customers.length) {
    els.customerList.innerHTML = '<p class="muted small">Chưa có khách phù hợp bộ lọc.</p>';
    return;
  }

  els.customerList.innerHTML = customers.map((customer) => {
    const productCells = TEA_PRODUCTS.map((product) => {
      const test = customer.tests?.[product.name] || { status: 'pending', note: '' };
      return `
        <div class="product-cell">
          <b>${product.name}</b>
          <span class="tag ${statusClass(test.status)}">${statusIcon(test.status)} ${statusLabel(test.status)}</span>
          ${test.note ? `<span class="muted small">${escapeHtml(test.note)}</span>` : ''}
        </div>
      `;
    }).join('');

    const marketTags = (customer.marketTags || []).map((tag) => `<span class="tag warn">${escapeHtml(tag)}</span>`).join('');

    return `
      <article class="customer-card" data-customer-id="${customer.id}">
        <div class="customer-top">
          <div>
            <h4>${escapeHtml(customer.name)}</h4>
            <div class="customer-meta">
              <span>${escapeHtml(customer.area || 'Chưa ghi khu vực')}</span>
              <span>·</span>
              <span>${escapeHtml(customer.testType || 'Trà ONA Test')}</span>
              ${customer.followDate ? `<span>· Hẹn: ${formatDate(customer.followDate)}</span>` : ''}
            </div>
          </div>
          <div class="customer-actions">
            <button class="tiny-btn" type="button" data-edit-customer="${customer.id}">Sửa</button>
            <button class="tiny-btn danger" type="button" data-delete-customer="${customer.id}">Xóa</button>
          </div>
        </div>
        <div class="product-grid">${productCells}</div>
        ${marketTags ? `<div class="market-tags">${marketTags}</div>` : ''}
        ${customer.note ? `<p class="muted small" style="margin-top:10px">${escapeHtml(customer.note)}</p>` : ''}
      </article>
    `;
  }).join('');
}

function resetCustomerForm() {
  els.editingCustomerId.value = '';
  els.customerForm.reset();
  els.testType.value = 'Trà ONA Test';
  els.editorTitle.textContent = 'Thêm khách hàng test';
  els.cancelEditBtn.hidden = true;
  buildTeaEditor();
  buildMarketChips();
}

function collectCustomerForm() {
  const tests = {};
  TEA_PRODUCTS.forEach((product) => {
    const row = els.teaTests.querySelector(`.tea-row[data-product-id="${product.id}"]`);
    const active = row?.querySelector('.status-pill.active');
    const note = row?.querySelector(`[data-note-product-id="${product.id}"]`)?.value.trim() || '';
    tests[product.name] = {
      status: active?.dataset.status || 'pending',
      note
    };
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

  state.reports.push(report);
  state.activeReportId = report.id;
  save();
  els.reportForm.reset();
  els.reportDate.value = today();
  els.reportSales.value = 'A Tân';
  render();
  toast('Đã tạo báo cáo. Bắt đầu thêm từng khách hàng cụ thể.');
}

function saveCustomer(event) {
  event.preventDefault();
  const report = getActiveReport();
  if (!report) {
    toast('Tạo hoặc chọn báo cáo trước đã nhé.');
    return;
  }

  const customer = collectCustomerForm();
  if (!customer.name) {
    toast('Nhập tên khách hàng trước.');
    return;
  }

  const index = report.customers.findIndex((item) => item.id === customer.id);
  if (index >= 0) {
    report.customers[index] = customer;
    toast('Đã cập nhật khách hàng.');
  } else {
    report.customers.push(customer);
    toast('Đã thêm khách hàng vào báo cáo.');
  }

  markReportDirty(report);
  save();
  resetCustomerForm();
  render();
}

function editCustomer(customerId) {
  const report = getActiveReport();
  const customer = report?.customers.find((item) => item.id === customerId);
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

function deleteCustomer(customerId) {
  const report = getActiveReport();
  if (!report) return;
  const customer = report.customers.find((item) => item.id === customerId);
  if (!customer) return;

  if (!confirm(`Xóa khách "${customer.name}" khỏi báo cáo?`)) return;
  report.customers = report.customers.filter((item) => item.id !== customerId);
  markReportDirty(report);
  save();
  render();
  toast('Đã xóa khách hàng.');
}

function buildSummary(report) {
  const lines = [];
  lines.push('BÁO CÁO KHẢO SÁT THỊ TRƯỜNG TRÀ SỮA');
  lines.push(`Ngày: ${formatDate(report.date)}`);
  lines.push(`Thị trường: ${report.market}`);
  lines.push(`Sales phụ trách: ${report.sales || 'A Tân'}`);
  if (report.note) lines.push(`Ghi chú: ${report.note}`);
  lines.push('');

  const customers = report.customers || [];
  lines.push(`Tổng khách: ${customers.length}`);
  lines.push(`Cần mẫu: ${customers.filter((customer) => customerNeeds(customer, 'sample')).length}`);
  lines.push(`Báo sau / báo A Tân: ${customers.filter((customer) => customerNeeds(customer, 'follow')).length}`);
  lines.push(`Cần xử lý phản hồi chưa tốt: ${customers.filter((customer) => customerNeeds(customer, 'bad')).length}`);
  lines.push('');

  TEA_PRODUCTS.forEach((product) => {
    const stats = { ok: 0, interested: 0, sample: 0, follow: 0, bad: 0, retry: 0, pending: 0 };
    customers.forEach((customer) => {
      const status = customer.tests?.[product.name]?.status || 'pending';
      stats[status] = (stats[status] || 0) + 1;
    });
    lines.push(`${product.name}: OK ${stats.ok || 0}, quan tâm ${stats.interested || 0}, cần mẫu ${stats.sample || 0}, báo Tân ${stats.follow || 0}, chưa tốt ${stats.bad || 0}, thử lại ${stats.retry || 0}, chưa thử ${stats.pending || 0}`);
  });
  lines.push('');

  customers.forEach((customer, index) => {
    lines.push(`${index + 1}. ${customer.name}${customer.area ? ` - ${customer.area}` : ''}`);
    TEA_PRODUCTS.forEach((product) => {
      const test = customer.tests?.[product.name] || { status: 'pending', note: '' };
      if (test.status !== 'pending' || test.note) {
        lines.push(`- ${product.name}: ${statusLabel(test.status)}${test.note ? ` (${test.note})` : ''}`);
      }
    });
    if (customer.marketTags?.length) lines.push(`- Thị trường: ${customer.marketTags.join(', ')}`);
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
    toast('Đã copy báo cáo. Dán gửi Zalo/Gmail được.');
  } catch (error) {
    console.error(error);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `bao-cao-${report.market}-${report.date}.txt`);
    toast('Không copy được, app đã tải file TXT thay thế.');
  }
}

function exportCsv() {
  const report = getActiveReport();
  if (!report) return;

  const headers = [
    'Ngày',
    'Thị trường',
    'Sales',
    'Tên khách hàng',
    'Khu vực',
    'Loại SP test',
    ...TEA_PRODUCTS.flatMap((product) => [`${product.name} - trạng thái`, `${product.name} - ghi chú`]),
    'Test chung thị trường',
    'Hẹn báo lại',
    'Ghi chú tổng'
  ];

  const rows = (report.customers || []).map((customer) => [
    report.date,
    report.market,
    report.sales,
    customer.name,
    customer.area,
    customer.testType,
    ...TEA_PRODUCTS.flatMap((product) => {
      const test = customer.tests?.[product.name] || { status: 'pending', note: '' };
      return [statusLabel(test.status), test.note];
    }),
    (customer.marketTags || []).join('; '),
    customer.followDate,
    customer.note
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `bao-cao-${slugify(report.market)}-${report.date}.csv`);
  toast('Đã xuất CSV tiếng Việt. Mở bằng Excel được.');
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

function slugify(value) {
  return String(value || 'thi-truong')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'thi-truong';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function saveSheetEndpoint() {
  const url = els.sheetUrl.value.trim();
  if (url && !/^https:\/\/script\.google\.com\/macros\/s\//.test(url)) {
    if (!confirm('Link này không giống Google Apps Script Web App URL. Vẫn lưu?')) return;
  }
  state.settings.sheetEndpoint = url;
  save();
  renderConnectionStatus();
  toast(url ? 'Đã lưu link Google Sheet.' : 'Đã xóa link Google Sheet.');
}

function buildSheetPayload(report, action = 'upsertReport') {
  return {
    action,
    source: 'Tea Survey Report PWA',
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
    products: TEA_PRODUCTS.map((product) => product.name),
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

function getSheetEndpoint() {
  const endpoint = state.settings.sheetEndpoint || els.sheetUrl.value.trim();
  if (!endpoint) {
    toast('Chưa có link Google Apps Script. Dán link ở mục Google Sheet trước.');
    document.querySelector('#sheetSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return '';
  }
  return endpoint;
}

function postToSheet(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const frameName = `sheet_submit_${Date.now()}`;
    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const input = document.createElement('input');
    const actionInput = document.createElement('input');
    let settled = false;

    iframe.name = frameName;
    iframe.style.display = 'none';
    form.style.display = 'none';
    form.method = 'POST';
    form.action = endpoint;
    form.target = frameName;
    form.acceptCharset = 'UTF-8';

    input.type = 'hidden';
    input.name = 'payload';
    input.value = JSON.stringify(payload);

    actionInput.type = 'hidden';
    actionInput.name = 'action';
    actionInput.value = payload.action || 'upsertReport';

    const cleanup = () => {
      window.setTimeout(() => {
        iframe.remove();
        form.remove();
      }, 200);
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(true);
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('Gửi Sheet quá lâu. Kiểm tra link Apps Script hoặc quyền truy cập.'));
    }, 22000);

    iframe.addEventListener('load', () => {
      window.clearTimeout(timer);
      finish();
    });

    form.append(input, actionInput);
    document.body.append(iframe, form);
    form.submit();
  });
}

async function syncReport(report) {
  const endpoint = getSheetEndpoint();
  if (!endpoint) return false;

  report.sync = { status: 'sending', lastAt: new Date().toISOString(), message: 'Đang gửi...' };
  save();
  render();

  try {
    await postToSheet(endpoint, buildSheetPayload(report));

    report.sync = {
      status: 'synced',
      lastAt: new Date().toISOString(),
      message: 'Đã gửi Google Sheet'
    };
    save();
    render();
    return true;
  } catch (error) {
    console.error(error);
    report.sync = {
      status: 'error',
      lastAt: new Date().toISOString(),
      message: error.message || 'Không gửi được. Kiểm tra mạng hoặc link Apps Script.'
    };
    save();
    render();
    return false;
  }
}

async function sendTestSheet() {
  const endpoint = getSheetEndpoint();
  if (!endpoint || isSyncing) return;

  isSyncing = true;
  els.testSheetBtn.disabled = true;

  const testReport = normalizeReport({
    id: `test-${Date.now()}`,
    date: today(),
    market: 'TEST KẾT NỐI SHEET',
    sales: 'Bépi App',
    note: 'Dòng test từ nút Gửi test trong PWA. Nếu thấy dòng này là kết nối Sheet OK.',
    createdAt: new Date().toISOString(),
    customers: [
      makeCustomer('Khách test', 'Test app', {
        'Trà Đen': ['ok', 'test ghi Sheet'],
        'Trà Quả Mộng': ['sample', 'test cần mẫu']
      }, ['Giá tốt', 'Báo sau cho A Tân'], 'Dòng test, có thể xóa sau khi kiểm tra.')
    ]
  });

  try {
    await postToSheet(endpoint, buildSheetPayload(testReport, 'testReport'));
    toast('Đã gửi test. Mở Google Sheet kiểm tra 2 sheet Báo cáo / Chi tiết khách hàng.');
  } catch (error) {
    console.error(error);
    toast(error.message || 'Gửi test chưa thành công.');
  } finally {
    els.testSheetBtn.disabled = false;
    isSyncing = false;
  }
}

async function syncActiveReport() {
  const report = getActiveReport();
  if (!report) {
    toast('Chọn báo cáo trước khi đồng bộ.');
    return;
  }
  if (isSyncing) return;
  isSyncing = true;
  els.syncActiveReportBtn.disabled = true;
  const ok = await syncReport(report);
  els.syncActiveReportBtn.disabled = false;
  isSyncing = false;
  toast(ok ? 'Đã gửi báo cáo lên Google Sheet. Mở Sheet kiểm tra dữ liệu.' : 'Gửi Sheet chưa thành công.');
}

async function syncAllReports() {
  if (!state.reports.length) {
    toast('Chưa có báo cáo để đồng bộ.');
    return;
  }
  if (isSyncing) return;
  isSyncing = true;
  els.syncAllReportsBtn.disabled = true;

  let success = 0;
  const targets = state.reports.filter((report) => report.sync?.status !== 'synced');
  const list = targets.length ? targets : state.reports;
  for (const report of list) {
    const ok = await syncReport(report);
    if (ok) success += 1;
  }

  els.syncAllReportsBtn.disabled = false;
  isSyncing = false;
  toast(`Đã gửi ${success}/${list.length} báo cáo. Mở Sheet kiểm tra dữ liệu.`);
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
      makeCustomer('Hai Phượng', 'Chợ Gạo', { 'Trà Đen': ['retry', 'thử lại'], 'Trà Quả Mộng': ['sample', 'cần mẫu lớn'], 'Trà Gạo Rang': ['sample', 'cần mẫu lớn'], 'Trà Olong': ['sample', 'cần mẫu lớn'], 'Trà Olong Sen': ['sample', 'hương sen'] }, ['Cần mẫu lớn']),
      makeCustomer('Tigon', '', {}, ['Báo sau cho A Tân'], 'Đánh giá sau'),
      makeCustomer('Châu', '', { 'Trà Quả Mộng': ['interested', 'sẽ thử'], 'Trà Gạo Rang': ['ok', 'giống cũ'], 'Trà Đen': ['ok', ''] }),
      makeCustomer('Ba Li', '', { 'Trà Quả Mộng': ['bad', 'nhạt'], 'Trà Gạo Rang': ['bad', 'khó uống'], 'Trà Đen': ['bad', 'nhạt'] }, ['Nhạt', 'Khó uống']),
      makeCustomer('1997', '', { 'Trà Gạo Rang': ['ok', ''], 'Trà Lài': ['ok', ''], 'Trà Đen': ['ok', ''] }),
      makeCustomer('ToTo', '', { 'Trà Quả Mộng': ['sample', 'ok, cần mẫu'], 'Trà Gạo Rang': ['ok', 'đang bán Novia'], 'Trà Lài': ['ok', 'thơm'] }, ['Đang bán hãng khác']),
      makeCustomer('Joly', '', { 'Trà Gạo Rang': ['ok', ''], 'Trà Lài': ['bad', 'không đạt'] }),
      makeCustomer('Hana', '', { 'Trà Quả Mộng': ['sample', 'ok, thêm mẫu'], 'Trà Gạo Rang': ['ok', ''] })
    ]
  });

  state.reports.unshift(report);
  state.activeReportId = report.id;
  save();
  render();
  toast('Đã nạp dữ liệu mẫu để test app.');
}

function makeCustomer(name, area = '', tests = {}, marketTags = [], note = '') {
  const customerTests = TEA_PRODUCTS.reduce((acc, product) => {
    const [status = 'pending', productNote = ''] = tests[product.name] || [];
    acc[product.name] = { status, note: productNote };
    return acc;
  }, {});

  return normalizeCustomer({
    id: uid('cus'),
    name,
    area,
    testType: 'Trà ONA Test',
    followDate: '',
    note,
    marketTags,
    tests: customerTests
  });
}

function clearAllData() {
  if (!confirm('Xóa toàn bộ dữ liệu lưu trên máy này?')) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(LEGACY_STORAGE_KEY);
  state = { reports: [], activeReportId: null, settings: { sheetEndpoint: '' } };
  render();
  resetCustomerForm();
  toast('Đã xóa dữ liệu lưu trên máy.');
}

function bindEvents() {
  els.reportForm.addEventListener('submit', createReport);
  els.customerForm.addEventListener('submit', saveCustomer);
  els.seedBtn.addEventListener('click', seedData);
  els.clearBtn.addEventListener('click', clearAllData);
  els.saveSheetBtn.addEventListener('click', saveSheetEndpoint);
  els.testSheetBtn.addEventListener('click', sendTestSheet);
  els.syncActiveReportBtn.addEventListener('click', syncActiveReport);
  els.syncAllReportsBtn.addEventListener('click', syncAllReports);
  els.copySummaryBtn.addEventListener('click', copySummary);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.cancelEditBtn.addEventListener('click', resetCustomerForm);
  els.searchInput.addEventListener('input', () => renderDetail());
  els.productFilter.addEventListener('change', () => renderDetail());
  els.actionFilter.addEventListener('change', () => renderDetail());
  els.quickAddBtn.addEventListener('click', () => {
    if (!getActiveReport()) {
      toast('Tạo hoặc chọn báo cáo trước đã nhé.');
      document.querySelector('#createSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    els.customerEditor.open = true;
    els.customerEditor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => els.customerName.focus(), 350);
  });

  els.reportList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-report-id]');
    if (!button) return;
    state.activeReportId = button.dataset.reportId;
    save();
    render();
    document.querySelector('#workspaceSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  els.teaTests.addEventListener('click', (event) => {
    const pill = event.target.closest('[data-product-id][data-status]');
    if (!pill) return;
    const row = pill.closest('.tea-row');
    row.querySelectorAll('.status-pill').forEach((item) => item.classList.remove('active'));
    pill.classList.add('active');
  });

  els.marketChips.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-market-chip]');
    if (!chip) return;
    chip.classList.toggle('active');
  });

  els.customerList.addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-customer]');
    const remove = event.target.closest('[data-delete-customer]');
    if (edit) editCustomer(edit.dataset.editCustomer);
    if (remove) deleteCustomer(remove.dataset.deleteCustomer);
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

function render() {
  renderHomeStats();
  renderConnectionStatus();
  renderReports();
  renderDetail();
}

function boot() {
  els.reportDate.value = today();
  buildProductFilter();
  buildTeaEditor();
  buildMarketChips();
  load();

  if (state.activeReportId && !state.reports.some((report) => report.id === state.activeReportId)) {
    state.activeReportId = state.reports[0]?.id || null;
  }

  bindEvents();
  render();
  resolveLogo();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker error:', error));
    });
  }
}

boot();
