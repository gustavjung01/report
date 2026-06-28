function injectModalCss() {
  if (document.querySelector('style[data-modal-scroll-fix]')) return;

  const style = document.createElement('style');
  style.dataset.modalScrollFix = '1';
  style.textContent = `
    html,body,.app{overflow-x:hidden!important;max-width:100%!important}
    #modal{width:min(420px,calc(100vw - 16px))!important;max-width:calc(100vw - 16px)!important;max-height:calc(100dvh - 16px)!important;overflow:hidden!important;padding:0!important;box-sizing:border-box!important;overscroll-behavior:contain!important;touch-action:pan-y!important}
    #modal::backdrop{touch-action:none;background:rgba(8,35,55,.34)}
    #modal>.modal{width:100%!important;max-width:100%!important;max-height:calc(100dvh - 16px)!important;overflow-y:auto!important;overflow-x:hidden!important;box-sizing:border-box!important;overscroll-behavior:contain!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important}
    #modal>.modal *{max-width:100%;box-sizing:border-box}
    #modal>.modal header{position:sticky!important;top:0!important;z-index:5!important;background:#fff!important;border-bottom:1px solid #edf3f1!important;padding-top:10px!important;padding-bottom:10px!important}
    #modal>.modal header h2{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #modal>.modal .form{min-width:0;max-width:100%;overflow-x:hidden!important}
    #modal>.modal .grid{min-width:0;max-width:100%}
    #modal>.modal input,#modal>.modal select,#modal>.modal textarea{max-width:100%;min-width:0}
    #modal>.modal .line,#modal>.modal .test-row{max-width:100%;min-width:0;overflow-x:hidden!important}
    .compact-modal,.compact-list,.compact-customer,.compact-results{max-width:100%!important;overflow-x:hidden!important;touch-action:pan-y!important}
    .compact-result{max-width:100%!important;min-width:0!important}
  `;
  document.head.appendChild(style);
}

function unlockPageScroll() {
  document.documentElement.style.overflowX = 'hidden';
  document.body.style.overflowX = 'hidden';
  document.documentElement.style.removeProperty('position');
  document.body.style.removeProperty('position');
  document.body.style.removeProperty('height');
  document.body.style.removeProperty('touch-action');
}

function resetModalScroll() {
  const modal = document.querySelector('#modal');
  if (!modal) return;
  modal.scrollTop = 0;
  const child = modal.firstElementChild;
  if (child) child.scrollTop = 0;
}

function boot() {
  injectModalCss();
  const modal = document.querySelector('#modal');
  if (!modal || modal.dataset.scrollFixReady) return;
  modal.dataset.scrollFixReady = '1';

  modal.addEventListener('close', () => {
    resetModalScroll();
    unlockPageScroll();
  });

  modal.addEventListener('cancel', () => {
    resetModalScroll();
    unlockPageScroll();
  });
}

document.addEventListener('submit', (event) => {
  if (!event.target.closest('#modal')) return;
  const active = document.activeElement;
  if (active && typeof active.blur === 'function') active.blur();
  setTimeout(() => {
    resetModalScroll();
    unlockPageScroll();
  }, 120);
}, true);

document.addEventListener('click', (event) => {
  if (!event.target.closest('[data-close]')) return;
  const active = document.activeElement;
  if (active && typeof active.blur === 'function') active.blur();
  setTimeout(() => {
    resetModalScroll();
    unlockPageScroll();
  }, 120);
}, true);

window.addEventListener('DOMContentLoaded', boot);
setTimeout(boot, 300);
setTimeout(boot, 1200);
