// Final UI-only guard for Data -> Đơn.
// Audit note: previous patches relied on a JS-added class after render. This file also uses :has()
// so the layout applies immediately when the Order tab is active, before any delayed enhancer runs.

const ORDER_SCOPE = 'section.page[data-page="data"] #dataHub:has([data-data-view="order"].active)';
let timer = null;

function installStyle() {
  let style = document.querySelector('style[data-order-data-layout-final]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderDataLayoutFinal = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="data"].active{
      overflow:hidden!important;
    }
    ${ORDER_SCOPE}{
      display:flex!important;
      flex-direction:column!important;
      height:100%!important;
      min-height:0!important;
      overflow:hidden!important;
      margin:0!important;
      position:relative!important;
    }
    ${ORDER_SCOPE} .data-hub-tabs{
      flex:0 0 auto!important;
      display:grid!important;
      grid-template-columns:repeat(5,minmax(0,1fr))!important;
      gap:6px!important;
      margin:0 0 8px!important;
      position:relative!important;
      z-index:2!important;
    }
    ${ORDER_SCOPE} #dataShell{
      flex:1 1 auto!important;
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      gap:8px!important;
      min-height:0!important;
      height:auto!important;
      max-height:none!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      -webkit-overflow-scrolling:touch!important;
      overscroll-behavior:contain!important;
      padding:0 2px calc(96px + env(safe-area-inset-bottom)) 0!important;
      position:relative!important;
      isolation:isolate!important;
    }
    ${ORDER_SCOPE} #dataShell > *,
    ${ORDER_SCOPE} #dataShell .data-shell-kpis,
    ${ORDER_SCOPE} #dataShell .data-shell-kpi,
    ${ORDER_SCOPE} #dataShell .data-shell-note,
    ${ORDER_SCOPE} #dataShell .order-export-row,
    ${ORDER_SCOPE} #dataShell .order-filter-card,
    ${ORDER_SCOPE} #dataShell .data-shell-list,
    ${ORDER_SCOPE} #dataShell .data-shell-card{
      position:static!important;
      top:auto!important;
      left:auto!important;
      right:auto!important;
      bottom:auto!important;
      z-index:auto!important;
      float:none!important;
      clear:both!important;
      transform:none!important;
      box-sizing:border-box!important;
      width:100%!important;
      max-width:100%!important;
    }
    ${ORDER_SCOPE} #dataShell .data-shell-kpis{
      order:1!important;
      display:grid!important;
      grid-template-columns:repeat(3,minmax(0,1fr))!important;
      gap:6px!important;
      flex:0 0 auto!important;
      width:100%!important;
    }
    ${ORDER_SCOPE} #dataShell .data-shell-note{
      order:2!important;
      margin:0!important;
      flex:0 0 auto!important;
    }
    ${ORDER_SCOPE} #dataShell .order-export-row{
      order:3!important;
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      margin:0!important;
      flex:0 0 auto!important;
    }
    ${ORDER_SCOPE} #dataShell .order-export-row button{
      min-height:34px!important;
      border-radius:12px!important;
      font-size:11px!important;
      font-weight:900!important;
      width:100%!important;
    }
    ${ORDER_SCOPE} #dataShell .order-filter-card{
      order:4!important;
      display:block!important;
      margin:0!important;
      padding:10px!important;
      overflow:visible!important;
      flex:0 0 auto!important;
      background:#fff!important;
      border:1px solid #dce8e5!important;
      border-radius:14px!important;
    }
    ${ORDER_SCOPE} #dataShell .order-filter-grid{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      align-items:start!important;
      position:static!important;
      z-index:auto!important;
      width:100%!important;
    }
    ${ORDER_SCOPE} #dataShell .order-filter-grid label{
      display:grid!important;
      gap:4px!important;
      min-width:0!important;
      margin:0!important;
      grid-column:auto!important;
      position:static!important;
      float:none!important;
      clear:none!important;
    }
    ${ORDER_SCOPE} #dataShell .order-filter-grid label:nth-child(3){grid-column:1/-1!important}
    ${ORDER_SCOPE} #dataShell .order-filter-grid input,
    ${ORDER_SCOPE} #dataShell .order-filter-grid select{
      display:block!important;
      width:100%!important;
      min-width:0!important;
      min-height:38px!important;
      box-sizing:border-box!important;
      position:static!important;
    }
    ${ORDER_SCOPE} #dataShell .order-filter-actions{
      display:grid!important;
      grid-template-columns:1fr 1fr!important;
      gap:8px!important;
      margin-top:8px!important;
      position:static!important;
      width:100%!important;
    }
    ${ORDER_SCOPE} #dataShell .order-filter-summary{
      display:block!important;
      margin-top:8px!important;
      position:static!important;
    }
    ${ORDER_SCOPE} #dataShell .data-shell-list{
      order:5!important;
      display:flex!important;
      flex-direction:column!important;
      gap:8px!important;
      margin:0!important;
      padding:0!important;
      overflow:visible!important;
      flex:0 0 auto!important;
    }
    ${ORDER_SCOPE} #dataShell .data-shell-list > .data-shell-card{
      display:block!important;
      margin:0!important;
      flex:0 0 auto!important;
    }
    section.page[data-page="data"] #dataHub:has([data-data-view="order"].active) + .data-list-wrap,
    section.page[data-page="data"] #dataHub:has([data-data-view="order"].active) ~ .data-list-wrap{
      display:none!important;
    }
    @media(max-width:430px){
      ${ORDER_SCOPE} #dataShell .order-filter-grid{grid-template-columns:1fr!important;gap:7px!important}
      ${ORDER_SCOPE} #dataShell .order-filter-grid label{grid-column:1/-1!important}
    }
  `;
}

function markOrderShell() {
  installStyle();
  const shell = document.querySelector('section.page[data-page="data"] #dataShell');
  const orderTab = document.querySelector('section.page[data-page="data"] #dataHub [data-data-view="order"].active');
  shell?.classList.toggle('order-shell-active', Boolean(orderTab));
}

function schedule(delay = 40) {
  clearTimeout(timer);
  timer = setTimeout(markOrderShell, delay);
}

installStyle();
window.addEventListener('DOMContentLoaded', () => schedule(0));
window.addEventListener('order:changed', () => schedule(80));
document.addEventListener('click', () => schedule(80), true);
document.addEventListener('submit', () => schedule(80), true);
new MutationObserver(() => schedule(40)).observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class'] });
schedule(0);
