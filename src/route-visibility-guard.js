function installRouteVisibilityGuard(){
  let style=document.querySelector('style[data-route-visibility-guard]');
  if(!style){
    style=document.createElement('style');
    style.dataset.routeVisibilityGuard='1';
    document.head.appendChild(style);
  }
  style.textContent=`
    section.page:not(.active){display:none!important;pointer-events:none!important;visibility:hidden!important}
    section.page.active{visibility:visible!important;pointer-events:auto!important}
    section.page[data-page="create"].active{display:grid!important;overflow:hidden!important}
    section.page.active:not([data-page="create"]){display:block!important;overflow:auto!important;-webkit-overflow-scrolling:touch!important}
    nav.nav,nav.nav button{pointer-events:auto!important;touch-action:manipulation!important}
  `;
}

function ensureSingleActivePage(){
  const pages=[...document.querySelectorAll('section.page')];
  const active=pages.filter((page)=>page.classList.contains('active'));
  if(active.length<=1)return;
  const keep=active.find((page)=>page.dataset.page!=='create')||active[0];
  pages.forEach((page)=>page.classList.toggle('active',page===keep));
}

installRouteVisibilityGuard();
ensureSingleActivePage();
window.addEventListener('DOMContentLoaded',()=>{installRouteVisibilityGuard();ensureSingleActivePage();});
document.addEventListener('click',()=>setTimeout(()=>{installRouteVisibilityGuard();ensureSingleActivePage();},0),true);
