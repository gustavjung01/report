function installBottomNavStatusUi(){
  let style=document.querySelector('style[data-bottom-nav-status-ui]');
  if(!style){style=document.createElement('style');style.dataset.bottomNavStatusUi='1';document.head.appendChild(style)}
  style.textContent=`
    #syncState{position:fixed!important;right:14px!important;bottom:calc(72px + env(safe-area-inset-bottom))!important;top:auto!important;z-index:75!important;width:12px!important;height:12px!important;min-width:12px!important;min-height:12px!important;max-width:12px!important;max-height:12px!important;padding:0!important;border:2px solid rgba(255,255,255,.96)!important;border-radius:999px!important;background:#12a150!important;box-shadow:0 0 0 1px rgba(0,0,0,.06),0 6px 14px rgba(12,55,50,.18)!important;overflow:hidden!important;display:block!important;pointer-events:auto!important;color:transparent!important;font-size:0!important;line-height:0!important}
    #syncState b{display:none!important}
    #syncState span{display:block!important;width:100%!important;height:100%!important;margin:0!important;border-radius:inherit!important;background:#12a150!important}
    #syncState.cloud-ok span,#syncState.online span{background:#12a150!important}
    #syncState.cloud-sync span{background:#f59e0b!important}
    #syncState.cloud-error span,#syncState.error span{background:#dc2626!important}
    .nav{height:70px!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;align-items:center!important;gap:6px!important;padding:7px 10px calc(7px + env(safe-area-inset-bottom))!important;background:rgba(255,255,255,.96)!important;box-shadow:0 -8px 24px rgba(12,55,50,.075)!important}
    .nav button{position:relative!important;min-width:0!important;min-height:52px!important;border-radius:15px!important;background:transparent!important;display:grid!important;grid-template-rows:22px 16px!important;place-items:center!important;gap:2px!important;padding:7px 4px 6px!important;font-size:0!important;color:#0f2530!important;line-height:1!important}
    .nav button::before{font-size:19px!important;line-height:1!important;font-weight:900!important;display:block!important;filter:drop-shadow(0 1px 0 rgba(255,255,255,.72))}
    .nav button[data-page="create"]::before{content:"⌂";color:#00957f!important}
    .nav button[data-page="data"]::before{content:"▤";color:#2563eb!important}
    .nav button[data-page="ai"]::before{content:"✺";color:#7c3aed!important}
    .nav button[data-page="admin"]::before{content:"⚙";color:#f59e0b!important}
    .nav button span{display:block!important;font-size:10.5px!important;line-height:1.05!important;font-weight:900!important;color:#102a35!important;letter-spacing:-.15px!important;white-space:nowrap!important}
    .nav button.active{background:linear-gradient(180deg,#e7fbf5,#dcf4ef)!important;box-shadow:inset 0 0 0 1px rgba(0,149,127,.08)!important;color:#007866!important}
    .nav button.active span{color:#007866!important}
    .nav button.active::after{content:"";position:absolute;left:50%;bottom:4px;width:18px;height:2px;border-radius:999px;background:#00a68d;transform:translateX(-50%);opacity:.75}
  `;
}
installBottomNavStatusUi();
window.addEventListener('DOMContentLoaded',installBottomNavStatusUi);
