const STORAGE_KEY = 'tea-survey-reports-v1';

const TEA_PRODUCTS = [
  'Trà Đen',
  'Trà Quả Mộng',
  'Trà Gạo Rang',
  'Trà Lài',
  'Trà Olong',
  'Trà Olong Sen'
];

const STATUS_OPTIONS = [
  { id: 'pending', label: 'Chưa thử' },
  { id: 'ok', label: 'OK' },
  { id: 'interested', label: 'Quan tâm' },
  { id: 'sample', label: 'Cần mẫu' },
  { id: 'follow', label: 'Báo Tân' },
  { id: 'bad', label: 'Chưa tốt' },
  { id: 'retry', label: 'Thử lại' }
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
  reportForm: document.querySelector('#reportForm'),
  reportDate: document.querySelector('#reportDate'),
  reportMarket: document.querySelector('#reportMarket'),
  reportSales: document.querySelector('#reportSales'),
  reportNote: document.querySelector('#reportNote'),
  reportList: document.querySelector('#reportList'),
  reportCount: document.querySelector('#reportCount'),
  seedBtn: document.querySelector('#seedBtn'),
  clearBtn: document.querySelector('#clearBtn'),
  emptyState: document.querySelector('#emptyState'),
  reportDetail: document.querySelector('#reportDetail'),
  activeReportDate: document.querySelector('#activeReportDate'),
  activeReportTitle: document.querySelector('#activeReportTitle'),
  activeReportMeta: document.querySelector('#activeReportMeta'),
  statsGrid: document.querySelector('#statsGrid'),
  searchInput: document.querySelector('#searchInput'),
  productFilter: document.querySelector('#productFilter'),
  actionFilter: document.querySelector('#actionFilter'),
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
  toast: document.querySelector('#toast')
};

let state = {
  reports: [],
  activeReportId: null
};

let deferredInstallPrompt = null;

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

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove('show'), 2600);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    state = {
      reports: Array.isArray(parsed.reports) ? parsed.reports : [],
      activeReportId: parsed.activeReportId || null
    };
  } catch (error) {
    console.error(error);
    toast('Không đọc được dữ liệu cũ, app sẽ tạo dữ liệu mới.');
  }
}

function getActiveReport() {
  return state.reports.find((report) => report.id === state.activeReportId) || null;
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
      const current = customer.tests?.[product] || {};
      acc[product] = {
        status: current.status || 'pending',
        note: current.note || ''
      };
      return acc;
    }, {})
  };
}

function buildTeaEditor(customer = null) {
  els.teaTests.innerHTML = TEA_PRODUCTS.map((product) => {
    const status = customer?.tests?.[product]?.status || 'pending';
    const note = customer?.tests?.[product]?.note || '';
    const pills = STATUS_OPTIONS.map((option) => `
      <button
        class="status-pill ${status === option.id ? 'active' : ''}"
        type="button"
        data-product="${product}"
        data-status="${option.id}"
      >${option.label}</button>
    `).join('');

    return `
      <div class="tea-row" data-tea-row="${product}">
        <div class="tea-row-title">
          <strong>${product}</strong>
          <span class="badge">test</span>
        </div>
        <div class="status-pills">${pills}</div>
        <input type="text" data-note-for="${product}" value="${escapeAttribute(note)}" placeholder="Ghi chú: nhạt, thơm, giống cũ..." />
      </div>
    `;
  }).join('');
}

function buildMarketChips(selected = []) {
  els.marketChips.innerHTML = MARKET_OPTIONS.map((item) => `
    <button class="market-chip ${selected.includes(item) ? 'active' : ''}" type="button" data-market-chip="${item}">${item}</button>
  `).join('');
}

