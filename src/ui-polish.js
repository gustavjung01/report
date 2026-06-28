import './test-pull.js';
import './compact-detail.js';
import './app-update.js';

const svg = {
  testHero: `<svg viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="g1" x1="8" y1="8" x2="56" y2="56"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#d9fbf2"/></linearGradient><linearGradient id="g2" x1="20" y1="29" x2="41" y2="56"><stop stop-color="#7be36f"/><stop offset="1" stop-color="#00957f"/></linearGradient></defs><rect x="4" y="4" width="56" height="56" rx="18" fill="url(#g1)"/><path d="M24 12h15v6h-3v16.2l8.2 13.4c2.5 4.1-.4 9.4-5.2 9.4H18.8c-4.8 0-7.7-5.3-5.2-9.4L22 34.2V18h-3v-6h5z" fill="#fff" stroke="#6d8490" stroke-width="2"/><path d="M20 41c5.8 1.7 11-2.2 17 .2l5 8.1c1.1 1.8-.2 4.2-2.3 4.2H18.1c-2.1 0-3.4-2.4-2.3-4.2L20 41z" fill="url(#g2)"/><circle cx="26" cy="36" r="2.2" fill="#b9f0cf"/><circle cx="34" cy="46" r="2" fill="#defde9"/><rect x="38" y="15" width="15" height="25" rx="4" fill="#fff" stroke="#7e939c" stroke-width="2"/><path d="M42 22h7M42 28h7M42 34h7" stroke="#00a58d" stroke-width="2" stroke-linecap="round"/><path d="M45 52c5-9 12-9 15-9-1.5 7.5-7.6 11.2-15 9z" fill="#59bd6e"/></svg>`,
  tube: `<svg viewBox="0 0 48 48" aria-hidden="true"><defs><linearGradient id="tubeG" x1="10" y1="12" x2="38" y2="40"><stop stop-color="#ffffff"/><stop offset="1" stop-color="#dff9f1"/></linearGradient></defs><rect x="3" y="3" width="42" height="42" rx="13" fill="url(#tubeG)"/><path d="M14 10h6M28 10h6" stroke="#788b96" stroke-width="2.3" stroke-linecap="round"/><path d="M16 12v19.5c0 3.2-4 3.2-4 0V12M30 12v19.5c0 3.2-4 3.2-4 0V12" fill="none" stroke="#6e828d" stroke-width="2" stroke-linecap="round"/><path d="M13 25h6v7a3 3 0 0 1-6 0v-7zM27 23h6v9a3 3 0 0 1-6 0v-9z" fill="#00a58d" opacity=".9"/><path d="M9 36h30" stroke="#5f7078" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  docPlus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6V3z" fill="rgba(255,255,255,.95)"/><path d="M14 3v5h5" fill="none" stroke="#00957f" stroke-width="1.6"/><path d="M12 11v6M9 14h6" stroke="#00957f" stroke-width="2.2" stroke-linecap="round"/></svg>`,
  navCreate: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="currentColor" opacity=".95"/><path d="M12 7v10M7 12h10" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`,
  navList: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="4" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 9h8M8 13h8M8 17h5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  navAdmin: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M20 12a8.1 8.1 0 0 0-.1-1.2l2-1.5-2-3.5-2.4 1a8.8 8.8 0 0 0-2.1-1.2L15 3h-4l-.4 2.6a8.8 8.8 0 0 0-2.1 1.2l-2.4-1-2 3.5 2 1.5A8.1 8.1 0 0 0 6 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.5 2.4-1a8.8 8.8 0 0 0 2.1 1.2L11 21h4l.4-2.6a8.8 8.8 0 0 0 2.1-1.2l2.4 1 2-3.5-2-1.5c.1-.4.1-.8.1-1.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`
};

