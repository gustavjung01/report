import './data-hub-force.js';

function markReady(){
  document.body?.classList.remove('booting');
  document.documentElement?.classList.add('ui-ready');
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(markReady,80));
window.addEventListener('load',markReady);
setTimeout(markReady,1200);
