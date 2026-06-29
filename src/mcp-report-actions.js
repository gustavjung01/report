import { makeMarketReport } from '../data-model.js';
import { LOCAL_STORES, putLocal } from '../local-db.js';
import { getActiveMcpSessionDetail, upsertMcpVisitForSession } from './mcp-core.js';

let ensureTimer = null;

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

function mountStyle() {
  let style = document.querySelector('style[data-mcp-report-actions]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpReportActions = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] .mcp-manage-actions{
      grid-template-columns:42px 42px minmax(0,.8fr) minmax(0,.9fr) minmax(0,.8fr)!important;
    }
    section.page[data-page="mcp"] [data-mcp-create-report]{
      border-color:#c9b8ff!important;
      background:#f7f2ff!important;
      color:#5b33b5!important;
    }
    #modal[data-type="mcp-report"] .modal{max-height:calc(100dvh - 24px);overflow:auto;padding:13px 14px!important;gap:8px!important}
    #modal[data-type="mcp-report"] .form{display:grid!important;gap:7px!important}
    #modal[data-type="mcp-report"] .mcp-report-source{border:1px solid #d8cbff;border-radius:14px;background:#faf7ff;padding:9px 10px;color:#45317d;font-size:12px;line-height:1.35;display:grid;gap:3px}
    #modal[data-type="mcp-report"] .mcp-report-source b{font-size:13px;color:#45317d}
    #modal[data-type="mcp-report"] .mcp-report-source span{color:#203940;font-weight:850}
    #modal[data-type="mcp-report"] .mcp-report-source small{font-size:11px;color:#66757c}
    #modal[data-type="mcp-report"] .grid{gap:7px!important}
    #modal[data-type="mcp-report"] label{display:grid!important;gap:3px!important;min-width:0!important}
    #modal[data-type="mcp-report"] label span{font-size:11px!important;line-height:1.1!important;font-weight:900!important;color:#40555e!important}
    #modal[data-type="mcp-report"] input,
    #modal[data-type="mcp-report"] select,
    #modal[data-type="mcp-report"] textarea{min-height:38px!important;border-radius:12px!important;padding:8px 10px!important;font-size:16px!important;line-height:1.2!important}
    #modal[data-type="mcp-report"] textarea{min-height:56px!important;resize:vertical!important}
    #modal[data-type="mcp-report"] .primary{min-height:43px!important;border-radius:13px!important}
  `;
}

function ensureReportButtons() {
  document.querySelectorAll('section.page[data-page="mcp"] .mcp-customer[data-customer-id]').forEach((card) => {
    const customerId = card.dataset.customerId || '';
    if (!customerId || card.querySelector('[data-mcp-create-report]')) return;
    const target = card.querySelector('.mcp-manage-actions');
    if (!target) return;
    const editButton = target.querySelector('[data-mcp-edit-customer]');
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mcpCreateReport = '1';
    button.dataset.customerId = customerId;
    button.textContent = 'BC';
    if (editButton) target.insertBefore(button, editButton);
    else target.appendChild(button);
  });
}

function scheduleEnsure() {
  clearTimeout(ensureTimer);
  ensureTimer = setTimeout(ensureReportButtons, 40);
  setTimeout(ensureReportButtons, 180);
}

function typeOptions(selected = 'general') {
  const rows = [
    ['general', 'Tổng hợp'],
    ['competitor', 'Đối thủ'],
    ['price', 'Giá'],
    ['demand', 'Nhu cầu'],
    ['opportunity', 'Cơ hội'],
    ['risk', 'Rủi ro']
  ];
  return rows.map(([value, label]) => `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`).join('');
}

function formatDate(value = '') {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value || '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function sourceSummary({ detail, customer }) {
  const routeName = detail.route?.route_name || detail.session.route_name || 'MCP tuyến';
  const areaLine = [customer.area || detail.route?.area || detail.session.area, customer.address].filter(Boolean).join(' · ') || 'Chưa có địa chỉ';
  const sessionLine = [`Ngày ${formatDate(detail.session.session_date)}`, detail.session.sales ? `Sales ${detail.session.sales}` : 'Chưa nhập sales'].join(' · ');
  return `<div class="mcp-report-source"><b>📊 ${esc(routeName)}</b><span>${esc(customer.customer_name || 'Khách MCP')}${customer.phone ? ` · ${esc(customer.phone)}` : ''}</span><small>${esc(areaLine)}</small><small>${esc(sessionLine)}</small></div>`;
}

async function openMcpReportModal(customerId) {
  const detail = await getActiveMcpSessionDetail();
  if (!detail?.session) return toast('Chọn phiên MCP trước khi tạo báo cáo.');
  const customer = detail.customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');
  const dialog = document.querySelector('#modal');
  if (!dialog) return;
  dialog.dataset.type = 'mcp-report';
  dialog.innerHTML = `<form class="modal" data-mcp-report-form data-customer-id="${esc(customer.id)}"><header><h2>Báo cáo từ MCP</h2><button type="button" data-close>Đóng</button></header><div class="form">${sourceSummary({ detail, customer })}<div class="grid"><label><span>Loại báo cáo</span><select id="mcpReportType">${typeOptions('general')}</select></label><label><span>Số điểm ghi nhận</span><input id="mcpReportTotalShops" type="number" inputmode="numeric" min="0" value="1"></label></div><label><span>Nhu cầu thị trường</span><textarea id="mcpReportDemand" rows="2" placeholder="Khách hỏi gì, sản phẩm nào đang chạy..."></textarea></label><label><span>Đối thủ / giá</span><textarea id="mcpReportCompetitor" rows="2" placeholder="Đối thủ, giá bán, chương trình..."></textarea></label><label><span>Cơ hội</span><textarea id="mcpReportOpportunity" rows="2" placeholder="Cơ hội bán hàng / khách nên follow..."></textarea></label><label><span>Rủi ro</span><textarea id="mcpReportRisk" rows="2" placeholder="Rào cản, phản hồi xấu, cần xử lý..."></textarea></label><label><span>Hành động tiếp theo</span><textarea id="mcpReportNextAction" rows="2" placeholder="Việc cần làm sau báo cáo này..."></textarea></label><label><span>Ghi chú</span><textarea id="mcpReportNote" rows="2"></textarea></label><button class="primary">Lưu báo cáo</button></div></form>`;
  if (!dialog.open) dialog.showModal();
  document.querySelector('#mcpReportDemand')?.focus();
}

async function saveMcpReport(event) {
  event.preventDefault();
  const form = event.target.closest('[data-mcp-report-form]');
  const customerId = form?.dataset.customerId || '';
  const detail = await getActiveMcpSessionDetail();
  if (!detail?.session) return toast('Chọn phiên MCP trước khi lưu báo cáo.');
  const customer = detail.customers.find((item) => item.id === customerId);
  if (!customer) return toast('Không tìm thấy khách trong tuyến.');

  const demand = document.querySelector('#mcpReportDemand')?.value.trim() || '';
  const competitor = document.querySelector('#mcpReportCompetitor')?.value.trim() || '';
  const opportunity = document.querySelector('#mcpReportOpportunity')?.value.trim() || '';
  const risk = document.querySelector('#mcpReportRisk')?.value.trim() || '';
  const nextAction = document.querySelector('#mcpReportNextAction')?.value.trim() || '';
  const note = document.querySelector('#mcpReportNote')?.value.trim() || '';
  if (!demand && !competitor && !opportunity && !risk && !nextAction && !note) {
    return toast('Nhập ít nhất một nội dung báo cáo.');
  }
  const marketType = document.querySelector('#mcpReportType')?.value || 'general';
  const report = makeMarketReport({
    report_date: detail.session.session_date,
    sales: detail.session.sales || '',
    market_area: customer.area || detail.route?.area || detail.session.area || '',
    route_name: detail.route?.route_name || detail.session.route_name || '',
    market_type: marketType,
    total_shops: document.querySelector('#mcpReportTotalShops')?.value || 1,
    customer_id: customer.id,
    customer_name: customer.customer_name,
    customer_phone: customer.phone,
    competitor_summary: marketType === 'price' ? '' : competitor,
    price_summary: marketType === 'price' ? competitor : '',
    demand_summary: demand,
    opportunity_summary: opportunity,
    risk_summary: risk,
    next_action: nextAction,
    note,
    sync_status: 'local',
    raw_payload: {
      source: 'mcp',
      kind: 'market_report',
      mcp_session_id: detail.session.id,
      mcp_route_id: detail.session.route_id,
      mcp_route_name: detail.route?.route_name || detail.session.route_name || '',
      route_customer_id: customer.id,
      customer_name: customer.customer_name,
      customer_phone: customer.phone,
      customer_area: customer.area,
      customer_address: customer.address,
      google_maps_url: customer.google_maps_url || '',
      geo_lat: customer.geo_lat ?? null,
      geo_lng: customer.geo_lng ?? null
    }
  });
  await putLocal(LOCAL_STORES.marketReports, report);
  const visit = detail.visits.find((item) => item.route_customer_id === customer.id);
  await upsertMcpVisitForSession({
    ...(visit || {}),
    id: visit?.id,
    session_id: detail.session.id,
    route_id: detail.session.route_id,
    route_customer_id: customer.id,
    visit_date: detail.session.session_date,
    status: 'report',
    has_order: visit?.has_order,
    has_test: visit?.has_test,
    has_report: true,
    order_id: visit?.order_id,
    test_id: visit?.test_id,
    report_id: report.id,
    note: 'Có báo cáo thị trường'
  });
  document.querySelector('#modal')?.close();
  window.dispatchEvent(new CustomEvent('mcp:session-changed'));
  window.dispatchEvent(new CustomEvent('report:changed'));
  toast('Đã lưu báo cáo từ MCP.');
}

function handleClick(event) {
  const button = event.target.closest('[data-mcp-create-report]');
  if (button && button.closest('section.page[data-page="mcp"]')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    openMcpReportModal(button.dataset.customerId || '').catch((error) => {
      console.warn('mcp report open failed', error);
      toast('Không mở được báo cáo từ MCP.');
    });
    return;
  }
  if (event.target.closest('section.page[data-page="mcp"]')) scheduleEnsure();
}

function boot() {
  mountStyle();
  scheduleEnsure();
}

window.addEventListener('click', handleClick, true);
document.addEventListener('submit', (event) => {
  if (!event.target.matches('[data-mcp-report-form]')) return;
  saveMcpReport(event).catch((error) => {
    console.warn('mcp report save failed', error);
    toast('Không lưu được báo cáo từ MCP.');
  });
});
window.addEventListener('mcp:session-changed', scheduleEnsure);
boot();
window.addEventListener('DOMContentLoaded', boot);
