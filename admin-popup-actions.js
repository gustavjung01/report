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

function normalizeSupabaseUrl(value = '') {
  return String(value || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
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

function setDbUi() {
  const data = readSettings();
  const url = normalizeSupabaseUrl(data.settings?.supabaseUrl || '');
  const key = String(data.settings?.supabaseAnonKey || '').trim();
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && Boolean(key) && !/sb_secret_|service_role/i.test(key);

  const urlInput = $('#supabaseUrl');
  const keyInput = $('#supabaseAnonKey');
  if (urlInput && !urlInput.value) urlInput.value = url;
  if (keyInput && !keyInput.value) keyInput.value = key;

  const preview = $('#supabasePreviewStatus');
  const state = $('#adminDbState');
  const pill = $('#dbStatusPill');
  if (preview) preview.innerHTML = ready ? `URL Project:<br>${url}<br>Anon Key: đã lưu` : 'URL Project: -<br>Anon Key: -';
  if (state) state.textContent = ready ? 'Đã nối ›' : 'Chưa nối ›';
  if (pill) {
    pill.classList.toggle('off', !ready);
    const label = pill.querySelector('b');
    if (label) label.textContent = ready ? 'Đã nối Supabase' : 'Chưa nối Supabase';
  }
  return { ready, url, key };
}

function saveSupabaseFromPopup() {
  const url = normalizeSupabaseUrl($('#supabaseUrl')?.value || '');
  const key = String($('#supabaseAnonKey')?.value || '').trim();
  const status = $('#supabaseStatus');

  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    if (status) status.textContent = 'URL Supabase chưa hợp lệ. Dạng đúng: https://xxxxx.supabase.co';
    toast('URL DB chưa hợp lệ.');
    return null;
  }
  if (!key) {
    if (status) status.textContent = 'Thiếu Supabase publishable / anon key.';
    toast('Thiếu key DB.');
    return null;
  }
  if (/sb_secret_|service_role/i.test(key)) {
    if (status) status.textContent = 'Sai key: không dùng service_role/sb_secret trong PWA.';
    toast('Không lưu secret key.');
    return null;
  }

  const data = readSettings();
  data.settings = { ...(data.settings || {}), supabaseUrl: url, supabaseAnonKey: key };
  writeSettings(data);
  setDbUi();
  if (status) status.textContent = 'Đã lưu DB trên máy này.';
  toast('Đã lưu DB.');
  return { url, key };
}

async function testSupabaseFromPopup() {
  const status = $('#supabaseStatus');
  const cfg = saveSupabaseFromPopup();
  if (!cfg) return;
  try {
    const response = await fetch(`${cfg.url}/rest/v1/products?select=id,name&limit=1`, {
      headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` }
    });
    if (!response.ok) throw new Error(`Supabase HTTP ${response.status}`);
    if (status) status.textContent = 'DB sẵn sàng. Đọc được bảng products.';
    toast('DB OK.');
  } catch (error) {
    if (status) status.textContent = error.message || 'Test DB lỗi.';
    toast('Test DB lỗi.');
  }
}

function setAgentUi() {
  const data = readSettings();
  const nameInput = $('#agentName');
  const jsonInput = $('#agentJson');
  if (nameInput && !nameInput.value && data.settings?.agentName) nameInput.value = data.settings.agentName;
  if (jsonInput && !jsonInput.value && data.settings?.agentJson) jsonInput.value = data.settings.agentJson;
}

function loadAgentJsonFromPopup() {
  const status = $('#agentStatus');
  const jsonInput = $('#agentJson');
  try {
    JSON.parse(jsonInput?.value || '{}');
    if (status) status.textContent = 'JSON hợp lệ. Bấm Lưu Agent để lưu cấu hình.';
    toast('JSON hợp lệ.');
  } catch {
    if (status) status.textContent = 'JSON không hợp lệ.';
    toast('JSON lỗi.');
  }
}

function saveAgentFromPopup() {
  const status = $('#agentStatus');
  const name = ($('#agentName')?.value || '').trim();
  const raw = ($('#agentJson')?.value || '').trim();
  try {
    if (raw) JSON.parse(raw);
    const data = readSettings();
    data.settings = { ...(data.settings || {}), agentName: name, agentJson: raw };
    writeSettings(data);
    if (status) status.textContent = 'Đã lưu cấu hình AI Agent trên máy này.';
    toast('Đã lưu Agent.');
  } catch {
    if (status) status.textContent = 'Agent JSON không hợp lệ, chưa lưu.';
    toast('Không lưu Agent.');
  }
}

function bindPopupActions() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (target.closest('#saveSupabaseBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveSupabaseFromPopup();
      return;
    }
    if (target.closest('#testSupabaseBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      testSupabaseFromPopup();
      return;
    }
    if (target.closest('#loadAgentJsonBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      loadAgentJsonFromPopup();
      return;
    }
    if (target.closest('#saveAgentBtn')) {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveAgentFromPopup();
      return;
    }
    if (target.closest('[data-open-dialog="supabaseDialog"]')) setTimeout(setDbUi, 0);
    if (target.closest('[data-open-dialog="agentDialog"]')) setTimeout(setAgentUi, 0);
  }, true);
}

function init() {
  injectAdminPopupCss();
  setDbUi();
  setAgentUi();
  bindPopupActions();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
