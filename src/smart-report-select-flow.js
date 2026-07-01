import { LOCAL_STORES, openLocalDb, getAllLocal } from '../local-db.js';

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const esc=(v='')=>String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

const reportConfig={
  executive_report:{title:'Báo cáo điều hành',hint:'Chọn từng file dữ liệu cần tổng hợp cho báo cáo quản lý.',sources:['mcp','orders','tests','reports']},
  customer_action_report:{title:'Khách cần xử lý',hint:'Chọn file/khách/dữ liệu liên quan đến khách cần xử lý.',sources:['orders','tests','reports','mcp']},
  product_market_report:{title:'Sản phẩm & thị trường',hint:'Chọn file test, đơn hoặc báo cáo có liên quan đến sản phẩm cần phân tích.',sources:['tests','orders','reports']},
  route_sales_report:{title:'Tuyến & hiệu suất sales',hint:'Chọn tuyến, phiên đi tuyến, đơn hoặc báo cáo cần đánh giá.',sources:['mcp','orders','reports']}
};
const sourceMeta={
  mcp:{label:'MCP tuyến',store:LOCAL_STORES.mcpRouteSessions,icon:'🧭'},
  orders:{label:'Đơn hàng',store:LOCAL_STORES.orders,icon:'🛒'},
  tests:{label:'Test sản phẩm',store:LOCAL_STORES.onaTests,icon:'🧪'},
  reports:{label:'Báo cáo thị trường',store:LOCAL_STORES.marketReports,icon:'📊'}
};

function active(r={}){return r.status!=='deleted'&&!r.deleted_at&&!r.raw_payload?.deleted_at}
function val(r={},keys=[]){for(const k of keys){const v=k.split('.').reduce((a,p)=>a?.[p],r);if(v!==undefined&&v!==null&&String(v).trim())return v}return ''}
function dateOf(r={}){return String(val(r,['file_date','session_date','route_date','date','visit_date','order_date','test_date','report_date','created_at','createdAt','updated_at'])||'').slice(0,10)}
function money(v){const n=Number(v||0);return n?`${n.toLocaleString('vi-VN')}đ`:''}
function first(rows=[],keys=[]){for(const row of rows){const v=val(row,keys);if(v)return v}return ''}
function uniqueCount(rows=[],keys=[]){const set=new Set();for(const row of rows){const v=val(row,keys);if(v)set.add(String(v).trim())}return set.size}
function fileKey(source,r={},i=0){
  const keys={
    tests:['file_id','test_file_id','session_id','batch_id','test_session_id','raw_payload.file_id','raw_payload.session_id','created_at'],
    mcp:['file_id','session_id','route_session_id','mcp_session_id','route_id','route_name','date','visit_date','created_at'],
    orders:['id','order_id','order_code','code','local_id','created_at'],
    reports:['id','report_id','file_id','session_id','title','date','created_at']
  }[source]||['id','created_at'];
  const v=val(r,keys);return `${source}:${v||i}`;
}
function titleOfGroup(source,rows=[],i=0){
  const r=rows[0]||{};const date=dateOf(r);
  const customer=first(rows,['customer_name','customerName','customer.name','customer','shop_name','store_name','outlet_name']);
  const product=first(rows,['product_name','productName','product.name','product','sku_name','item_name']);
  const route=first(rows,['route_name','routeName','route','route_id','routeId']);
  const sales=first(rows,['sales_name','salesName','seller_name','user_name','created_by_name']);
  if(source==='mcp')return route?`Tuyến ${route}${date?' - '+date:''}`:`Phiên MCP ${sales||customer||date||'#'+(i+1)}`;
  if(source==='orders')return `Đơn ${customer||val(r,['code','order_code','id'])||date||'#'+(i+1)}`;
  if(source==='tests')return `File test ${product||customer||date||'#'+(i+1)}`;
  if(source==='reports')return `Báo cáo ${customer||first(rows,['area','market','district','title'])||date||'#'+(i+1)}`;
  return `File dữ liệu ${i+1}`;
}
function metaOfGroup(source,rows=[]){
  const r=rows[0]||{};const date=dateOf(r);const amount=money(first(rows,['total_amount','grand_total','amount','total']));
  const customers=uniqueCount(rows,['customer_name','customerName','customer.name','customer','shop_name','store_name','outlet_name']);
  const products=uniqueCount(rows,['product_name','productName','product.name','product','sku_name','item_name']);
  const parts=[date,rows.length>1?`${rows.length} dòng`:'' ,customers?`${customers} khách`:'' ,products?`${products} sản phẩm`:'' ,amount].filter(Boolean);
  return parts.join(' · ')||sourceMeta[source]?.label||'File dữ liệu';
}
function groupRows(source,rows=[]){
  const map=new Map();
  rows.forEach((row,i)=>{const key=fileKey(source,row,i);if(!map.has(key))map.set(key,[]);map.get(key).push(row)});
  return Array.from(map.entries()).map(([id,group],i)=>({source,id,title:titleOfGroup(source,group,i),meta:metaOfGroup(source,group),date:dateOf(group[0]||{}),rows:group}));
}
async function collect(config){
  await openLocalDb();
  const data={};
  for(const source of config.sources){
    const meta=sourceMeta[source];
    const rows=(await getAllLocal(meta.store)).filter(active);
    const groups=groupRows(source,rows);
    groups.sort((a,b)=>String(b.date||'').localeCompare(String(a.date||'')));
    data[source]=groups.slice(0,80);
  }
  return data;
}

