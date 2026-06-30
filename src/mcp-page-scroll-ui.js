function installMcpPageScrollUi(){
  let style=document.querySelector('style[data-mcp-page-scroll-ui]');
  if(!style){
    style=document.createElement('style');
    style.dataset.mcpPageScrollUi='1';
    document.head.appendChild(style);
  }
  style.textContent=`
    section.page[data-page="mcp"]{height:100%!important;min-height:0!important;max-height:100%!important;overflow:hidden!important}
    section.page[data-page="mcp"].active{display:block!important;height:100%!important;min-height:0!important;max-height:100%!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important;padding:0 0 calc(96px + env(safe-area-inset-bottom))!important;scrollbar-gutter:stable!important}
    section.page[data-page="mcp"].active .mcp-route-card{position:relative!important;margin:0 0 7px!important}
    section.page[data-page="mcp"].active .mcp-stats{position:relative!important;margin:0 0 7px!important}
    section.page[data-page="mcp"].active .mcp-list-wrap{display:block!important;min-height:0!important;height:auto!important;overflow:visible!important;margin:0!important;padding:0!important}
    section.page[data-page="mcp"].active .mcp-filters{position:sticky!important;top:0!important;z-index:5!important;margin:0 0 7px!important;padding:0 0 3px!important;background:linear-gradient(180deg,#f5faf8 0%,rgba(245,250,248,.94) 72%,rgba(245,250,248,0) 100%)!important;overflow-x:auto!important;overflow-y:hidden!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-x!important}
    section.page[data-page="mcp"].active .mcp-list{display:grid!important;gap:8px!important;height:auto!important;min-height:0!important;max-height:none!important;overflow:visible!important;padding:0 2px 0 0!important;touch-action:pan-y!important}
    section.page[data-page="mcp"].active .mcp-customer{height:auto!important;min-height:0!important;overflow:hidden!important;touch-action:pan-y!important}
    section.page[data-page="mcp"].active .mcp-customer button,
    section.page[data-page="mcp"].active .mcp-filter,
    section.page[data-page="mcp"].active a{touch-action:manipulation!important}
  `;
}
function refreshMcpPageScroll(){
  installMcpPageScrollUi();
  const page=document.querySelector('section.page[data-page="mcp"]');
  if(!page)return;
  page.style.webkitOverflowScrolling='touch';
}
refreshMcpPageScroll();
window.addEventListener('DOMContentLoaded',refreshMcpPageScroll);
window.addEventListener('mcp:session-changed',()=>setTimeout(refreshMcpPageScroll,0));
document.addEventListener('click',()=>setTimeout(refreshMcpPageScroll,40),true);
