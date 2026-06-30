import { LOCAL_STORES, getAllLocal, getLocal, putLocal, putManyLocal } from '../local-db.js';

const TEST_LABEL = { pending: 'Chưa thử', ok: 'OK', interested: 'Quan tâm', sample: 'Cần mẫu', follow: 'Báo sau', bad: 'Chưa tốt', retry: 'Thử lại' };
const REPORT_LABEL = { competitor: 'Đối thủ', price: 'Giá', demand: 'Nhu cầu', opportunity: 'Cơ hội', risk: 'Rủi ro', general: 'Tổng hợp' };

function clean(value = '') { return String(value ?? '').replace(/\s+/g, ' ').trim(); }
function esc(value = '') { return String(value ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c])); }
function activeRow(row = {}) { return !row.deleted_at && !row.raw_payload?.deleted_at && row.status !== 'deleted' && row.status !== 'cancelled'; }
function activeTest(row = {}) { return !row.deleted_at && !row.raw_payload?.deleted_at && row.status !== 'deleted'; }
function stamp() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; }
function csvCell(value = '') { return `"${clean(value).replace(/"/g, '""')}"`; }
function saveText(filename, content, type = 'text/plain;charset=utf-8') { const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1200); }
function saveCsv(filename, rows) { saveText(filename, `\ufeff${rows.map((row) => row.map(csvCell).join(';')).join('\n')}`, 'text/csv;charset=utf-8'); }
function toast(message) { const el = document.querySelector('#toast'); if (!el) return; el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2300); }
function softDeleted(row = {}, reason = '') { const now = new Date().toISOString(); return { ...row, status: row.status === 'cancelled' ? 'cancelled' : 'deleted', sync_status: 'local', updated_at: now, deleted_at: now, raw_payload: { ...(row.raw_payload || {}), deleted_at: now, delete_reason: reason || 'local_ui' } }; }

async function loadTestData() { const [tests, items] = await Promise.all([getAllLocal(LOCAL_STORES.onaTests), getAllLocal(LOCAL_STORES.onaTestItems)]); return { tests, items }; }
async function loadReportData() { return (await getAllLocal(LOCAL_STORES.marketReports)).slice().sort((a, b) => String(b.created_at || b.report_date || '').localeCompare(String(a.created_at || a.report_date || ''))); }

function removeVisibleTestFile(fileId = '') {
  if (!fileId) return;
  document.querySelectorAll('[data-test-file-id], [data-delete-test-file], [data-detail], [data-add-customer], [data-export-test]').forEach((node) => {
    const id = node.dataset.testFileId || node.dataset.deleteTestFile || node.dataset.detail || node.dataset.addCustomer || node.dataset.exportTest;
    if (id !== fileId) return;
    const card = node.closest('.record, .mini, .data-shell-card, article');
    if (card) card.remove();
  });
  const dialog = document.querySelector('#modal[data-type="test-detail-enhanced"]');
  if (dialog?.open) dialog.close();
}

async function deleteTestFile(fileId = '') {
  const { tests, items } = await loadTestData();
  const file = tests.find((row) => row.id === fileId);
  if (!file) return toast('Không tìm thấy file test.');
  if (!window.confirm(`Xoá mềm file test "${file.customer_name || 'File test'}"?\nKhách và kết quả trong file cũng sẽ ẩn khỏi danh sách.`)) return;
  const customers = tests.filter((row) => row.raw_payload?.kind === 'test_customer' && row.raw_payload?.file_id === fileId);
  const customerIds = new Set(customers.map((row) => row.id));
  const affectedTests = [file, ...customers].map((row) => softDeleted(row, 'delete_test_file'));
  const affectedItems = items.filter((item) => item.test_id === fileId || customerIds.has(item.test_id)).map((item) => softDeleted(item, 'delete_test_file'));
  await putManyLocal(LOCAL_STORES.onaTests, affectedTests);
  if (affectedItems.length) await putManyLocal(LOCAL_STORES.onaTestItems, affectedItems);
  removeVisibleTestFile(fileId);
  window.dispatchEvent(new CustomEvent('test:changed'));
  setTimeout(schedule, 40);
  toast('Đã xoá mềm file test.');
}

