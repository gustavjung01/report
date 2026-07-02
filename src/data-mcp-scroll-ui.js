function installDataMcpScrollUi(){
  let style=document.querySelector('style[data-mcp-data-scroll-ui]');
  if(!style){
    style=document.createElement('style');
    style.dataset.mcpDataScrollUi='1';
    document.head.appendChild(style);
  }
  style.textContent=`
    section.page[data-page="data"]{display:none!important;min-height:0!important;overflow:hidden!important}
    section.page[data-page="data"].active{display:flex!important;flex-direction:column!important;height:calc(100dvh - 98px)!important;max-height:calc(100dvh - 98px)!important;min-height:0!important;overflow:hidden!important;gap:8px!important;padding:0!important}
    section.page[data-page="data"]>h1{display:none!important}
    section.page[data-page="data"] #dataHub{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow:hidden!important;display:flex!important;flex-direction:column!important;gap:8px!important;margin:0!important}
    section.page[data-page="data"] #dataHub .data-hub-tabs{flex:0 0 auto!important;margin:0!important;display:grid!important;visibility:visible!important}
    section.page[data-page="data"] #dataShell{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow:hidden!important;display:none!important}
    section.page[data-page="data"] #dataShell.active{display:flex!important;flex-direction:column!important;flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;gap:8px!important;overflow:hidden!important}
    section.page[data-page="data"] #dataShell .data-shell-kpis{flex:0 0 auto!important;margin:0!important}
    section.page[data-page="data"] #dataShell .data-shell-open-card{flex:0 0 auto!important;margin:0!important}
    section.page[data-page="data"] #dataShell .data-shell-list{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;padding:2px 4px 18px 2px!important;touch-action:pan-y!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .data-shell-list{display:block!important;padding:2px 4px 18px 2px!important;scrollbar-gutter:stable!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card{box-sizing:border-box!important;height:auto!important;min-height:0!important;margin:0 0 10px!important;padding:10px!important;border-radius:16px!important;overflow:visible!important;background:#fff!important;border:1px solid #dce8e5!important;box-shadow:0 6px 14px rgba(12,55,50,.045)!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card .shell-card-head{min-width:0!important;align-items:start!important;gap:8px!important;overflow:visible!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card .shell-card-head>div{min-width:0!important;overflow:hidden!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card h3,section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card small{max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card .shell-badge{font-size:9.5px!important;padding:4px 6px!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card .shell-actions{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin-top:9px!important;overflow:visible!important}
    section.page[data-page="data"] #dataShell.data-shell-mcp-scroll .mcp-session-card .shell-actions button{box-sizing:border-box!important;width:100%!important;min-width:0!important;min-height:36px!important;height:36px!important;border-radius:10px!important;font-size:10.5px!important;line-height:1!important;overflow:hidden!important;text-overflow:ellipsis!important;white-space:nowrap!important;padding:0 4px!important}
    section.page[data-page="data"] .data-list-wrap{flex:1 1 auto!important;min-height:0!important;height:auto!important;max-height:none!important;overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;padding-bottom:18px!important;touch-action:pan-y!important}
    section.page[data-page="data"].mcp-fullscreen-data .data-list-wrap{display:none!important}
  `;
}
function markMcpShell(){
  const page=document.querySelector('section.page[data-page="data"]');
  const shell=document.querySelector('section.page[data-page="data"] #dataShell');
  const activeTab=document.querySelector('#dataHub [data-data-view].active')?.dataset?.dataView||'';
  if(!shell||!page)return;
  const isMcp=activeTab==='mcp'||!!shell.querySelector('.mcp-session-card,[data-mcp-open-session],.data-shell-open-card [data-mcp-start]');
  shell.classList.toggle('data-shell-mcp-scroll',isMcp);
  page.classList.toggle('mcp-fullscreen-data',isMcp&&shell.classList.contains('active'));
}
function boot(){
  installDataMcpScrollUi();
  markMcpShell();
  const shell=document.querySelector('section.page[data-page="data"] #dataShell');
  if(shell&&!shell.dataset.mcpScrollWatch){
    shell.dataset.mcpScrollWatch='1';
    new MutationObserver(markMcpShell).observe(shell,{childList:true,subtree:true,attributes:true,attributeFilter:['class']});
  }
}
boot();
window.addEventListener('DOMContentLoaded',boot);
document.addEventListener('click',()=>setTimeout(boot,80),true);
window.addEventListener('mcp:session-changed',()=>setTimeout(boot,80));