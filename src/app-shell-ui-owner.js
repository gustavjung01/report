export function installAppShellUi() {
  let style = document.querySelector('style[data-app-shell-ui-owner]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.appShellUiOwner = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    html,body{width:100%;max-width:100%;overflow-x:hidden!important}
    .app{width:100%!important;max-width:none!important;margin:0!important;transform:none!important;overflow-x:hidden!important}
    main{width:100%!important;max-width:100%!important;overflow:hidden!important}
    .hero,.tabs{display:none!important}
    section.page[data-page="create"] .home-card,.nav button,.secondary,.primary,.sync-state,.head button,.mini{pointer-events:auto!important;touch-action:manipulation!important}
    section.page[data-page="create"] .home-card *,.nav button *{pointer-events:none!important}
    #dataList .test-actions *, .admin-actions *, #modal *, .mcp-page *, .shell-page *, .data-shell *, .ai-page *{pointer-events:auto!important}
    #modal .test-row{background:linear-gradient(180deg,#f5fffb,#eefbf6)!important;border-color:#bfe9dc!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)!important}
    #modal .test-row>b{color:#087463!important}
    #modal .test-row select{background:#e4f7f0!important;border-color:#9bdccd!important;color:#075f52!important;font-weight:900!important;box-shadow:0 1px 0 rgba(255,255,255,.8)!important}
    #modal .test-row select:focus{outline:2px solid rgba(0,149,127,.16)!important;border-color:#00957f!important}
    #modal .test-row input{background:#fff!important;border-color:#cad7d4!important}
  `;
}