async function deleteTestCustomer(customerId = '') {
  const { items } = await loadTestData();
  const customer = await getLocal(LOCAL_STORES.onaTests, customerId);
  if (!customer) return toast('Không tìm thấy khách test.');
  if (!window.confirm(`Xoá mềm khách test "${customer.customer_name || 'khách này'}"?`)) return;
  await putLocal(LOCAL_STORES.onaTests, softDeleted(customer, 'delete_test_customer'));
  const results = items.filter((item) => item.test_id === customerId).map((item) => softDeleted(item, 'delete_test_customer'));
  if (results.length) await putManyLocal(LOCAL_STORES.onaTestItems, results);
  window.dispatchEvent(new CustomEvent('test:changed'));
  openTestDetail(customer.raw_payload?.file_id || '');
  toast('Đã xoá mềm khách test.');
}

async function deleteTestProduct(fileId = '', itemId = '') {
  const { tests, items } = await loadTestData();
  const product = items.find((item) => item.id === itemId);
  if (!product) return toast('Không tìm thấy sản phẩm test.');
  if (!window.confirm(`Xoá mềm sản phẩm "${product.product_name || 'sản phẩm này'}" khỏi file test?`)) return;
  const customers = tests.filter((row) => activeTest(row) && row.raw_payload?.kind === 'test_customer' && row.raw_payload?.file_id === fileId);
  const customerIds = new Set(customers.map((row) => row.id));
  const affected = items.filter((item) => item.id === itemId || (customerIds.has(item.test_id) && ((product.product_id && item.product_id === product.product_id) || item.product_name === product.product_name))).map((item) => softDeleted(item, 'delete_test_product'));
  if (affected.length) await putManyLocal(LOCAL_STORES.onaTestItems, affected);
  window.dispatchEvent(new CustomEvent('test:changed'));
  openTestDetail(fileId);
  toast('Đã xoá mềm sản phẩm test.');
}

async function exportTestSummary() {
  const { tests, items } = await loadTestData();
  const files = tests.filter((row) => activeTest(row) && row.raw_payload?.kind === 'test_file');
  const customers = tests.filter((row) => activeTest(row) && row.raw_payload?.kind === 'test_customer');
  const rows = [['File test', 'Ngày file', 'Sales', 'Khách', 'SĐT', 'Khu vực', 'Sản phẩm', 'Trạng thái', 'Ghi chú kết quả', 'Ghi chú khách']];
  files.forEach((file) => {
    const fileCustomers = customers.filter((customer) => customer.raw_payload?.file_id === file.id);
    const products = items.filter((item) => activeTest(item) && item.test_id === file.id);
    if (!fileCustomers.length) rows.push([file.customer_name, file.test_date, file.sales, '', '', '', products.map((p) => p.product_name).join(' · '), '', '', file.overall_note]);
    fileCustomers.forEach((customer) => {
      const results = items.filter((item) => activeTest(item) && item.test_id === customer.id);
      if (!results.length) rows.push([file.customer_name, file.test_date, file.sales, customer.customer_name, customer.customer_phone, customer.area, '', TEST_LABEL[customer.overall_status] || customer.overall_status, '', customer.overall_note]);
      results.forEach((result) => rows.push([file.customer_name, file.test_date, file.sales, customer.customer_name, customer.customer_phone, customer.area, result.product_name, TEST_LABEL[result.status] || result.status, result.note, customer.overall_note]));
    });
  });
  saveCsv(`test-tong-hop-${stamp()}.csv`, rows);
  toast(`Đã xuất tổng hợp ${files.length} file test.`);
}

