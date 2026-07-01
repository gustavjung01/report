// UI-only: keep the MCP route admin entry out of the 4-button toolbar row.
// The admin action remains available inside the existing "Chọn" filter panel.

const PAGE_SELECTOR = 'section.page[data-page="mcp"]';
const PANEL_SELECTOR = '#mcpMoreFilterPanel .mcp-more-panel-inner';
let timer = null;

function installStyle() {
  let style = document.querySelector('style[data-mcp-toolbar-admin-slot-fix]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpToolbarAdminSlotFix = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar{
      grid-template-columns:minmax(0,1fr) minmax(0,.9fr) minmax(0,.76fr) minmax(0,.76fr)!important;
    }
    ${PAGE_SELECTOR}.active .mcp-filters.mcp-detail-toolbar > [data-mcp-route-admin]{display:none!important}
    ${PAGE_SELECTOR}.active #mcpMoreFilterPanel [data-mcp-route-admin]{
      display:inline-grid!important;
      place-items:center!important;
      width:100%!important;
      min-width:0!important;
      min-height:34px!important;
      padding:0 6px!important;
      border-radius:12px!important;
      font-size:11px!important;
      font-weight:900!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
  `;
}

function moveAdminButton() {
  installStyle();
  const page = document.querySelector(`${PAGE_SELECTOR}.active`);
  if (!page) return;
  const panelInner = page.querySelector(PANEL_SELECTOR);
  const button = page.querySelector('[data-mcp-route-admin]');
  if (!button || !panelInner) return;
  if (button.textContent.trim() !== 'Quản trị') button.textContent = 'Quản trị';
  if (button.parentElement !== panelInner) panelInner.appendChild(button);
}

function schedule(delay = 80) {
  clearTimeout(timer);
  timer = setTimeout(moveAdminButton, delay);
}

installStyle();
window.addEventListener('DOMContentLoaded', () => schedule(0));
window.addEventListener('mcp:session-changed', () => schedule(140));
document.addEventListener('click', () => schedule(140), true);
setInterval(() => schedule(0), 1800);
schedule(0);