function addCss(){
  if(!document.querySelector('link[data-ui-polish]')){const l=document.createElement('link');l.rel='stylesheet';l.href='src/polish.css';l.dataset.uiPolish='1';document.head.appendChild(l)}
  let s=document.querySelector('style[data-test-fixes]');
  if(!s){s=document.createElement('style');s.dataset.testFixes='1';document.head.appendChild(s)}
  s.textContent='.hero{display:none!important}.tabs{display:none!important}.result-line{display:inline-flex!important;width:auto!important;align-items:center!important;gap:4px!important;margin:4px 4px 0 0!important;padding:3px 7px!important;border:1px solid #dce8e5!important;border-radius:999px!important;background:#fbfffd!important}.result-line div{display:contents!important}.result-line span{font-size:11px!important;font-weight:650!important}.result-line b{font-size:11px!important;color:#007866!important;white-space:nowrap!important}.result-line small{display:inline!important;font-size:10px!important;margin-left:2px!important}.modal .line{padding:8px 10px!important;gap:2px!important}.modal .line>b{font-size:14px!important}.modal .line>small{font-size:11px!important}.modal .total{display:none!important}';
}

function setNavButton(selector, icon, label){
  const button=document.querySelector(selector);
  if(!button || button.dataset.polishedNav)return;
  button.dataset.polishedNav='1';
  button.innerHTML=icon+'<span>'+label+'</span>';
}

function polishNav(){
  setNavButton('.nav [data-page="create"]', svg.navCreate, 'Tạo file test');
  setNavButton('.nav [data-page="data"]', svg.navList, 'File test');
  setNavButton('.nav [data-page="admin"]', svg.navAdmin, 'Cài đặt');
}

function polishTestCard(card){
  if(!card || card.dataset.polishedCard)return;
  card.dataset.polishedCard='1';
  card.classList.add('test-file-card');
  const icon=card.querySelector('i');
  const action=card.querySelector('em');
  if(icon)icon.innerHTML=svg.testHero;
  if(action)action.innerHTML=svg.docPlus+'Tạo file test';
}

function polishRecent(){
  document.querySelectorAll('#recent .mini').forEach(item=>{
    item.classList.add('test-mini');
    const b=item.querySelector('b');
    if(b)b.textContent=(b.textContent||'').replace(/^\s*🍵\s*/,'').trim();
    const box=item.querySelector('div');
    if(box && !item.querySelector('.mini-icon')){
      const icon=document.createElement('span');
      icon.className='mini-icon';
      icon.innerHTML=svg.tube;
      item.insertBefore(icon, box);
    }
  });
}

function focus(){
  document.querySelectorAll('.card').forEach(c=>{const t=c.textContent||'';if(t.includes('File test')||t.includes('Test sản phẩm')){c.removeAttribute('data-open');c.setAttribute('data-open-test','');let b=c.querySelector('b'),sm=c.querySelector('small'),e=c.querySelector('em');if(b)b.textContent='File test tổng';if(sm)sm.textContent='Nhập thủ công sản phẩm cần test. Không lấy nguồn Bếp Sỉ.';if(e)e.textContent='Tạo file test';polishTestCard(c)}else c.classList.add('is-hidden')});
  document.querySelectorAll('[data-page="ai"]').forEach(el=>{if(el.matches('button'))el.classList.add('is-hidden')});
  let h=document.querySelector('[data-page="data"] h1');if(h)h.textContent='Dữ liệu test';let w=document.querySelector('.warn');if(w)w.textContent='Local DB là cache. Supabase dùng để đồng bộ nhiều thiết bị.';
  polishNav();
  polishRecent();
}

function watchRecent(){
  const recent=document.querySelector('#recent');
  if(!recent || recent.dataset.watchRecent)return;
  recent.dataset.watchRecent='1';
  new MutationObserver(polishRecent).observe(recent,{childList:true,subtree:true});
}

addCss();
window.addEventListener('DOMContentLoaded',()=>{focus();watchRecent()});
setTimeout(()=>{focus();watchRecent()},300);
setTimeout(()=>{focus();watchRecent()},1200);
