function mountMcpManageActionsCompactUi() {
  let style = document.querySelector('style[data-mcp-manage-actions-compact]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpManageActionsCompact = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] .mcp-manage-actions{
      display:flex!important;
      flex-wrap:nowrap!important;
      align-items:center!important;
      gap:5px!important;
      width:100%!important;
      margin-top:6px!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions button{
      min-width:0!important;
      min-height:30px!important;
      height:30px!important;
      border-radius:10px!important;
      padding:0 6px!important;
      font-size:11px!important;
      line-height:1!important;
      white-space:nowrap!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-move="up"],
    section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-move="down"]{
      flex:0 0 36px!important;
      width:36px!important;
      padding:0!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-create-report]{
      flex:0 0 46px!important;
      width:46px!important;
      padding:0!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-edit-customer]{
      flex:1 1 auto!important;
      min-width:82px!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-hide-customer]{
      flex:0 0 46px!important;
      width:46px!important;
      padding:0!important;
    }
    @media(max-width:380px){
      section.page[data-page="mcp"] .mcp-manage-actions{gap:4px!important}
      section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-move="up"],
      section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-move="down"]{flex-basis:33px!important;width:33px!important}
      section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-create-report],
      section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-hide-customer]{flex-basis:42px!important;width:42px!important}
      section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-edit-customer]{min-width:72px!important}
    }
  `;
}

mountMcpManageActionsCompactUi();
window.addEventListener('DOMContentLoaded', mountMcpManageActionsCompactUi);
