import { makeAiSummary, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, getAllLocal, putLocal } from '../local-db.js';

const $=(s,r=document)=>r.querySelector(s);
const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const parse=(v='')=>{try{return JSON.parse(v)}catch{return null}};
let current=null;

function okRow(r={}){return r.status!=='deleted'&&!r.deleted_at&&!r.raw_payload?.deleted_at}
function toast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
function close(){const m=$('#modal');if(m?.open)m.close();if(m)m.dataset.type=''}

async function snap(){
  await openLocalDb();
  const [orders,items,tests,reports,routes]=await Promise.all([getAllLocal(LOCAL_STORES.orders),getAllLocal(LOCAL_STORES.orderItems),getAllLocal(LOCAL_STORES.onaTests),getAllLocal(LOCAL_STORES.marketReports),getAllLocal(LOCAL_STORES.mcpRouteSessions)]);
  return {today:todayIsoDate(),orders:orders.filter(okRow).slice(-80),order_items:items.filter(okRow).slice(-160),tests:tests.filter(okRow).slice(-120),market_reports:reports.filter(okRow).slice(-160),mcp_sessions:routes.filter(okRow).slice(-80),metrics:{orders:orders.filter(okRow).length,tests:tests.filter(okRow).length,market_reports:reports.filter(okRow).length,mcp_sessions:routes.filter(okRow).length}};
}

function style(){
  if($('style[data-smart-result-flow]'))return;
  const s=document.createElement('style');s.dataset.smartResultFlow='1';
  s.textContent=`#modal[data-type="smart-result"]{width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;padding:0!important;overflow:hidden!important}#modal[data-type="smart-result"]::backdrop{background:rgba(8,35,55,.42)!important}.sr-modal{height:100dvh!important;display:grid!important;grid-template-rows:auto auto minmax(0,1fr) auto!important;background:#f6fbf9!important;color:#082337!important}.sr-modal.sr-loading-mode{grid-template-rows:auto minmax(0,1fr) auto!important}.sr-head{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;padding:14px 14px 10px!important;background:#fff!important;border-bottom:1px solid #dce8e5!important}.sr-head h2{margin:0!important;font-size:19px!important}.sr-close{border:1px solid #dce8e5!important;background:#fff!important;color:#007866!important;border-radius:999px!important;min-height:34px!important;padding:0 12px!important;font-weight:950!important}.sr-tabs{display:grid!important;grid-template-columns:repeat(4,1fr)!important;gap:6px!important;padding:10px!important;background:#fff!important;border-bottom:1px solid #dce8e5!important}.sr-tabs button{border:1px solid #dce8e5!important;background:#fbfffd!important;border-radius:999px!important;min-height:34px!important;font-size:11px!important;font-weight:950!important;color:#425863!important}.sr-tabs button.active{background:#e1f8f1!important;border-color:#9bdccd!important;color:#007866!important}.sr-body{min-height:0!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important;padding:10px!important;display:grid!important;gap:10px!important;align-content:start!important}.sr-section{display:none!important;background:#fff!important;border:1px solid #dce8e5!important;border-radius:16px!important;padding:12px!important;box-shadow:0 8px 18px rgba(12,55,50,.05)!important}.sr-section.active{display:grid!important;gap:9px!important}.sr-section h3{margin:0!important;font-size:15px!important}.sr-section p,.sr-section li{font-size:13px!important;line-height:1.45!important;color:#33444c!important}.sr-section ul{margin:0!important;padding-left:18px!important;display:grid!important;gap:6px!important}.sr-empty{color:#63727c!important;border:1px dashed #dce8e5!important;border-radius:12px!important;background:#fbfffd!important;padding:10px!important}.sr-foot{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;padding:10px 12px calc(10px + env(safe-area-inset-bottom))!important;background:#fff!important;border-top:1px solid #dce8e5!important;align-self:end!important}.sr-foot button{min-height:44px!important;height:44px!important;border-radius:13px!important;font-weight:950!important}.sr-save{border:0!important;background:linear-gradient(135deg,#00957f,#007866)!important;color:#fff!important}.sr-export{border:1px solid #00957f!important;background:#fff!important;color:#007866!important}.sr-loading{background:#fff!important;border:1px solid #dce8e5!important;border-radius:16px!important;padding:14px!important;display:grid!important;gap:6px!important}.sr-loading b{font-size:16px!important}.sr-loading small{color:#63727c!important;font-size:12px!important}`;
  document.head.appendChild(s);
}

function li(arr=[],map=x=>x){return Array.isArray(arr)&&arr.length?`<ul>${arr.map(x=>`<li>${esc(map(x))}</li>`).join('')}</ul>`:'<p class="sr-empty">Chưa có dữ liệu nổi bật.</p>'}
function txt(r={}){return ['TÓM TẮT',r.summary||'', '', 'KHÁCH CẦN XỬ LÝ',...(r.customer_actions||[]).map(x=>`- ${x.customer||'Khách'}: ${x.action||''}`), '', 'SẢN PHẨM',...(r.product_insights||[]).map(x=>`- ${x.product||'Sản phẩm'}: ${x.insight||''}`), '', 'VIỆC CẦN LÀM',...(r.next_steps||[]).map(x=>`- ${x}`)].join('\n').trim()}

