import './smart-report-flow.js?v=smart-report-flow-1';
import './smart-report-select-flow.js?v=smart-report-select-flow-5-5';
import './smart-report-select-mobile-flow.js?v=smart-report-mobile-picker-1';
import './smart-report-select-layout-fix.js?v=smart-report-select-layout-fix-2';
import './copy-clean.js?v=copy-clean-1';

const reportTypes = [
  { type: 'executive_report', icon: '📊', title: 'Báo cáo điều hành', tag: 'Tổng hợp', desc: 'Chọn dữ liệu cụ thể để tổng hợp tình hình kinh doanh, thị trường, sản phẩm và việc cần làm.' },
  { type: 'customer_action_report', icon: '👥', title: 'Khách cần xử lý', tag: 'Hành động', desc: 'Chọn khách hoặc dữ liệu liên quan để xem tình trạng, cơ hội đơn, phản hồi và việc cần làm.' },
  { type: 'product_market_report', icon: '📦', title: 'Sản phẩm & thị trường', tag: 'Phân tích', desc: 'Chọn sản phẩm hoặc file test để phân tích phản hồi, tín hiệu thị trường, cơ hội và rủi ro.' },
  { type: 'route_sales_report', icon: '🗺️', title: 'Tuyến & hiệu suất sales', tag: 'Tuyến bán', desc: 'Chọn tuyến hoặc sales để xem khách đã ghé, khách bỏ sót, cơ hội và việc cần làm.' }
];

function render() {
  const page = document.querySelector('[data-page="ai"]');
  if (!page) return;
  const cards = reportTypes.map(item => `
    <button class="smart-report-card" type="button" data-ai-mobile-report-type="${item.type}">
      <i>${item.icon}</i><span><b>${item.title}</b><small>${item.desc}</small></span><em>${item.tag}</em>
    </button>
  `).join('');
  page.innerHTML = `
    <div class="ai-page-head"><div class="ai-page-title"><h1>Báo cáo thông minh</h1><p>Chọn loại báo cáo trước, sau đó chọn đúng dữ liệu cần phân tích.</p></div></div>
    <div class="ai-page-body">
      <article class="smart-report-intro"><b>AI chỉ phân tích dữ liệu bạn chọn</b><small>Không tự gom lịch sử. Chọn rõ khách, sản phẩm, tuyến hoặc từng file dữ liệu trước khi tạo báo cáo.</small></article>
      <section class="smart-report-types"><div class="smart-report-types-head"><h2>Chọn loại báo cáo</h2><small>4 nhánh phân tích riêng</small></div><div class="smart-report-grid">${cards}</div></section>
      <section class="smart-report-note"><b>Bước hiện tại</b><small>Bấm một loại báo cáo để mở popup chọn dữ liệu, tạo báo cáo và xem kết quả theo tab riêng.</small></section>
      <section id="aiResult" class="smart-report-result-anchor" hidden></section>
    </div>`;
}
function css() {
  let s = document.querySelector('style[data-smart-report-page]');
  if (!s) { s = document.createElement('style'); s.dataset.smartReportPage = '1'; document.head.appendChild(s); }
  s.textContent = `
    [data-page="ai"]{height:100%;min-height:0;overflow:hidden!important;display:none}
    [data-page="ai"].active{display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important}
    .ai-page-title h1{font-size:22px!important;margin:0!important;letter-spacing:-.02em}.ai-page-title p{margin:4px 0 0!important;color:#63727c!important;font-size:12px!important;line-height:1.25!important}
    .ai-page-body{min-height:0;overflow-y:auto;display:grid;gap:11px;padding-bottom:6px}
    .smart-report-intro{position:relative;overflow:hidden;border-radius:22px;background:radial-gradient(circle at 18% 0%,rgba(255,255,255,.22),transparent 34%),linear-gradient(135deg,#007866,#00a991);color:#fff;padding:15px;display:grid;gap:5px;box-shadow:0 16px 34px rgba(0,120,102,.18)}
    .smart-report-intro:after{content:"";position:absolute;right:-36px;top:-38px;width:112px;height:112px;border-radius:999px;background:rgba(255,255,255,.13)}
    .smart-report-intro b{position:relative;z-index:1;font-size:18px;line-height:1.12}.smart-report-intro small{position:relative;z-index:1;color:rgba(255,255,255,.88);font-size:12px;line-height:1.35}
    .smart-report-types{background:rgba(255,255,255,.9);border:1px solid #dce8e5;border-radius:20px;padding:12px;display:grid;gap:11px;box-shadow:0 12px 30px rgba(12,55,50,.06);backdrop-filter:blur(8px)}
    .smart-report-types-head{display:flex;align-items:end;justify-content:space-between;gap:8px}.smart-report-types h2{font-size:15px;margin:0;color:#082337}.smart-report-types-head small{font-size:11px;color:#63727c}
    .smart-report-grid{display:grid;gap:10px}.smart-report-card{position:relative;width:100%;border:1px solid #dce8e5;background:linear-gradient(180deg,#fff,#f8fffc);border-radius:18px;padding:12px;display:grid;grid-template-columns:42px minmax(0,1fr) auto;align-items:center;gap:10px;text-align:left;box-shadow:0 10px 24px rgba(12,55,50,.055);overflow:hidden}
    .smart-report-card:before{content:"";position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:999px;background:#00a991;opacity:.65}.smart-report-card i{width:42px;height:42px;border-radius:15px;background:linear-gradient(135deg,#dff8f1,#eefbf6);display:grid;place-items:center;font-style:normal;font-size:21px}.smart-report-card span{display:grid;gap:4px;min-width:0}.smart-report-card b{font-size:14.5px;line-height:1.15;color:#082337}.smart-report-card small{font-size:11.5px;line-height:1.32;color:#526873}.smart-report-card em{font-style:normal;border-radius:999px;background:#e1f8f1;color:#007866;font-size:10.5px;font-weight:950;padding:6px 8px;white-space:nowrap}
    .smart-report-note{background:#fff;border:1px dashed #bfe9dc;border-radius:16px;padding:11px;display:grid;gap:4px}.smart-report-note b{font-size:13px;color:#082337}.smart-report-note small{font-size:12px;line-height:1.35;color:#63727c}.smart-report-result-anchor{display:none!important}
    @media (min-width:540px){.smart-report-grid{grid-template-columns:1fr 1fr}.smart-report-card{min-height:118px;grid-template-columns:42px minmax(0,1fr);align-content:start}.smart-report-card em{position:absolute;right:10px;top:10px}}
  `;
}
css(); render(); window.addEventListener('DOMContentLoaded', () => { css(); render(); });