async function openTestDetail(fileId = '') {
  if (!fileId) return;
  const { tests, items } = await loadTestData();
  const file = tests.find((row) => row.id === fileId);
  if (!file || !activeTest(file)) return toast('Không tìm thấy file test.');
  const products = items.filter((item) => activeTest(item) && item.test_id === fileId);
  const customers = tests.filter((row) => activeTest(row) && row.raw_payload?.kind === 'test_customer' && row.raw_payload?.file_id === fileId);
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'test-detail-enhanced';
  dialog.innerHTML = `<div class="modal test-detail-enhanced"><header><h2>${esc(file.customer_name || 'File test')}</h2><button type="button" data-close>Đóng</button></header><div class="total"><b>${products.length} sản phẩm · ${customers.length} khách</b><br><small>${esc(file.test_date || '')}${file.sales ? ` · ${esc(file.sales)}` : ''}</small></div><div class="test-manage-toolbar"><button type="button" class="secondary" data-export-test="${esc(file.id)}">Excel file</button><button type="button" class="secondary" data-export-test-summary>Excel tổng</button><button type="button" class="secondary danger" data-delete-test-file="${esc(file.id)}">Xoá file</button></div><section class="line"><b>Sản phẩm test</b>${products.map((p) => `<div class="manage-row"><span>${esc(p.product_name)}</span><button type="button" class="secondary danger" data-delete-test-product="${esc(p.id)}" data-file-id="${esc(file.id)}">Xoá</button></div>`).join('') || '<small>Chưa có sản phẩm.</small>'}</section>${customers.map((customer) => { const results = items.filter((item) => activeTest(item) && item.test_id === customer.id); return `<article class="line"><div class="manage-row"><div><b>${esc(customer.customer_name)}</b><small>${esc(customer.area || '')}${customer.customer_phone ? ` · ${esc(customer.customer_phone)}` : ''}</small></div><button type="button" class="secondary danger" data-delete-test-customer="${esc(customer.id)}">Xoá</button></div>${results.map((r) => `<div class="result-line"><span>${esc(r.product_name)}</span><b>${esc(TEST_LABEL[r.status] || r.status)}</b>${r.note ? `<small>${esc(r.note)}</small>` : ''}</div>`).join('') || '<small>Chưa ghi kết quả sản phẩm.</small>'}</article>`; }).join('') || '<p class="empty">Chưa có khách.</p>'}</div>`;
  if (!dialog.open) dialog.showModal();
}

async function deleteReport(reportId = '') {
  const report = await getLocal(LOCAL_STORES.marketReports, reportId);
  if (!report) return toast('Không tìm thấy báo cáo.');
  if (!window.confirm(`Xoá mềm báo cáo khu vực "${report.market_area || 'này'}"?`)) return;
  await putLocal(LOCAL_STORES.marketReports, softDeleted(report, 'delete_market_report'));
  window.dispatchEvent(new CustomEvent('report:changed'));
  toast('Đã xoá mềm báo cáo.');
}

async function exportReportList() {
  const reports = (await loadReportData()).filter(activeRow);
  const rows = [['Mã báo cáo', 'Ngày', 'Sales', 'Khu vực', 'Tuyến', 'Loại', 'Số điểm', 'Nhu cầu', 'Đối thủ', 'Giá', 'Cơ hội', 'Rủi ro', 'Hành động tiếp theo', 'Ghi chú'], ...reports.map((r) => [r.id, r.report_date, r.sales, r.market_area, r.route_name, REPORT_LABEL[r.market_type] || r.market_type, r.total_shops, r.demand_summary, r.competitor_summary, r.price_summary, r.opportunity_summary, r.risk_summary, r.next_action, r.note])];
  saveCsv(`bao-cao-thi-truong-danh-sach-${stamp()}.csv`, rows);
  toast(`Đã xuất ${reports.length} báo cáo.`);
}

