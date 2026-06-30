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
    section.page[data-page="create"]{position:relative!important;overflow:hidden!important;isolation:isolate!important;background:linear-gradient(180deg,#fbfffd 0%,#f4fbf8 46%,#eff8f4 100%)!important}
    section.page[data-page="create"]::before{content:"";position:absolute;left:0;right:0;bottom:72px;height:48%;z-index:-1;pointer-events:none;opacity:.52;background-image:linear-gradient(180deg,rgba(245,250,248,0) 0%,rgba(245,250,248,.18) 14%,rgba(245,250,248,.62) 82%,rgba(245,250,248,.86) 100%),url("../wallpaper-home.png");background-repeat:no-repeat;background-position:center bottom;background-size:min(96vw,430px) auto;filter:saturate(.92);}
    section.page[data-page="create"]::after{content:"";position:absolute;left:0;right:0;bottom:72px;height:44%;z-index:-1;pointer-events:none;background:linear-gradient(180deg,rgba(245,250,248,.86) 0%,rgba(245,250,248,.18) 22%,rgba(245,250,248,0) 54%)}
    section.page[data-page="create"] .grid-actions{position:relative!important;z-index:1!important;margin-bottom:0!important}
    section.page[data-page="create"] .panel{display:none!important}
  `;
}
installHomeUi();
window.addEventListener('DOMContentLoaded',installHomeUi);
