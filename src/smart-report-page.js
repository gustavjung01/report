import './smart-report-flow.js?v=smart-report-flow-1';
import './copy-clean.js?v=copy-clean-1';

const reportTypes=[
  {type:'executive_report',icon:'📊',title:'Báo cáo điều hành',desc:'Chọn dữ liệu cụ thể để tổng hợp tình hình kinh doanh, thị trường, sản phẩm và việc cần làm.'},
  {type:'customer_action_report',icon:'👥',title:'Khách cần xử lý',desc:'Chọn khách cần phân tích để xem tình trạng, cơ hội đơn, phản hồi và hành động tiếp theo.'},
  {type:'product_market_report',icon:'📦',title:'Sản phẩm & thị trường',desc:'Chọn sản phẩm để phân tích phản hồi test, tín hiệu thị trường, cơ hội và rủi ro.'},
  {type:'route_sales_report',icon:'🗺️',title:'Tuyến & hiệu suất sales',desc:'Chọn tuyến hoặc sales để xem khách đã ghé, khách bỏ sót, cơ hội và việc cần làm.'}
];

function render(){
  const page=document.querySelector('[data-page="ai"]');
  if(!page)return;
  const cards=reportTypes.map(item=>`<button class="smart-report-card" type="button" data-report-type="${item.type}"><i>${item.icon}</i><span><b>${item.title}</b><small>${item.desc}</small></span><em>Chọn</em></button>`).join('');
  page.innerHTML=`<div class="ai-page-head"><div class="ai-page-title"><h1>Báo cáo thông minh</h1><p>Chọn loại báo cáo trước, sau đó chọn đúng dữ liệu cần phân tích.</p></div></div><div class="ai-page-body"><article class="smart-report-intro"><b>AI phân tích theo dữ liệu bạn chọn</b><small>Không tự gom toàn bộ lịch sử. Mỗi báo cáo cần chọn rõ khách, sản phẩm, tuyến hoặc dữ liệu cụ thể.</small></article><section class="smart-report-types"><h2>Chọn loại báo cáo</h2><div class="smart-report-grid">${cards}</div></section><section class="smart-report-note"><b>Luồng tiếp theo</b><small>Bấm một loại báo cáo sẽ mở popup chọn dữ liệu ở bước 5.2. Chưa chọn dữ liệu thì chưa gọi AI.</small></section></div>`;
}
function css(){
  let s=document.querySelector('style[data-smart-report-page]');
  if(!s){s=document.createElement('style');s.datasetSmartReportPage='1';s.dataset.smartReportPage='1';document.head.appendChild(s)}
  s.textContent='[data-page="ai"]{height:100%;min-height:0;overflow:hidden!important;display:none}[data-page="ai"].active{display:grid!important;grid-template-rows:auto minmax(0,1fr)!important;gap:10px!important}.ai-page-title h1{font-size:21px!important;margin:0!important}.ai-page-title p{margin:4px 0 0!important;color:#63727c!important;font-size:12px!important;line-height:1.25!important}.ai-page-body{min-height:0;overflow-y:auto;display:grid;gap:10px}.smart-report-intro{border-radius:20px;background:linear-gradient(135deg,#007866,#00a991);color:#fff;padding:13px;display:grid;gap:5px}.smart-report-intro b{font-size:17px;line-height:1.15}.smart-report-intro small{color:rgba(255,255,255,.86);font-size:12px;line-height:1.35}.smart-report-types{background:#fff;border:1px solid #dce8e5;border-radius:17px;padding:11px;display:grid;gap:10px}.smart-report-types h2{font-size:15px;margin:0;color:#082337}.smart-report-grid{display:grid;gap:9px}.smart-report-card{width:100%;border:1px solid #dce8e5;background:#fbfffd;border-radius:15px;padding:10px;display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:9px;text-align:left;box-shadow:0 7px 16px rgba(12,55,50,.045)}.smart-report-card i{width:38px;height:38px;border-radius:13px;background:#e1f8f1;display:grid;place-items:center;font-style:normal;font-size:20px}.smart-report-card span{display:grid;gap:3px;min-width:0}.smart-report-card b{font-size:14px;line-height:1.18;color:#082337}.smart-report-card small{font-size:11.5px;line-height:1.3;color:#63727c}.smart-report-card em{font-style:normal;border-radius:999px;background:#e1f8f1;color:#007866;font-size:11px;font-weight:950;padding:5px 8px}.smart-report-note{background:#fff;border:1px dashed #bfe9dc;border-radius:15px;padding:10px;display:grid;gap:4px}.smart-report-note b{font-size:13px;color:#082337}.smart-report-note small{font-size:12px;line-height:1.35;color:#63727c}';
}
css();render();window.addEventListener('DOMContentLoaded',()=>{css();render()});