function style(){
  if($('style[data-smart-select-flow]'))return;
  const s=document.createElement('style');s.dataset.smartSelectFlow='1';
  s.textContent=`#modal[data-type="smart-select"]{width:100vw!important;height:100dvh!important;max-width:none!important;max-height:none!important;margin:0!important;border-radius:0!important;padding:0!important;overflow:hidden!important}#modal[data-type="smart-select"]::backdrop{background:rgba(8,35,55,.42)!important}.ss-modal{height:100dvh;min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:#f6fbf9;color:#082337}.ss-head{background:#fff;border-bottom:1px solid #dce8e5;padding:14px;display:flex;align-items:center;justify-content:space-between;gap:10px}.ss-head h2{margin:0;font-size:19px;line-height:1.15}.ss-close{border:1px solid #dce8e5;background:#fff;color:#007866;border-radius:999px;min-height:34px;padding:0 12px;font-weight:950}.ss-brief{background:#fff;border-bottom:1px solid #dce8e5;padding:10px 14px;display:grid;gap:5px}.ss-brief b{font-size:14px}.ss-brief small{font-size:12px;color:#63727c;line-height:1.35}.ss-body{min-height:0;overflow:auto;-webkit-overflow-scrolling:touch;padding:10px;display:grid;gap:10px;align-content:start}.ss-tools{position:sticky;top:0;z-index:2;background:#f6fbf9;padding-bottom:2px;display:grid;gap:7px}.ss-search{width:100%;min-height:42px;border:1px solid #dce8e5;border-radius:14px;background:#fff;padding:0 12px;font-size:14px}.ss-count{border:1px solid #bfe9dc;background:#eefbf6;color:#007866;border-radius:999px;width:max-content;padding:5px 9px;font-size:12px;font-weight:950}.ss-group{background:#fff;border:1px solid #dce8e5;border-radius:17px;overflow:hidden;box-shadow:0 9px 22px rgba(12,55,50,.045);display:grid;grid-template-rows:auto minmax(0,1fr);min-height:0}.ss-group-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:11px 12px;background:linear-gradient(180deg,#fff,#fbfffd);border-bottom:1px solid #edf2f0}.ss-group-head b{font-size:14px}.ss-group-head small{font-size:12px;color:#63727c}.ss-list{display:grid;max-height:min(42dvh,360px);overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}.ss-row{display:grid;grid-template-columns:auto minmax(0,1fr);gap:9px;align-items:start;padding:11px 12px;border-top:1px solid #f0f4f2;min-height:56px}.ss-row:first-child{border-top:0}.ss-row input{margin-top:3px;accent-color:#00957f;width:16px;height:16px}.ss-row span{display:grid;gap:3px;min-width:0}.ss-row strong{font-size:13px;line-height:1.2;color:#082337}.ss-row small{font-size:11.5px;line-height:1.3;color:#63727c}.ss-empty{padding:12px;color:#63727c;font-size:12px}.ss-foot{background:#fff;border-top:1px solid #dce8e5;padding:10px 12px calc(10px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px}.ss-foot button{min-height:44px;border-radius:13px;font-weight:950}.ss-secondary{border:1px solid #00957f;background:#fff;color:#007866}.ss-primary{border:0;background:linear-gradient(135deg,#00957f,#007866);color:#fff}.ss-primary:disabled{opacity:.45}`;
  document.head.appendChild(s);
}
function toast(t){const el=$('#toast');if(!el)return;el.textContent=t;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2200)}
function close(){const m=$('#modal');if(m?.open)m.close();if(m)m.dataset.type=''}
function updateCount(){const n=$$('input[data-ss-item]:checked').length;const c=$('[data-ss-count]');if(c)c.textContent=`Đã chọn ${n} file`;const b=$('[data-ss-next]');if(b)b.disabled=!n}
function filterRows(value=''){const q=value.trim().toLowerCase();$$('.ss-row').forEach(row=>{row.hidden=q&&!row.textContent.toLowerCase().includes(q)});}
function groupHtml(source,rows=[]){const meta=sourceMeta[source];return `<section class="ss-group" data-ss-source="${source}"><div class="ss-group-head"><b>${meta.icon} ${meta.label}</b><small>${rows.length} file</small></div><div class="ss-list">${rows.length?rows.map(row=>`<label class="ss-row"><input type="checkbox" data-ss-item data-source="${source}" value="${esc(row.id)}"><span><strong>${esc(row.title)}</strong><small>${esc(row.meta)}</small></span></label>`).join(''):`<div class="ss-empty">Chưa có dữ liệu.</div>`}</div></section>`}
async function openSelect(reportType){
  const config=reportConfig[reportType]||reportConfig.executive_report;style();const modal=$('#modal');if(!modal)return;
  modal.dataset.type='smart-select';
  modal.innerHTML=`<div class="ss-modal"><header class="ss-head"><h2>${esc(config.title)}</h2><button class="ss-close" data-ss-close>Đóng</button></header><section class="ss-brief"><b>Chọn file dữ liệu phân tích</b><small>${esc(config.hint)} Tối thiểu chọn 1 file. Chưa gọi AI ở bước này.</small></section><div class="ss-body"><div class="ss-tools"><input class="ss-search" data-ss-search placeholder="Tìm khách, sản phẩm, tuyến, ngày..."><span class="ss-count" data-ss-count>Đã chọn 0 file</span></div><div class="ss-empty">Đang đọc dữ liệu...</div></div><footer class="ss-foot"><button class="ss-secondary" data-ss-close>Đóng</button><button class="ss-primary" data-ss-next disabled>Tiếp tục</button></footer></div>`;
  if(!modal.open)modal.showModal();
  const data=await collect(config);
  const body=$('.ss-body',modal);if(!body)return;
  body.innerHTML=`<div class="ss-tools"><input class="ss-search" data-ss-search placeholder="Tìm khách, sản phẩm, tuyến, ngày..."><span class="ss-count" data-ss-count>Đã chọn 0 file</span></div>${config.sources.map(s=>groupHtml(s,data[s]||[])).join('')}`;
}

document.addEventListener('click',async e=>{
  const card=e.target.closest('[data-report-type]');
  if(card){e.preventDefault();e.stopImmediatePropagation();await openSelect(card.dataset.reportType);return}
  if(e.target.closest('[data-ss-close]')){e.preventDefault();close();return}
  if(e.target.closest('[data-ss-next]')){e.preventDefault();const n=$$('input[data-ss-item]:checked').length;toast(n?`Đã chọn ${n} file. Bước 5.3 sẽ nối tạo báo cáo.`:'Vui lòng chọn ít nhất 1 file.');return}
},true);
document.addEventListener('change',e=>{if(e.target.matches('input[data-ss-item]'))updateCount()},true);
document.addEventListener('input',e=>{if(e.target.matches('[data-ss-search]'))filterRows(e.target.value)},true);
style();
