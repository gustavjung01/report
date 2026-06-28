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
    .admin-actions{display:grid;gap:7px;align-self:center;justify-items:end}
    .admin-actions .secondary{min-height:34px;padding:0 11px;white-space:nowrap}
    .tiny-update{font-size:12px;border-color:#cad7d4!important;color:#63727c!important;background:#fbfffd!important}
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