async function exportOneReport(reportId = '') {
  const report = await getLocal(LOCAL_STORES.marketReports, reportId);
  if (!report || !activeRow(report)) return toast('Không tìm thấy báo cáo.');
  const rows = [['Trường', 'Nội dung'], ['Mã báo cáo', report.id], ['Ngày', report.report_date], ['Sales', report.sales], ['Khu vực', report.market_area], ['Tuyến', report.route_name], ['Loại', REPORT_LABEL[report.market_type] || report.market_type], ['Số điểm ghi nhận', report.total_shops], ['Nhu cầu', report.demand_summary], ['Đối thủ', report.competitor_summary], ['Giá', report.price_summary], ['Cơ hội', report.opportunity_summary], ['Rủi ro', report.risk_summary], ['Hành động tiếp theo', report.next_action], ['Ghi chú', report.note]];
  saveCsv(`bao-cao-${clean(report.market_area || report.id).replace(/[^\p{L}\p{N}]+/gu, '-')}-${stamp()}.csv`, rows);
  toast('Đã xuất 1 báo cáo CSV.');
}

function installStyle() {
  let style = document.querySelector('style[data-test-report-manage]');
  if (!style) { style = document.createElement('style'); style.dataset.testReportManage = '1'; document.head.appendChild(style); }
  style.textContent = `.test-summary-row,.report-export-row{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin:0 0 8px!important}.test-summary-row button,.report-export-row button{min-height:34px!important}.danger{border-color:#fecaca!important;background:#fff7f7!important;color:#b91c1c!important}.is-soft-deleted{display:none!important}.test-detail-enhanced{max-height:calc(100dvh - 24px)!important;overflow:auto!important}.test-manage-toolbar{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:6px!important}.manage-row{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:8px!important;align-items:center!important;margin-top:6px!important}.manage-row span,.manage-row small{min-width:0!important;overflow:hidden!important;text-overflow:ellipsis!important}.manage-row button{min-height:30px!important;font-size:11px!important}`;
}

async function enhanceTestList() {
  const dataPage = document.querySelector('section.page[data-page="data"].active');
  const testTab = document.querySelector('#dataHub [data-data-view="test"].active');
  const list = document.querySelector('#dataList');
  if (!dataPage || !testTab || !list || list.closest('.data-list-wrap')?.style.display === 'none') return;
  const { tests } = await loadTestData();
  const files = tests.filter((row) => row.raw_payload?.kind === 'test_file');
  if (!list.querySelector('[data-export-test-summary]')) list.insertAdjacentHTML('afterbegin', '<div class="test-summary-row"><button type="button" class="secondary" data-export-test-summary>Xuất tổng hợp</button><button type="button" class="secondary" data-open-test>Tạo file test</button></div>');
  [...list.querySelectorAll(':scope > .record')].forEach((card, index) => {
    const file = files[index]; if (!file) return;
    card.dataset.testFileId = file.id;
    if (!activeTest(file)) { card.remove(); return; }
    const actions = card.querySelector('.test-actions'); if (!actions) return;
    if (!actions.querySelector('[data-delete-test-file]')) actions.insertAdjacentHTML('beforeend', `<button type="button" class="secondary danger" data-delete-test-file="${esc(file.id)}">Xoá</button>`);
  });
}

function decorateReportCard(card, report) {
  if (!card || !report) return;
  card.dataset.reportId = report.id;
  card.classList.toggle('is-soft-deleted', !activeRow(report));
  const actions = card.querySelector('.shell-actions') || card.appendChild(document.createElement('div'));
  actions.classList.add('shell-actions');
  if (!actions.querySelector('[data-export-report-one]')) actions.insertAdjacentHTML('beforeend', `<button type="button" data-export-report-one="${esc(report.id)}">Xuất</button>`);
  if (activeRow(report) && !actions.querySelector('[data-delete-report]')) actions.insertAdjacentHTML('beforeend', `<button type="button" class="danger" data-delete-report="${esc(report.id)}">Xoá</button>`);
}

