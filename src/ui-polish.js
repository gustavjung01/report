import './test-pull.js';
import './compact-detail.js';
import './app-update.js';
import './test-export.js';

function addCss(){
  document.querySelectorAll('link[data-ui-polish]').forEach(l=>l.remove());
  const l=document.createElement('link');
  l.rel='stylesheet';
  l.href='src/polish.css?v=hotfix-click-1';
  l.dataset.uiPolish='1';
  document.head.appendChild(l);

  let s=document.querySelector('style[data-test-fixes]');
  if(!s){s=document.createElement('style');s.dataset.testFixes='1';document.head.appendChild(s)}
  s.textContent=`
    html,body{width:100%;max-width:100%;overflow-x:hidden!important}
    .app{width:100%!important;max-width:none!important;margin:0!important;transform:none!important;overflow-x:hidden!important}
    main{width:100%!important;max-width:100%!important;overflow-x:hidden!important}
    .hero,.tabs,.nav [data-page="ai"]{display:none!important}
    .card,.nav button,.secondary,.primary,.sync-state,.head button{pointer-events:auto!important;touch-action:manipulation!important}
    .card *,.nav button *{pointer-events:none!important}
    .test-actions *,.admin-actions *,.modal *{pointer-events:auto!important}
    .grid-actions{grid-template-columns:1fr!important}
    .is-hidden{display:none!important}
  `;
}

function focus(){
  document.querySelectorAll('.card').forEach(c=>{
    const t=c.textContent||'';
    if(t.includes('File test')||t.includes('Test sản phẩm')){
      c.removeAttribute('data-open');
      c.setAttribute('data-open-test','');
      let i=c.querySelector('i'),b=c.querySelector('b'),sm=c.querySelector('small'),e=c.querySelector('em');
      if(i)i.textContent='🧪';
      if(b)b.textContent='File test tổng';
      if(sm)sm.textContent='Nhập thủ công sản phẩm cần test. Không lấy nguồn Bếp Sỉ.';
      if(e)e.textContent='Tạo file test';
    }else{
      c.classList.add('is-hidden');
    }
  });
  document.querySelectorAll('[data-page="ai"]').forEach(el=>{if(el.matches('button'))el.classList.add('is-hidden')});
  const h=document.querySelector('[data-page="data"] h1');
  if(h)h.textContent='Dữ liệu test';
  const w=document.querySelector('.warn');
  if(w)w.textContent='Local DB là cache. Supabase dùng để đồng bộ nhiều thiết bị.';
  const create=document.querySelector('.nav [data-page="create"] span');
  const data=document.querySelector('.nav [data-page="data"] span');
  const admin=document.querySelector('.nav [data-page="admin"] span');
  if(create)create.textContent='Tạo';
  if(data)data.textContent='Dữ liệu';
  if(admin)admin.textContent='Admin';
}

addCss();
window.addEventListener('DOMContentLoaded',focus);
setTimeout(focus,300);
setTimeout(focus,1200);
