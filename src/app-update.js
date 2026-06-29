const UPDATE_BUTTON_ID = 'appUpdateBtn';

function toast(message) {
  const element = document.querySelector('#toast');
  if (!element) return;
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2400);
}

function injectUpdateButton() {
  if (document.querySelector(`#${UPDATE_BUTTON_ID}`)) return;

  const syncButton = document.querySelector('#syncBtn');
  if (!syncButton || !syncButton.parentElement) return;

  const wrap = document.createElement('div');
  wrap.className = 'admin-actions';
  syncButton.parentElement.insertBefore(wrap, syncButton);
  wrap.appendChild(syncButton);

  const updateButton = document.createElement('button');
  updateButton.id = UPDATE_BUTTON_ID;
  updateButton.className = 'secondary tiny-update';
  updateButton.type = 'button';
  updateButton.textContent = 'Update';
  updateButton.title = 'Tải lại bản PWA mới nhất, không xóa dữ liệu local';
  wrap.appendChild(updateButton);
}

function injectCss() {
  if (document.querySelector('style[data-app-update]')) return;

  const style = document.createElement('style');
  style.dataset.appUpdate = '1';
  style.textContent = `
    [data-page="admin"]{overflow-y:auto!important;overflow-x:hidden!important;-webkit-overflow-scrolling:touch!important;padding-bottom:12px!important}
    [data-page="admin"] .admin{display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:10px!important;align-items:center!important;max-width:100%!important;overflow:hidden!important}
    [data-page="admin"] .admin>div{min-width:0!important;overflow:hidden!important}
    [data-page="admin"] .admin small{display:block!important;max-width:100%!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .admin-actions{display:grid!important;grid-template-columns:1fr!important;gap:7px!important;align-self:center!important;justify-items:stretch!important;max-width:128px!important;width:128px!important;min-width:0!important;overflow:hidden!important}
    .admin-actions .secondary{width:100%!important;max-width:100%!important;min-width:0!important;min-height:34px!important;padding:0 9px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    .tiny-update{font-size:12px!important;border-color:#cad7d4!important;color:#63727c!important;background:#fbfffd!important}
    @media(max-width:430px){
      [data-page="admin"] .admin{grid-template-columns:1fr!important;align-items:stretch!important}
      .admin-actions{grid-template-columns:1fr 1fr!important;width:100%!important;max-width:100%!important;justify-self:stretch!important}
      .admin-actions .secondary{min-height:38px!important}
    }
  `;
  document.head.appendChild(style);
}

async function forceUpdate() {
  const button = document.querySelector(`#${UPDATE_BUTTON_ID}`);
  if (button) {
    button.disabled = true;
    button.textContent = 'Đang update...';
  }

  toast('Đang tải bản mới...');

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(async (registration) => {
        try {
          await registration.update();
          if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          await registration.unregister();
        } catch (error) {
          console.warn('service worker update failed', error);
        }
      }));
    }

    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } finally {
    const url = new URL(window.location.href);
    url.searchParams.set('app_v', Date.now().toString());
    window.location.replace(url.toString());
  }
}

function boot() {
  injectCss();
  injectUpdateButton();
}

document.addEventListener('click', (event) => {
  if (!event.target.closest(`#${UPDATE_BUTTON_ID}`)) return;
  event.preventDefault();
  forceUpdate();
});

window.addEventListener('DOMContentLoaded', boot);
setTimeout(boot, 300);
setTimeout(boot, 1200);
