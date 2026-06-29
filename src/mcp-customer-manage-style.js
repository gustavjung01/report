setTimeout(() => import('./mcp-order-actions.js?v=mcp-order-safe-1').catch(() => {}), 0);

function mountMcpCustomerManageStyle() {
  let style = document.querySelector('style[data-mcp-customer-manage]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpCustomerManage = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] .mcp-manage-actions{
      display:grid!important;
      grid-template-columns:42px 42px minmax(0,1fr) minmax(0,1fr)!important;
      gap:6px!important;
      margin-top:6px!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions button{
      border:1px solid #dce8e5!important;
      background:#fff!important;
      border-radius:10px!important;
      min-height:32px!important;
      font-size:11px!important;
      font-weight:900!important;
      color:#425863!important;
      padding:0 4px!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-edit-customer]{
      border-color:#9bdccd!important;
      background:#eefbf6!important;
      color:#007866!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions [data-mcp-hide-customer]{
      border-color:#ffd3cc!important;
      background:#fff5f2!important;
      color:#b83224!important;
    }
  `;
}

mountMcpCustomerManageStyle();
window.addEventListener('DOMContentLoaded', mountMcpCustomerManageStyle);