function showLoading(data){
  style();const m=$('#modal');if(!m)return;m.dataset.type='smart-result';
  m.innerHTML=`<div class="sr-modal sr-loading-mode"><header class="sr-head"><h2>Báo cáo thông minh</h2><button class="sr-close" data-sr-close>Đóng</button></header><div class="sr-body"><div class="sr-loading"><b>Đang tổng hợp dữ liệu...</b><small>MCP: ${data.metrics.mcp_sessions} · Đơn: ${data.metrics.orders} · Test: ${data.metrics.tests} · Báo cáo: ${data.metrics.market_reports}</small></div></div><footer class="sr-foot"><button class="sr-save" disabled>Lưu báo cáo</button><button class="sr-export" disabled>Xuất TXT</button></footer></div>`;
  if(!m.open)m.showModal();
}

function showResult(payload){
  current=payload;style();const m=$('#modal');if(!m)return;const r=payload.result||{};
  m.dataset.type='smart-result';
  m.innerHTML=`<div class="sr-modal"><header class="sr-head"><h2>Báo cáo thông minh</h2><button class="sr-close" data-sr-close>Đóng</button></header><nav class="sr-tabs"><button class="active" data-sr-tab="sum">Tổng quan</button><button data-sr-tab="cus">Khách</button><button data-sr-tab="prd">Sản phẩm</button><button data-sr-tab="todo">Việc cần làm</button></nav><div class="sr-body"><section class="sr-section active" data-sr-section="sum"><h3>Tổng quan</h3><p>${esc(r.summary||'Chưa có tóm tắt.')}</p>${li(r.market_insights)}</section><section class="sr-section" data-sr-section="cus"><h3>Khách cần xử lý</h3>${li(r.customer_actions,x=>`${x.customer||'Khách'}: ${x.action||''}${x.reason?' — '+x.reason:''}`)}${li(r.order_opportunities,x=>`${x.customer||'Khách'}: ${(x.products||[]).join(', ')}${x.reason?' — '+x.reason:''}`)}</section><section class="sr-section" data-sr-section="prd"><h3>Sản phẩm</h3>${li(r.product_insights,x=>`${x.product||'Sản phẩm'}: ${x.insight||''}`)}${li(r.sample_requests,x=>`${x.customer||'Khách'}: ${(x.products||[]).join(', ')}${x.note?' — '+x.note:''}`)}</section><section class="sr-section" data-sr-section="todo"><h3>Việc cần làm</h3>${li(r.next_steps)}${li(r.risks)}</section></div><footer class="sr-foot"><button class="sr-save" data-sr-save>Lưu báo cáo</button><button class="sr-export" data-sr-export>Xuất TXT</button></footer></div>`;
  if(!m.open)m.showModal();
  renderPanel(payload);
}

function renderPanel(payload){const p=$('#aiResult');if(!p)return;p.innerHTML=`<h2>Kết quả phân tích</h2><p>${esc(payload.result?.summary||'Đã tạo báo cáo. Bấm Tạo báo cáo để xem lại popup.')}</p>`}

async function run(){
  const data=await snap();showLoading(data);const btn=$('#smartReportRun')||$('#aiBtn');if(btn){btn.disabled=true;btn.textContent='Đang tổng hợp...'}
  try{const res=await fetch('/api/report-agent',{method:'POST',headers:{'Content-Type':'application/json; charset=utf-8',Accept:'application/json'},body:JSON.stringify({snapshot:data}),cache:'no-store'});const json=parse(await res.text())||{};const payload={ok:res.ok&&!!json.ok,result:json.result||{},snapshot:data};if(!payload.ok)payload.result={summary:'Chưa tạo được báo cáo. Vui lòng thử lại sau.',next_steps:['Kiểm tra kết nối và thử lại.']};showResult(payload);toast(payload.ok?'Đã tạo xong báo cáo':'Chưa tạo được báo cáo')}catch{showResult({ok:false,result:{summary:'Chưa tạo được báo cáo. Vui lòng thử lại sau.',next_steps:['Kiểm tra kết nối và thử lại.']},snapshot:data});toast('Chưa tạo được báo cáo')}finally{if(btn){btn.disabled=false;btn.textContent='Tạo báo cáo'}}
}

async function save(){if(!current)return toast('Chưa có báo cáo để lưu');await openLocalDb();const row=makeAiSummary({title:`Báo cáo thông minh ${current.snapshot.today}`,summary_type:'company_report',date_from:current.snapshot.today,date_to:current.snapshot.today,source_filters:{source:'smart_report',metrics:current.snapshot.metrics},source_refs:[{type:'orders',count:current.snapshot.metrics.orders},{type:'tests',count:current.snapshot.metrics.tests},{type:'market_reports',count:current.snapshot.metrics.market_reports},{type:'mcp_sessions',count:current.snapshot.metrics.mcp_sessions}],result:{text:txt(current.result),json:current.result,generated_at:new Date().toISOString()},status:'saved',note:'Báo cáo đã lưu'});await putLocal(LOCAL_STORES.aiSummaries,row);toast('Đã lưu báo cáo')}
function exp(){if(!current)return toast('Chưa có báo cáo để xuất');const blob=new Blob([txt(current.result)],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`bao-cao-thong-minh-${current.snapshot.today}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Đã xuất TXT')}

document.addEventListener('click',async e=>{const runBtn=e.target.closest('#smartReportRun');if(runBtn){e.preventDefault();e.stopImmediatePropagation();await run();return}const tab=e.target.closest('[data-sr-tab]');if(tab){e.preventDefault();document.querySelectorAll('[data-sr-tab]').forEach(b=>b.classList.toggle('active',b===tab));document.querySelectorAll('[data-sr-section]').forEach(s=>s.classList.toggle('active',s.dataset.srSection===tab.dataset.srTab));return}if(e.target.closest('[data-sr-close]')){e.preventDefault();close();return}if(e.target.closest('[data-sr-save]')){e.preventDefault();await save();return}if(e.target.closest('[data-sr-export]')){e.preventDefault();exp()}},true);
style();
