function installHomeUi(){
  let style=document.querySelector('style[data-home-ui-owner]');
  if(!style){
    style=document.createElement('style');
    style.dataset.homeUiOwner='1';
    document.head.appendChild(style);
  }
  style.textContent=`
    .top{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:60!important;height:0!important;min-height:0!important;padding:0 14px!important;background:transparent!important;border:0!important;box-shadow:none!important;display:block!important;pointer-events:none!important}
    .top .brand{display:none!important}
    #syncState{position:fixed!important;top:12px!important;right:14px!important;z-index:70!important;min-height:32px!important;border:1px solid rgba(220,232,229,.92)!important;border-radius:999px!important;background:rgba(255,255,255,.92)!important;box-shadow:0 10px 24px rgba(12,55,50,.08)!important;padding:0 12px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;font-size:12px!important;font-weight:950!important;color:#082337!important;backdrop-filter:blur(10px);pointer-events:auto!important;white-space:nowrap!important}
    #syncState span{width:8px!important;height:8px!important;margin:0!important;flex:0 0 auto!important}
    #syncState.cloud-ok span,#syncState.online span{background:#12a150!important}
    #syncState.cloud-sync span{background:#f59e0b!important;box-shadow:0 0 0 3px rgba(245,158,11,.14)!important}
    #syncState.cloud-error span,#syncState.error span{background:#dc2626!important}
    main{height:100dvh!important;padding:54px 12px 86px!important}
    section.page[data-page="create"]{position:relative!important;overflow:hidden!important;isolation:isolate!important;background:linear-gradient(180deg,#fbfffd 0%,#f4fbf8 48%,#eff8f4 100%)!important}
    section.page[data-page="create"]::before{content:"";position:absolute;left:5%;right:5%;bottom:92px;height:38%;z-index:-1;pointer-events:none;opacity:.62;background:radial-gradient(circle at 18% 22%,rgba(0,149,127,.13) 0 7px,transparent 8px),radial-gradient(circle at 74% 28%,rgba(0,120,102,.11) 0 9px,transparent 10px),radial-gradient(circle at 44% 72%,rgba(245,158,11,.12) 0 8px,transparent 9px),linear-gradient(135deg,transparent 0 18%,rgba(0,149,127,.12) 18.5% 20%,transparent 20.5% 42%,rgba(0,149,127,.10) 42.5% 44%,transparent 44.5%),linear-gradient(24deg,transparent 0 32%,rgba(99,114,124,.10) 32.5% 34%,transparent 34.5% 70%,rgba(0,149,127,.08) 70.5% 72%,transparent 72.5%);border-radius:28px;filter:blur(.1px)}
    section.page[data-page="create"]::after{content:"";position:absolute;right:10%;bottom:128px;width:150px;height:118px;z-index:-1;pointer-events:none;opacity:.32;background:linear-gradient(180deg,rgba(255,255,255,.96),rgba(230,248,243,.72));border:1px solid rgba(0,149,127,.16);border-radius:24px;box-shadow:-110px 56px 0 -44px rgba(255,248,239,.9),-62px 22px 0 -38px rgba(250,247,255,.9)}
    section.page[data-page="create"] .grid-actions{position:relative!important;z-index:1!important;margin-bottom:0!important}
    section.page[data-page="create"] .panel{display:none!important}
  `;
}
installHomeUi();
window.addEventListener('DOMContentLoaded',installHomeUi);
