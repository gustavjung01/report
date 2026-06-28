const SETTINGS_KEY = 'bepi-field-report-v5';

const $ = (selector, root = document) => root.querySelector(selector);

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2400);
}

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{"settings":{}}');
  } catch {
    return { settings: {} };
  }
}

function writeSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function injectAdminPopupCss() {
  if ($('#adminPopupActionsCss')) return;
  const style = document.createElement('style');
  style.id = 'adminPopupActionsCss';
  style.textContent = `
    .admin-db-inline{display:none!important}
    .app-dialog .dialog-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;align-items:center!important}
    .app-dialog .dialog-actions button{display:block!important;width:100%!important;min-height:44px!important;border-radius:14px!important;font-weight:900!important}
    .app-dialog .dialog-body{padding-bottom:18px!important}
    @media(max-width:420px){.app-dialog .dialog-actions{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);
}

function bindAgentSave() {
  const save = $('#saveAgentBtn');
  const load = $('#loadAgentJsonBtn');
  const status = $('#agentStatus');
  const nameInput = $('#agentName');
  const jsonInput = $('#agentJson');
  if (!save || save.dataset.bound === '1') return;
  save.dataset.bound = '1';

  const current = readSettings();
  if (current.settings?.agentName && nameInput && !nameInput.value) nameInput.value = current.settings.agentName;
  if (current.settings?.agentJson && jsonInput && !jsonInput.value) jsonInput.value = current.settings.agentJson;

  load?.addEventListener('click', () => {
    try {
      JSON.parse(jsonInput?.value || '{}');
      if (status) status.textContent = 'JSON hợp lệ. Bấm Lưu Agent để lưu cấu hình.';
      toast('JSON hợp lệ.');
    } catch (error) {
      if (status) status.textContent = 'JSON không hợp lệ.';
      toast('JSON lỗi.');
    }
  });

  save.addEventListener('click', () => {
    const name = (nameInput?.value || '').trim();
    const raw = (jsonInput?.value || '').trim();
    try {
      if (raw) JSON.parse(raw);
      const data = readSettings();
      data.settings = { ...(data.settings || {}), agentName: name, agentJson: raw };
      writeSettings(data);
      if (status) status.textContent = 'Đã lưu cấu hình AI Agent trên máy này.';
      toast('Đã lưu Agent.');
    } catch (error) {
      if (status) status.textContent = 'Agent JSON không hợp lệ, chưa lưu.';
      toast('Không lưu Agent.');
    }
  });
}

function init() {
  injectAdminPopupCss();
  bindAgentSave();
  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-open-dialog="agentDialog"]')) setTimeout(bindAgentSave, 0);
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
