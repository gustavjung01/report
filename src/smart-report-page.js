import { LOCAL_STORES, openLocalDb, getAllLocal } from '../local-db.js';

const $ = (selector, root = document) => root.querySelector(selector);
const esc = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

function activeRow(row = {}) {
  return row.status !== 'deleted' && !row.deleted_at && !row.raw_payload?.deleted_at;
}

async function readMetrics() {
  await openLocalDb();
  const [orders, tests, reports, routes] = await Promise.all([
    getAllLocal(LOCAL_STORES.orders),
    getAllLocal(LOCAL_STORES.onaTests),
    getAllLocal(LOCAL_STORES.marketReports),
    getAllLocal(LOCAL_STORES.mcpRouteSessions)
  ]);
  return {
    orders: orders.filter((row) => activeRow(row) && row.status !== 'cancelled').length,
    tests: tests.filter((row) => activeRow(row) && row.raw_payload?.kind === 'test_file').length,
    reports: reports.filter(activeRow).length,
    routes: routes.filter((row) => activeRow(row) && row.status !== 'cancelled').length
  };
}

function addCss() {
  let style = $('style[data-smart-report-page]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.smartReportPage = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    [data-page="ai"]{height:100%;min-height:0;overflow:hidden!important;display:none}
    [data-page="ai"].active{display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important}
    .ai-page-title h1{font-size:21px!important;line-height:1.05!important;margin:0!important}.ai-page-title p{margin:4px 0 0!important;color:#63727c!important;font-size:12px!important;line-height:1.25!important}
    .ai-page-body{min-height:0;overflow-y:auto;overflow-x:hidden;-webkit-overflow-scrolling:touch;display:grid;gap:10px;padding-right:2px}
    .ai-hero{border:1px solid #bfe9dc;border-radius:20px;background:linear-gradient(135deg,#007866,#00a991);color:#fff;padding:13px;box-shadow:0 13px 28px rgba(0,120,102,.14)}
    .ai-hero b{display:block;font-size:17px;line-height:1.08}.ai-hero small{display:block;margin-top:5px;color:rgba(255,255,255,.84);font-size:12px;line-height:1.25}
    .ai-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px}.ai-metric{background:#fff;border:1px solid #dce8e5;border-radius:15px;padding:9px 5px;text-align:center;box-shadow:0 7px 16px rgba(12,55,50,.045)}.ai-metric b{display:block;font-size:17px}.ai-metric span{display:block;margin-top:4px;color:#63727c;font-size:10px;font-weight:850}
    .ai-panel{background:#fff;border:1px solid #dce8e5;border-radius:17px;padding:11px;box-shadow:0 9px 20px rgba(12,55,50,.052);display:grid;gap:8px}.ai-panel h2{font-size:15px!important;margin:0!important}.ai-panel p{margin:0;color:#63727c;font-size:12px;line-height:1.35}
    .ai-status-pill{display:flex;align-items:center;justify-content:space-between;gap:8px;border:1px solid #dce8e5;background:#fbfffd;border-radius:13px;padding:9px}.ai-status-pill b{display:block;font-size:13px}.ai-status-pill small{display:block;color:#63727c;font-size:11px}.ai-badge{border-radius:999px;background:#e1f8f1;color:#007866;font-weight:950;font-size:10px;padding:4px 7px;white-space:nowrap}.ai-run-btn{border:0;border-radius:13px;background:linear-gradient(135deg,#00957f,#007866);color:#fff;font-weight:950;min-height:40px}
  `;
}

async function renderPage() {
  const page = $('[data-page="ai"]');
  if (!page) return;
  const metrics = await readMetrics();
  page.innerHTML = `
    <div class="ai-page-head"><div class="ai-page-title"><h1>Báo cáo thông minh</h1><p>Tạo báo cáo điều hành từ MCP, đơn hàng, test sản phẩm và báo cáo thị trường.</p></div></div>
    <div class="ai-page-body">
      <article class="ai-hero"><b>Tổng hợp dữ liệu bán hàng</b><small>Hệ thống đọc dữ liệu đã nhập, rút ra điểm chính và đề xuất việc cần làm tiếp theo.</small></article>
      <div class="ai-metrics"><div class="ai-metric"><b>${esc(metrics.routes)}</b><span>MCP</span></div><div class="ai-metric"><b>${esc(metrics.orders)}</b><span>Đơn</span></div><div class="ai-metric"><b>${esc(metrics.tests)}</b><span>Test</span></div><div class="ai-metric"><b>${esc(metrics.reports)}</b><span>Báo cáo</span></div></div>
      <section class="ai-panel"><h2>Báo cáo điều hành</h2><div class="ai-status-pill"><div><b>Dữ liệu sẵn sàng</b><small>Tổng hợp khách cần xử lý, sản phẩm nổi bật, cơ hội và rủi ro.</small></div><span class="ai-badge">Sẵn sàng</span></div><button class="ai-run-btn" type="button" id="aiBtn">Tạo báo cáo</button><p>Sau khi tạo xong, có thể chỉnh nội dung, lưu lại hoặc xuất TXT.</p></section>
    </div>`;
}

function schedule() {
  clearTimeout(schedule.timer);
  schedule.timer = setTimeout(() => renderPage().catch((error) => console.warn('Smart report page render failed', error)), 120);
}

async function boot() {
  addCss();
  await openLocalDb();
  await renderPage();
}

boot();
window.addEventListener('DOMContentLoaded', boot);
window.addEventListener('order:changed', schedule);
window.addEventListener('test:changed', schedule);
window.addEventListener('report:changed', schedule);
window.addEventListener('mcp:session-changed', schedule);
