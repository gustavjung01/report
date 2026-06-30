let deferredInstallPrompt=null;

function isIos(){
  return /iphone|ipad|ipod/i.test(navigator.userAgent||'') || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1);
}
function isStandalone(){
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator.standalone===true;
}
function toast(message){
  const element=document.querySelector('#toast');
  if(!element)return;
  element.textContent=message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>element.classList.remove('show'),2400);
}
function css(){
  if(document.querySelector('style[data-pwa-install-ui]'))return;
  const style=document.createElement('style');
  style.dataset.pwaInstallUi='1';
  style.textContent=`
    section.page[data-page="admin"] #pwaInstallBtn{border-color:#9bdccd!important;color:#007866!important;background:#f4fffb!important;font-weight:900!important}
    #modal[data-type="pwa-install"]{box-sizing:border-box!important;width:min(396px,calc(100vw - 20px))!important;max-width:calc(100vw - 20px)!important;max-height:calc(100dvh - 20px)!important;border:0!important;border-radius:20px!important;padding:0!important;overflow:hidden!important;background:#fff!important;box-shadow:0 24px 70px rgba(8,35,55,.22)!important}
    #modal[data-type="pwa-install"] .modal{box-sizing:border-box!important;width:100%!important;max-height:calc(100dvh - 20px)!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding:16px!important;display:grid!important;gap:13px!important;color:#082337!important}
    #modal[data-type="pwa-install"] header{display:flex!important;align-items:center!important;justify-content:space-between!important;gap:10px!important;position:sticky!important;top:0!important;background:#fff!important;z-index:2!important;padding-bottom:4px!important}
    #modal[data-type="pwa-install"] h2{margin:0!important;font-size:18px!important;line-height:1.2!important;font-weight:950!important;letter-spacing:-.2px!important}
    #modal[data-type="pwa-install"] .close{min-height:34px!important;border:1px solid #dce8e5!important;border-radius:999px!important;background:#fbfffd!important;color:#17343d!important;padding:0 11px!important;font-weight:850!important}
    #modal[data-type="pwa-install"] .install-card{border:1px solid #dce8e5!important;border-radius:16px!important;background:linear-gradient(180deg,#fbfffd,#f4fbf8)!important;padding:12px!important;display:grid!important;gap:8px!important}
    #modal[data-type="pwa-install"] .install-card b{font-size:13px!important;line-height:1.2!important}
    #modal[data-type="pwa-install"] .install-card p{margin:0!important;color:#526873!important;font-size:12.5px!important;line-height:1.42!important}
    #modal[data-type="pwa-install"] .install-actions{display:grid!important;gap:9px!important}
    #modal[data-type="pwa-install"] .install-direct{min-height:44px!important;border:0!important;border-radius:13px!important;background:linear-gradient(135deg,#00957f,#007866)!important;color:#fff!important;font-weight:950!important}
    #modal[data-type="pwa-install"] .install-direct[disabled]{opacity:.48!important;filter:saturate(.5)!important}
    #modal[data-type="pwa-install"] .install-secondary{min-height:40px!important;border:1px solid #dce8e5!important;border-radius:13px!important;background:#fff!important;color:#17343d!important;font-weight:850!important}
    @media(max-width:430px){section.page[data-page="admin"] .admin-actions{grid-template-columns:1fr 1fr!important}section.page[data-page="admin"] #pwaInstallBtn{grid-column:1/-1!important}}
  `;
  document.head.appendChild(style);
}
function ensureAdminButton(){
  if(document.querySelector('#pwaInstallBtn'))return;
  const syncButton=document.querySelector('#syncBtn');
  if(!syncButton)return;
  let wrap=syncButton.closest('.admin-actions');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.className='admin-actions';
    syncButton.parentElement?.insertBefore(wrap,syncButton);
    wrap.appendChild(syncButton);
  }
  const button=document.createElement('button');
  button.id='pwaInstallBtn';
  button.className='secondary tiny-update';
  button.type='button';
  button.textContent='Tải app';
  button.title='Cài Bếp Sỉ Báo Cáo như ứng dụng PWA';
  wrap.appendChild(button);
}
function openInstallModal(){
  const modal=document.querySelector('#modal');
  if(!modal)return;
  const ios=isIos();
  const installed=isStandalone();
  modal.dataset.type='pwa-install';
  modal.innerHTML=`
    <div class="modal">
      <header><h2>Tải app PWA</h2><button class="close" type="button" data-pwa-install-close>Đóng</button></header>
      <section class="install-card"><b>iPhone / iPad</b><p>iPhone không tải trực tiếp trong web. Mở bằng Safari, bấm Chia sẻ, rồi chọn Thêm vào Màn hình chính.</p></section>
      <section class="install-card"><b>Android</b><p>Bấm nút bên dưới để cài trực tiếp nếu trình duyệt hỗ trợ PWA. Nếu nút chưa bật, dùng menu trình duyệt rồi chọn Cài đặt ứng dụng.</p></section>
      <div class="install-actions">
        <button class="install-direct" type="button" data-pwa-install-direct ${installed?'disabled':''}>${installed?'Đã cài app':'Tải trực tiếp trên Android'}</button>
        <button class="install-secondary" type="button" data-pwa-install-close>Để sau</button>
      </div>
    </div>`;
  if(typeof modal.showModal==='function')modal.showModal();else modal.setAttribute('open','');
  if(ios)toast('iPhone: dùng Safari → Chia sẻ → Thêm vào Màn hình chính');
}
async function directInstall(){
  if(isStandalone()){toast('App đã được cài.');return;}
  if(!deferredInstallPrompt){toast('Nếu nút chưa bật, mở menu trình duyệt và chọn Cài đặt ứng dụng.');return;}
  const promptEvent=deferredInstallPrompt;
  deferredInstallPrompt=null;
  promptEvent.prompt();
  try{await promptEvent.userChoice;}catch(error){console.warn('pwa install choice failed',error);}
}
function closeModal(){
  const modal=document.querySelector('#modal');
  if(!modal)return;
  if(typeof modal.close==='function')modal.close();else modal.removeAttribute('open');
  modal.innerHTML='';
  delete modal.dataset.type;
}
window.addEventListener('beforeinstallprompt',(event)=>{
  event.preventDefault();
  deferredInstallPrompt=event;
});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;toast('Đã cài app.');});
document.addEventListener('click',(event)=>{
  if(event.target.closest('#pwaInstallBtn')){event.preventDefault();openInstallModal();return;}
  if(event.target.closest('[data-pwa-install-direct]')){event.preventDefault();directInstall();return;}
  if(event.target.closest('[data-pwa-install-close]')){event.preventDefault();closeModal();}
});
function boot(){css();ensureAdminButton();}
boot();
window.addEventListener('DOMContentLoaded',boot);
