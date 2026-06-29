import './test-pull.js';
import './compact-detail.js?v=test-detail-width-1';
import './app-update.js';
import './test-export.js';
import './modal-scroll-fix.js';
import './modal-form-ui.js';
import './mcp-start.js';
import './page-router-fix.js';
import './data-hub-shell.js?v=mcp-sessions-1';
import './mcp-ui-shell.js';
import './order-ui.js?v=home-card-selector-fix-1';
import './business-ui-shells.js?v=home-card-selector-fix-1';
import './ai-agent-settings.js';

function addCss(){
  let s=document.querySelector('style[data-test-fixes]');
  if(!s){s=document.createElement('style');s.dataset.testFixes='1';document.head.appendChild(s)}
  s.textContent=`
    html,body{width:100%;max-width:100%;overflow-x:hidden!important}
    .app{width:100%!important;max-width:none!important;margin:0!important;transform:none!important;overflow-x:hidden!important}
    main{width:100%!important;max-width:100%!important;overflow:hidden!important}
    .hero,.tabs{display:none!important}
    .card,.nav button,.secondary,.primary,.sync-state,.head button,.mini{pointer-events:auto!important;touch-action:manipulation!important}
    .card *,.nav button *{pointer-events:none!important}
    .test-actions *,.admin-actions *,.modal *,.mcp-page *,.shell-page *{pointer-events:auto!important}
    .modal .test-row{background:linear-gradient(180deg,#f5fffb,#eefbf6)!important;border-color:#bfe9dc!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)!important}
    .modal .test-row>b{color:#087463!important}
    .modal .test-row select{background:#e4f7f0!important;border-color:#9bdccd!important;color:#075f52!important;font-weight:900!important;box-shadow:0 1px 0 rgba(255,255,255,.8)!important}
    .modal .test-row select:focus{outline:2px solid rgba(0,149,127,.16)!important;border-color:#00957f!important}
    .modal .test-row input{background:#fff!important;border-color:#cad7d4!important}
  `;
}

function ensureMcpCard(){
  const grid=document.querySelector('.grid-actions');
  if(!grid || grid.querySelector('[data-home-card="mcp"]'))return;
  const card=document.createElement('button');
  card.type='button';
  card.className='card home-card card-mcp';
  card.dataset.homeCard='mcp';
  card.dataset.page='mcp';
  card.innerHTML='<i>🧭</i><b>MCP tuyến</b><small>Tuyến hôm nay và trạng thái ghé.</small><em>Xem UI</em>';
  grid.insertBefore(card,grid.firstElementChild);
}

function tuneHomeCards(){
  ensureMcpCard();
  document.querySelectorAll('.card').forEach(c=>{
    const t=c.textContent||'';
    c.classList.remove('is-hidden','card-mcp','card-order','card-test','card-report','home-card');
    c.classList.add('home-card');
    let i=c.querySelector('i'),b=c.querySelector('b'),sm=c.querySelector('small'),e=c.querySelector('em');

    if(c.dataset.homeCard==='mcp'||t.includes('MCP')){
      c.classList.add('card-mcp');
      c.dataset.page='mcp';
      if(i)i.textContent='🧭';
      if(b)b.textContent='MCP tuyến';
      if(sm)sm.textContent='Tuyến hôm nay và trạng thái ghé.';
      if(e)e.textContent='Xem UI';
      return;
    }

    if(t.includes('Đơn hàng')){
      c.classList.add('card-order');
      c.removeAttribute('data-open');
      c.dataset.page='order-shell';
      if(i)i.textContent='🛒';
      if(b)b.textContent='Đơn hàng';
      if(sm)sm.textContent='Tạo đơn nhanh từ khách/tuyến.';
      if(e)e.textContent='Mở';
      return;
    }

    if(t.includes('File test')||t.includes('Test sản phẩm')){
      c.classList.add('card-test');
      c.removeAttribute('data-open');
      c.setAttribute('data-open-test','');
      if(i)i.textContent='🧪';
      if(b)b.textContent='Test sản phẩm';
      if(sm)sm.textContent='Tạo file test và thêm khách.';
      if(e)e.textContent='Mở';
      return;
    }

    if(t.includes('Báo cáo thị trường')||t.includes('Báo cáo')){
      c.classList.add('card-report');
      c.removeAttribute('data-open');
      c.dataset.page='report-shell';
      if(i)i.textContent='📊';
      if(b)b.textContent='Báo cáo';
      if(sm)sm.textContent='Khung UI thị trường.';
      if(e)e.textContent='Xem UI';
    }
  });
}

function focus(){
  tuneHomeCards();
  const h=document.querySelector('[data-page="data"] h1');
  if(h)h.textContent='Dữ liệu';
  const w=document.querySelector('.warn');
  if(w)w.textContent='Local DB là cache. Supabase dùng để đồng bộ nhiều thiết bị.';
  const create=document.querySelector('.nav [data-page="create"] span');
  const data=document.querySelector('.nav [data-page="data"] span');
  const ai=document.querySelector('.nav [data-page="ai"] span');
  const admin=document.querySelector('.nav [data-page="admin"] span');
  if(create)create.textContent='Home';
  if(data)data.textContent='Dữ liệu';
  if(ai)ai.textContent='AI';
  if(admin)admin.textContent='Admin';
}

addCss();
focus();
window.addEventListener('DOMContentLoaded',focus);
