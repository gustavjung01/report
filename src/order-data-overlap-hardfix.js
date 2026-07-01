// UI-only hard guard for Data -> Đơn layout.
// Keeps the order filter/export/list in normal document flow to prevent overlap on mobile.

let timer = null;

function installStyle() {
  let style = document.querySelector('style[data-order-data-overlap-hardfix]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.orderDataOverlapHardfix = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="data"] #dataShell.order-shell-active{
      display:flex!important;
      flex-direction:column!important;
      align-items:stretch!important;
      gap:8px!important;
      min-height:0!important;
      height:auto!important;
      max-height:calc(100dvh - 166px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      -webkit-overflow-scrolling:touch!important;
      overscroll-behavior:contain!important;
      padding:0 2px calc(92px + env(safe-area-inset-bottom)) 0!important;
      position:relative!important;
      isolation:isolate!important;
    }
    section.page[data-page="data"] #dataShell.order-shell-active > *,
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-kpis,
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-note,
    section.page[data-page="data"] #dataShell.order-shell-active .order-export-row,
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-card,
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-list,
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-card{
      position:relative!important;
      top:auto!important;
      left:auto!important;
      right:auto!important;
      bottom:auto!important;
      z-index:auto!important;
      float:none!important;
      clear:both!important;
      transform:none!important;
      margin-left:0!important;
      margin-right:0!important;
      box-sizing:border-box!important;
      max-width:100%!important;
    }
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-kpis{order:1!important;display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;flex:0 0 auto!important}
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-note{order:2!important;margin:0!important;flex:0 0 auto!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-export-row{order:3!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin:0!important;flex:0 0 auto!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-card{order:4!important;display:block!important;width:100%!important;margin:0!important;padding:10px!important;overflow:visible!important;flex:0 0 auto!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;align-items:start!important;position:relative!important;z-index:auto!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-grid label{display:grid!important;gap:4px!important;min-width:0!important;margin:0!important;grid-column:auto!important;position:relative!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-grid label:nth-child(3){grid-column:1/-1!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-grid input,
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-grid select{display:block!important;width:100%!important;min-width:0!important;min-height:38px!important;box-sizing:border-box!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;margin-top:8px!important;position:relative!important}
    section.page[data-page="data"] #dataShell.order-shell-active .order-filter-summary{display:block!important;margin-top:8px!important;position:relative!important}
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-list{order:5!important;display:flex!important;flex-direction:column!important;gap:8px!important;margin:0!important;padding:0!important;overflow:visible!important;flex:0 0 auto!important}
    section.page[data-page="data"] #dataShell.order-shell-active .data-shell-list > .data-shell-card{display:block!important;width:100%!important;margin:0!important;flex:0 0 auto!important}
    @media(max-width:430px){
      section.page[data-page="data"] #dataShell.order-shell-active .order-filter-grid{grid-template-columns:1fr!important;gap:7px!important}
      section.page[data-page="data"] #dataShell.order-shell-active .order-filter-grid label{grid-column:1/-1!important}
    }
  `;
}

function markOrderShell() {
  installStyle();
  const shell = document.querySelector('section.page[data-page="data"] #dataShell');
  const orderTab = document.querySelector('section.page[data-page="data"] #dataHub [data-data-view="order"].active');
  const isOrder = Boolean(shell && orderTab && shell.querySelector('[data-order-filter-form]'));
  shell?.classList.toggle('order-shell-active', isOrder);
}

function schedule(delay = 80) {
  clearTimeout(timer);
  timer = setTimeout(markOrderShell, delay);
}

installStyle();
window.addEventListener('DOMContentLoaded', () => schedule(0));
window.addEventListener('order:changed', () => schedule(120));
document.addEventListener('click', () => schedule(120), true);
document.addEventListener('submit', () => schedule(120), true);
setInterval(() => schedule(0), 1200);
schedule(0);
