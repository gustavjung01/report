import { makeMarketReport, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, getAllLocal, putLocal } from '../local-db.js';

function esc(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2200);
}

function formatDate(value = '') {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '-';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function reportPage() {
  let section = document.querySelector('section.page[data-page="report-shell"]');
  if (section) return section;
  const main = document.querySelector('main');
  if (!main) return null;
  main.insertAdjacentHTML('beforeend', '<section class="page shell-page" data-page="report-shell"></section>');
  return document.querySelector('section.page[data-page="report-shell"]');
}

function labelType(type = '') {
  const map = { competitor: 'Đối thủ', price: 'Giá', demand: 'Nhu cầu', opportunity: 'Cơ hội', risk: 'Rủi ro', general: 'Tổng hợp' };
  return map[type] || type || 'Tổng hợp';
}

function badgeClass(type = '') {
  if (type === 'opportunity') return 'green';
  if (type === 'risk') return 'orange';
  if (type === 'competitor') return 'purple';
  if (type === 'price') return 'blue';
  return 'green';
}

async function loadReports() {
  const reports = await getAllLocal(LOCAL_STORES.marketReports);
  return reports.slice().sort((a, b) => String(b.created_at || b.report_date).localeCompare(String(a.created_at || a.report_date)));
}

function mainLine(report) {
  return report.opportunity_summary || report.demand_summary || report.competitor_summary || report.price_summary || report.risk_summary || report.note || 'Chưa có nội dung chính';
}

function reportCard(report) {
  return `<article class="shell-card" data-report-id="${esc(report.id)}"><div class="shell-card-head"><div><h3>${esc(report.market_area || 'Chưa có khu vực')}</h3><small>${esc(formatDate(report.report_date))}${report.sales ? ` · ${esc(report.sales)}` : ''}${report.route_name ? ` · ${esc(report.route_name)}` : ''}</small><small>${esc(mainLine(report))}</small></div><span class="shell-badge ${esc(badgeClass(report.market_type))}">${esc(labelType(report.market_type))}</span></div><div class="shell-actions"><button type="button" class="primary-lite" data-report-detail="${esc(report.id)}">Chi tiết</button><button type="button" data-report-repeat="${esc(report.id)}">Tạo lại</button></div></article>`;
}

async function renderReports() {
  const section = reportPage();
  if (!section) return;
  const reports = await loadReports();
  const today = todayIsoDate();
  const todayReports = reports.filter((report) => report.report_date === today).length;
  const opportunities = reports.filter((report) => report.market_type === 'opportunity' || report.opportunity_summary).length;
  const risks = reports.filter((report) => report.market_type === 'risk' || report.risk_summary).length;

  section.innerHTML = `<div class="shell-top"><div class="shell-title"><h1>Báo cáo thị trường</h1><p>Lưu local trước, sync Supabase làm sau.</p></div><div class="shell-top-actions"><button type="button" class="shell-back" data-page="create">Home</button><button type="button" class="shell-back" data-report-create>+ Báo cáo</button></div></div><article class="shell-hero report"><b>Ghi nhận thị trường nhanh</b><small>Đối thủ · giá · nhu cầu · cơ hội · rủi ro · hành động tiếp theo</small></article><div class="shell-grid"><div class="shell-kpis"><div class="shell-kpi"><b>${reports.length}</b><span>Báo cáo</span></div><div class="shell-kpi"><b>${todayReports}</b><span>Hôm nay</span></div><div class="shell-kpi"><b>${opportunities}</b><span>Cơ hội</span></div><div class="shell-kpi"><b>${risks}</b><span>Rủi ro</span></div></div><div class="shell-list">${reports.map(reportCard).join('') || '<p class="data-shell-note">Chưa có báo cáo. Bấm + Báo cáo để tạo báo cáo thị trường đầu tiên.</p>'}</div></div>`;
}

function formHtml(seed = {}) {
  const type = seed.market_type || 'general';
  return `<form class="modal" data-report-form data-report-id="${esc(seed.id || '')}"><header><h2>${seed.id ? 'Tạo lại báo cáo' : 'Tạo báo cáo thị trường'}</h2><button type="button" data-close>Đóng</button></header><div class="form report-form"><div class="grid"><label><span>Ngày</span><input id="reportDate" type="date" value="${esc(seed.report_date || todayIsoDate())}"></label><label><span>Sales</span><input id="reportSales" value="${esc(seed.sales || '')}" placeholder="Tên sales"></label></div><div class="grid"><label><span>Khu vực</span><input id="reportArea" required value="${esc(seed.market_area || '')}" placeholder="Ví dụ: Chợ Lách"></label><label><span>Tuyến</span><input id="reportRoute" value="${esc(seed.route_name || '')}" placeholder="Nếu có"></label></div><div class="grid"><label><span>Loại báo cáo</span><select id="reportType"><option value="general" ${type === 'general' ? 'selected' : ''}>Tổng hợp</option><option value="competitor" ${type === 'competitor' ? 'selected' : ''}>Đối thủ</option><option value="price" ${type === 'price' ? 'selected' : ''}>Giá</option><option value="demand" ${type === 'demand' ? 'selected' : ''}>Nhu cầu</option><option value="opportunity" ${type === 'opportunity' ? 'selected' : ''}>Cơ hội</option><option value="risk" ${type === 'risk' ? 'selected' : ''}>Rủi ro</option></select></label><label><span>Số điểm ghi nhận</span><input id="reportTotalShops" type="number" inputmode="numeric" min="0" value="${esc(seed.total_shops || '')}"></label></div><label><span>Nhu cầu thị trường</span><textarea id="reportDemand" rows="2" placeholder="Khách hỏi gì, sản phẩm nào đang chạy...">${esc(seed.demand_summary || '')}</textarea></label><label><span>Đối thủ / giá</span><textarea id="reportCompetitor" rows="2" placeholder="Đối thủ, giá bán, chương trình...">${esc(seed.competitor_summary || seed.price_summary || '')}</textarea></label><label><span>Cơ hội</span><textarea id="reportOpportunity" rows="2" placeholder="Cơ hội bán hàng, khách nên follow...">${esc(seed.opportunity_summary || '')}</textarea></label><label><span>Rủi ro</span><textarea id="reportRisk" rows="2" placeholder="Rào cản, phản hồi xấu, cần xử lý...">${esc(seed.risk_summary || '')}</textarea></label><label><span>Hành động tiếp theo</span><textarea id="reportNextAction" rows="2" placeholder="Việc cần làm sau báo cáo này...">${esc(seed.next_action || '')}</textarea></label><label><span>Ghi chú</span><textarea id="reportNote" rows="2">${esc(seed.note || '')}</textarea></label><button class="primary">Lưu báo cáo</button></div></form>`;
}

function openReportModal(seed = {}) {
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'report-create';
  dialog.innerHTML = formHtml(seed);
  if (!dialog.open) dialog.showModal();
  document.querySelector('#reportArea')?.focus();
}

async function saveReport(event) {
  event.preventDefault();
  const area = document.querySelector('#reportArea')?.value.trim();
  const demand = document.querySelector('#reportDemand')?.value.trim();
  const competitor = document.querySelector('#reportCompetitor')?.value.trim();
  const opportunity = document.querySelector('#reportOpportunity')?.value.trim();
  const risk = document.querySelector('#reportRisk')?.value.trim();
  if (!area) return toast('Nhập khu vực trước đã.');
  if (!demand && !competitor && !opportunity && !risk) return toast('Nhập ít nhất một nội dung thị trường.');
  const type = document.querySelector('#reportType')?.value || 'general';
  const report = makeMarketReport({
    report_date: document.querySelector('#reportDate')?.value || todayIsoDate(),
    sales: document.querySelector('#reportSales')?.value,
    market_area: area,
    route_name: document.querySelector('#reportRoute')?.value,
    market_type: type,
    total_shops: document.querySelector('#reportTotalShops')?.value,
    competitor_summary: type === 'price' ? '' : competitor,
    price_summary: type === 'price' ? competitor : '',
    demand_summary: demand,
    opportunity_summary: opportunity,
    risk_summary: risk,
    next_action: document.querySelector('#reportNextAction')?.value,
    note: document.querySelector('#reportNote')?.value,
    sync_status: 'local',
    raw_payload: { source: 'report_ui_local', kind: 'market_report' }
  });
  await putLocal(LOCAL_STORES.marketReports, report);
  document.querySelector('#modal')?.close();
  await renderReports();
  window.dispatchEvent(new CustomEvent('report:changed'));
  toast('Đã lưu báo cáo thị trường local.');
}

async function openDetail(reportId) {
  const reports = await loadReports();
  const report = reports.find((item) => item.id === reportId);
  if (!report) return toast('Không tìm thấy báo cáo.');
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'report-detail';
  dialog.innerHTML = `<div class="modal"><header><h2>${esc(report.market_area || 'Báo cáo')}</h2><button type="button" data-close>Đóng</button></header><div class="total"><b>${esc(labelType(report.market_type))}</b><br><small>${esc(formatDate(report.report_date))}${report.sales ? ` · ${esc(report.sales)}` : ''}${report.route_name ? ` · ${esc(report.route_name)}` : ''}</small></div>${detailLine('Nhu cầu', report.demand_summary)}${detailLine('Đối thủ', report.competitor_summary)}${detailLine('Giá', report.price_summary)}${detailLine('Cơ hội', report.opportunity_summary)}${detailLine('Rủi ro', report.risk_summary)}${detailLine('Hành động tiếp theo', report.next_action)}${detailLine('Ghi chú', report.note)}</div>`;
  if (!dialog.open) dialog.showModal();
}

function detailLine(title, value) {
  if (!value) return '';
  return `<article class="line"><b>${esc(title)}</b><small>${esc(value)}</small></article>`;
}

async function repeatReport(reportId) {
  const reports = await loadReports();
  const report = reports.find((item) => item.id === reportId);
  if (!report) return toast('Không tìm thấy báo cáo.');
  openReportModal({ ...report, id: '', report_date: todayIsoDate() });
}

document.addEventListener('click', (event) => {
  const create = event.target.closest('section.page[data-page="report-shell"] [data-report-create]');
  if (create) {
    event.preventDefault();
    openReportModal();
    return;
  }
  const detail = event.target.closest('section.page[data-page="report-shell"] [data-report-detail]');
  if (detail) {
    event.preventDefault();
    openDetail(detail.dataset.reportDetail);
    return;
  }
  const repeat = event.target.closest('section.page[data-page="report-shell"] [data-report-repeat]');
  if (repeat) {
    event.preventDefault();
    repeatReport(repeat.dataset.reportRepeat);
  }
}, true);

document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-report-form]')) return;
  saveReport(event).catch((error) => {
    console.warn('report save failed', error);
    toast('Không lưu được báo cáo.');
  });
});

function boot() {
  renderReports().catch((error) => {
    console.warn('report render failed', error);
    toast('Không mở được dữ liệu báo cáo local.');
  });
}

boot();
window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('report:changed', boot);