async function enhanceReports() {
  const reports = await loadReportData();
  const activeReports = reports.filter(activeRow);
  document.querySelectorAll('section.page[data-page="report-shell"] [data-report-id]').forEach((card) => decorateReportCard(card, reports.find((row) => row.id === card.dataset.reportId)));
  const dataReport = document.querySelector('#dataShell.active');
  const reportTab = document.querySelector('#dataHub [data-data-view="report"].active');
  if (dataReport && reportTab) {
    if (!dataReport.querySelector('[data-export-report-list]')) {
      const note = dataReport.querySelector('.data-shell-note');
      note?.insertAdjacentHTML('afterend', '<div class="report-export-row"><button type="button" class="secondary" data-export-report-list>Xuất danh sách</button><button type="button" class="secondary" data-page="report-shell">Tạo báo cáo</button></div>');
    }
    [...dataReport.querySelectorAll('.data-shell-list > .data-shell-card')].forEach((card, index) => decorateReportCard(card, reports[index]));
  }
  const reportShell = document.querySelector('section.page[data-page="report-shell"]');
  if (reportShell) {
    const kpis = reportShell.querySelectorAll('.shell-kpi b');
    if (kpis[0]) kpis[0].textContent = String(activeReports.length);
    if (kpis[1]) kpis[1].textContent = String(activeReports.filter((r) => r.report_date === new Date().toISOString().slice(0, 10)).length);
    if (kpis[2]) kpis[2].textContent = String(activeReports.filter((r) => r.market_type === 'opportunity' || r.opportunity_summary).length);
    if (kpis[3]) kpis[3].textContent = String(activeReports.filter((r) => r.market_type === 'risk' || r.risk_summary).length);
  }
}

function schedule() { clearTimeout(schedule.t); schedule.t = setTimeout(() => { enhanceTestList().catch(console.warn); enhanceReports().catch(console.warn); }, 160); }

document.addEventListener('click', (event) => {
  const detail = event.target.closest('[data-detail]');
  if (detail && document.querySelector('section.page[data-page="data"].active')) { event.preventDefault(); event.stopImmediatePropagation(); openTestDetail(detail.dataset.detail); return; }
  const delFile = event.target.closest('[data-delete-test-file]'); if (delFile) { event.preventDefault(); event.stopImmediatePropagation(); deleteTestFile(delFile.dataset.deleteTestFile); return; }
  const delCustomer = event.target.closest('[data-delete-test-customer]'); if (delCustomer) { event.preventDefault(); event.stopImmediatePropagation(); deleteTestCustomer(delCustomer.dataset.deleteTestCustomer); return; }
  const delProduct = event.target.closest('[data-delete-test-product]'); if (delProduct) { event.preventDefault(); event.stopImmediatePropagation(); deleteTestProduct(delProduct.dataset.fileId, delProduct.dataset.deleteTestProduct); return; }
  if (event.target.closest('[data-export-test-summary]')) { event.preventDefault(); event.stopImmediatePropagation(); exportTestSummary(); return; }
  const delReport = event.target.closest('[data-delete-report]'); if (delReport) { event.preventDefault(); event.stopImmediatePropagation(); deleteReport(delReport.dataset.deleteReport); return; }
  if (event.target.closest('[data-export-report-list]')) { event.preventDefault(); event.stopImmediatePropagation(); exportReportList(); return; }
  const oneReport = event.target.closest('[data-export-report-one]'); if (oneReport) { event.preventDefault(); event.stopImmediatePropagation(); exportOneReport(oneReport.dataset.exportReportOne); return; }
  schedule();
}, true);

installStyle();
window.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('test:changed', schedule);
window.addEventListener('report:changed', schedule);
setInterval(schedule, 1500);
schedule();