function buildProductFilter() {
  els.productFilter.innerHTML = '<option value="all">Tất cả sản phẩm</option>' + TEA_PRODUCTS.map((product) => (
    `<option value="${product}">${product}</option>`
  )).join('');
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

function renderReports() {
  els.reportCount.textContent = state.reports.length;

  if (!state.reports.length) {
    els.reportList.innerHTML = '<p class="muted">Chưa có báo cáo nào. Tạo báo cáo đầu tiên ở trên.</p>';
    return;
  }

  els.reportList.innerHTML = state.reports
    .slice()
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
    .map((report) => {
      const customerCount = report.customers?.length || 0;
      return `
        <button class="report-card ${report.id === state.activeReportId ? 'active' : ''}" type="button" data-report-id="${report.id}">
          <h4>${escapeHtml(report.market)}</h4>
          <p>${formatDate(report.date)} · ${customerCount} khách</p>
          <p>Sales: ${escapeHtml(report.sales || 'Chưa ghi')}</p>
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
  els.activeReportTitle.textContent = `Thị trường ${report.market}`;
  els.activeReportMeta.textContent = `Sales: ${report.sales || 'Chưa ghi'}${report.note ? ` · ${report.note}` : ''}`;

  renderStats(report);
  renderCustomers(report);
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
    els.customerList.innerHTML = '<p class="muted">Chưa có khách phù hợp bộ lọc.</p>';
    return;
  }

  els.customerList.innerHTML = customers.map((customer) => {
    const productCells = TEA_PRODUCTS.map((product) => {
      const test = customer.tests?.[product] || { status: 'pending', note: '' };
      return `
        <div class="product-cell">
          <b>${product}</b>
          <span class="tag ${statusClass(test.status)}">${statusLabel(test.status)}</span>
          ${test.note ? `<span>${escapeHtml(test.note)}</span>` : ''}
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
        ${customer.note ? `<p class="muted" style="margin-top:10px">${escapeHtml(customer.note)}</p>` : ''}
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
    const active = els.teaTests.querySelector(`[data-product="${CSS.escape(product)}"].active`);
    const note = els.teaTests.querySelector(`[data-note-for="${CSS.escape(product)}"]`)?.value.trim() || '';
    tests[product] = {
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
  const report = {
    id: uid('report'),
    date: els.reportDate.value,
    market: els.reportMarket.value.trim(),
    sales: els.reportSales.value.trim() || 'A Tân',
    note: els.reportNote.value.trim(),
    createdAt: new Date().toISOString(),
    customers: []
  };

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
  document.querySelector('.customer-editor').open = true;
  document.querySelector('.customer-editor').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function deleteCustomer(customerId) {
  const report = getActiveReport();
  if (!report) return;
  const customer = report.customers.find((item) => item.id === customerId);
  if (!customer) return;

  if (!confirm(`Xóa khách "${customer.name}" khỏi báo cáo?`)) return;
  report.customers = report.customers.filter((item) => item.id !== customerId);
  save();
  render();
  toast('Đã xóa khách hàng.');
}

function deleteActiveReport() {
  const report = getActiveReport();
  if (!report) return;
  if (!confirm(`Xóa toàn bộ báo cáo thị trường "${report.market}"?`)) return;
  state.reports = state.reports.filter((item) => item.id !== report.id);
  state.activeReportId = state.reports[0]?.id || null;
  save();
  render();
  toast('Đã xóa báo cáo.');
}

function buildSummary(report) {
  const lines = [];
  lines.push(`BÁO CÁO KHẢO SÁT THỊ TRƯỜNG TRÀ SỮA`);
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
      const status = customer.tests?.[product]?.status || 'pending';
      stats[status] = (stats[status] || 0) + 1;
    });
    lines.push(`${product}: OK ${stats.ok || 0}, quan tâm ${stats.interested || 0}, cần mẫu ${stats.sample || 0}, báo Tân ${stats.follow || 0}, chưa tốt ${stats.bad || 0}, thử lại ${stats.retry || 0}, chưa thử ${stats.pending || 0}`);
  });
  lines.push('');

  customers.forEach((customer, index) => {
    lines.push(`${index + 1}. ${customer.name}${customer.area ? ` - ${customer.area}` : ''}`);
    TEA_PRODUCTS.forEach((product) => {
      const test = customer.tests?.[product] || { status: 'pending', note: '' };
      if (test.status !== 'pending' || test.note) {
        lines.push(`- ${product}: ${statusLabel(test.status)}${test.note ? ` (${test.note})` : ''}`);
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
    toast('Đã copy báo cáo. Có thể dán gửi Zalo/Telegram/Gmail.');
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
    'Ngay',
    'Thi truong',
    'Sales',
    'Ten khach hang',
    'Khu vuc',
    'Loai SP test',
    ...TEA_PRODUCTS.flatMap((product) => [`${product} - trang thai`, `${product} - ghi chu`]),
    'Test chung thi truong',
    'Hen bao lai',
    'Ghi chu tong'
  ];

  const rows = (report.customers || []).map((customer) => [
    report.date,
    report.market,
    report.sales,
    customer.name,
    customer.area,
    customer.testType,
    ...TEA_PRODUCTS.flatMap((product) => {
      const test = customer.tests?.[product] || { status: 'pending', note: '' };
      return [statusLabel(test.status), test.note];
    }),
    (customer.marketTags || []).join('; '),
    customer.followDate,
    customer.note
  ]);

  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `bao-cao-${slugify(report.market)}-${report.date}.csv`);
  toast('Đã xuất CSV. Mở bằng Excel được.');
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

function seedData() {
  const report = {
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
  };

  state.reports.unshift(report);
  state.activeReportId = report.id;
  save();
  render();
  toast('Đã nạp dữ liệu mẫu để test app.');
}

function makeCustomer(name, area = '', tests = {}, marketTags = [], note = '') {
  const customerTests = TEA_PRODUCTS.reduce((acc, product) => {
    const [status = 'pending', productNote = ''] = tests[product] || [];
    acc[product] = { status, note: productNote };
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
  state = { reports: [], activeReportId: null };
  render();
  resetCustomerForm();
  toast('Đã xóa dữ liệu lưu trên máy.');
}

function bindEvents() {
  els.reportForm.addEventListener('submit', createReport);
  els.customerForm.addEventListener('submit', saveCustomer);
  els.seedBtn.addEventListener('click', seedData);
  els.clearBtn.addEventListener('click', clearAllData);
  els.copySummaryBtn.addEventListener('click', copySummary);
  els.exportCsvBtn.addEventListener('click', exportCsv);
  els.cancelEditBtn.addEventListener('click', resetCustomerForm);
  els.searchInput.addEventListener('input', () => renderDetail());
  els.productFilter.addEventListener('change', () => renderDetail());
  els.actionFilter.addEventListener('change', () => renderDetail());

  els.reportList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-report-id]');
    if (!button) return;
    state.activeReportId = button.dataset.reportId;
    save();
    render();
  });

  els.teaTests.addEventListener('click', (event) => {
    const pill = event.target.closest('[data-product][data-status]');
    if (!pill) return;
    const row = pill.closest('[data-tea-row]');
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

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('Service worker error:', error));
    });
  }
}

boot();
