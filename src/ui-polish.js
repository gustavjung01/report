import './test-pull.js';
import './compact-detail.js';
import './app-update.js';
function addCss(){
  if(!document.querySelector('link[data-ui-polish]')){const l=document.createElement('link');l.rel='stylesheet';l.href='src/polish.css';l.dataset.uiPolish='1';document.head.appendChild(l)}
  let s=document.querySelector('style[data-test-fixes]');
  if(!s){s=document.createElement('style');s.dataset.testFixes='1';document.head.appendChild(s)}
  s.textContent='.hero{display:none!important}.tabs{display:none!important}.result-line{display:inline-flex!important;width:auto!important;align-items:center!important;gap:4px!important;margin:4px 4px 0 0!important;padding:3px 7px!important;border:1px solid #dce8e5!important;border-radius:999px!important;background:#fbfffd!important}.result-line div{display:contents!important}.result-line span{font-size:11px!important;font-weight:650!important}.result-line b{font-size:11px!important;color:#007866!important;white-space:nowrap!important}.result-line small{display:inline!important;font-size:10px!important;margin-left:2px!important}.modal .line{padding:8px 10px!important;gap:2px!important}.modal .line>b{font-size:14px!important}.modal .line>small{font-size:11px!important}.modal .total{display:none!important}';
}
function focus(){
  document.querySelectorAll('.card').forEach(c=>{const t=c.textContent||'';if(t.includes('File test')||t.includes('Test sản phẩm')){c.removeAttribute('data-open');c.setAttribute('data-open-test','');let b=c.querySelector('b'),sm=c.querySelector('small'),e=c.querySelector('em');if(b)b.textContent='File test tổng';if(sm)sm.textContent='Nhập thủ công sản phẩm cần test. Không lấy nguồn Bếp Sỉ.';if(e)e.textContent='Tạo file test'}else c.classList.add('is-hidden')});
  document.querySelectorAll('[data-page="ai"]').forEach(el=>{if(el.matches('button'))el.classList.add('is-hidden')});
  let h=document.querySelector('[data-page="data"] h1');if(h)h.textContent='Dữ liệu test';let w=document.querySelector('.warn');if(w)w.textContent='Local DB là cache. Supabase dùng để đồng bộ nhiều thiết bị.';
}
addCss();window.addEventListener('DOMContentLoaded',focus);setTimeout(focus,300);
