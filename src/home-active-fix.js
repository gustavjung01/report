function installHomeActiveFix(){
  const id='home-active-fix-style';
  let style=document.getElementById(id);
  if(!style){
    style=document.createElement('style');
    style.id=id;
    document.head.appendChild(style);
  }
  style.textContent='section.page[data-page="create"]{display:none!important}section.page[data-page="create"].active{display:grid!important;overflow:hidden!important}';
}
installHomeActiveFix();
window.addEventListener('DOMContentLoaded',installHomeActiveFix);
