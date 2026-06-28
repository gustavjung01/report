const SETTINGS_KEY = 'bepi-field-report-v5';
const TEST_FORM_KEY = 'bepi-local-test-forms-v1';
const TEST_ROW_KEY = 'bepi-local-test-rows-v1';
const MARKET_FORM_KEY = 'bepi-local-market-forms-v1';
const MARKET_ROW_KEY = 'bepi-local-market-rows-v1';
const PUBLIC_CONFIG = globalThis.BEPI_CONFIG || {};
const DEFAULT_SUPABASE_URL = PUBLIC_CONFIG.supabaseUrl || 'https://noiadkpkvdohljgopgfb.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = PUBLIC_CONFIG.supabaseAnonKey || 'sb_publishable_n6LXv-fd-ImF3XzeU2mrjg_G7tBGy66';
const DEFAULT_AGENT_NAME = PUBLIC_CONFIG.agentName || 'Bếp Sỉ Report Analyst';
const DEFAULT_AGENT_JSON = PUBLIC_CONFIG.agentJson || '{"agents":[{"id":"bep-si-report-analyst","name":"Bếp Sỉ Report Analyst"}]}';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

function escapeHtml(value = '') {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[char]));
}

function toast(message) {
  const node = $('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove('show'), 2400);
}

function readJson(key, fallback = {}) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function readArray(key) {
  const value = readJson(key, []);
  return Array.isArray(value) ? value : [];
}

function writeSettings(next) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
}

function readSettings() {
  const data = readJson(SETTINGS_KEY, { settings: {} });
  const settings = data && typeof data === 'object' ? data.settings || {} : {};
  return {
    ...(data && typeof data === 'object' ? data : {}),
    settings: {
      supabaseUrl: DEFAULT_SUPABASE_URL,
      supabaseAnonKey: DEFAULT_SUPABASE_ANON_KEY,
      agentName: DEFAULT_AGENT_NAME,
      agentJson: DEFAULT_AGENT_JSON,
      ...settings
    }
  };
}

function normalizeSupabaseUrl(value = '') {
  return String(value || '').trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
}

function canonicalSupabaseDialogHtml() {
  return `<form method="dialog" class="dialog-body">
    <header><h2>Supabase</h2><button type="button" data-close-dialog>Đóng</button></header>
    <label><span>Supabase Project URL</span><input id="supabaseUrl" type="url" placeholder="https://xxxxx.supabase.co" /></label>
    <label><span>Supabase publishable / anon key</span><input id="supabaseAnonKey" type="password" placeholder="sb_publishable_... hoặc anon public key" /></label>
    <p class="muted-note" id="supabaseStatus">Đã có cấu hình mặc định. Bấm Test DB hoặc Lưu DB nếu muốn ghi vào máy.</p>
    <div class="dialog-actions"><button type="button" id="testSupabaseBtn">Test DB</button><button class="primary" type="button" id="saveSupabaseBtn">Lưu DB</button></div>
  </form>`;
}

function canonicalAgentDialogHtml() {
  return `<form method="dialog" class="dialog-body">
    <header><h2>AI Agent</h2><button type="button" data-close-dialog>Đóng</button></header>
    <p class="muted-note warn" id="agentStatus">Không dán service account JSON hoặc private key vào PWA. AI thật sẽ đi qua backend/Edge Function.</p>
    <label><span>Tên cấu hình</span><input id="agentName" placeholder="Agent phân tích thị trường" /></label>
    <label><span>Agent JSON</span><textarea id="agentJson" rows="7" placeholder='{"agents":[{"id":"bep-si-report-analyst","name":"Bếp Sỉ Report Analyst"}]}'></textarea></label>
    <div class="dialog-actions"><button type="button" id="loadAgentJsonBtn">Load JSON</button><button class="primary" type="button" id="saveAgentBtn">Lưu Agent</button></div>
  </form>`;
}

function ensureDialog(id, html) {
  let dialog = document.getElementById(id);
  if (!dialog) {
    const mount = document.querySelector('.phone-shell') || document.body;
    mount.insertAdjacentHTML('beforeend', `<dialog class="app-dialog" id="${id}">${html}</dialog>`);
    dialog = document.getElementById(id);
  }
  return dialog;
}

function ensureActionButton(dialog, id, text, primary = false) {
  if (!dialog || document.getElementById(id)) return;
  let actions = $('.dialog-actions', dialog);
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'dialog-actions';
    const body = $('.dialog-body', dialog) || dialog;
    body.appendChild(actions);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.id = id;
  button.textContent = text;
  if (primary) button.className = 'primary';
  actions.appendChild(button);
}

function ensureSupabaseDialog() {
  const dialog = ensureDialog('supabaseDialog', canonicalSupabaseDialogHtml());
  const missingCore = !$('#supabaseUrl', dialog) || !$('#supabaseAnonKey', dialog) || !$('#supabaseStatus', dialog);
  if (missingCore) dialog.innerHTML = canonicalSupabaseDialogHtml();
  ensureActionButton(dialog, 'testSupabaseBtn', 'Test DB', false);
  ensureActionButton(dialog, 'saveSupabaseBtn', 'Lưu DB', true);
  return dialog;
}

function ensureAgentDialog() {
  const dialog = ensureDialog('agentDialog', canonicalAgentDialogHtml());
  const missingCore = !$('#agentName', dialog) || !$('#agentJson', dialog) || !$('#agentStatus', dialog);
  if (missingCore) dialog.innerHTML = canonicalAgentDialogHtml();
  ensureActionButton(dialog, 'loadAgentJsonBtn', 'Load JSON', false);
  ensureActionButton(dialog, 'saveAgentBtn', 'Lưu Agent', true);
  return dialog;
}

function ensureAdminDialogs() {
  ensureSupabaseDialog();
  ensureAgentDialog();
}

function injectAdminPopupCss() {
  if ($('#adminPopupActionsCss')) return;
  const style = document.createElement('style');
  style.id = 'adminPopupActionsCss';
  style.textContent = `
    .admin-db-inline{display:none!important}
    .app-dialog .dialog-actions{display:grid!important;grid-template-columns:1fr 1fr!important;gap:10px!important;align-items:center!important;width:100%!important}
    .app-dialog .dialog-actions button{display:flex!important;width:100%!important;min-height:44px!important;border-radius:14px!important;font-weight:900!important;align-items:center!important;justify-content:center!important}
    .app-dialog .dialog-actions .primary,#saveSupabaseBtn,#saveAgentBtn{background:linear-gradient(135deg,#00957f,#007866)!important;color:#fff!important;border:0!important}
    .app-dialog .dialog-body{padding-bottom:18px!important}
    .app-dialog .dialog-body label{display:grid!important;gap:7px!important}
    .app-dialog .dialog-body label span{font-size:12px!important;font-weight:900!important;color:#24433d!important}
    .app-dialog .dialog-body input,.app-dialog .dialog-body textarea{width:100%!important;box-sizing:border-box!important}
    .form-export-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}
    .form-export-actions b{white-space:nowrap}
    .form-export-btn{min-height:36px;border-radius:999px!important;padding:0 12px!important;font-size:12px!important;font-weight:900!important;background:#eaf8f5!important;color:#00796b!important;border:1px solid #bce2db!important}
    .test-detail-top .form-export-actions,.market-detail-top .form-export-actions{justify-content:flex-start}
    @media(max-width:420px){.app-dialog .dialog-actions{grid-template-columns:1fr 1fr!important}.form-export-actions{justify-content:flex-start}}
  `;
  document.head.appendChild(style);
}

function setDbUi() {
  ensureSupabaseDialog();
  const data = readSettings();
  const url = normalizeSupabaseUrl(data.settings?.supabaseUrl || DEFAULT_SUPABASE_URL);
  const key = String(data.settings?.supabaseAnonKey || DEFAULT_SUPABASE_ANON_KEY).trim();
  const ready = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url) && Boolean(key) && !/sb_secret_|service_role/i.test(key);

  const urlInput = $('#supabaseUrl');
  const keyInput = $('#supabaseAnonKey');
  if (urlInput) urlInput.value = url;
  if (keyInput) keyInput.value = key;

  const preview = $('#supabasePreviewStatus');
  const state = $('#adminDbState');
  const pill = $('#dbStatusPill');
  if (preview) preview.innerHTML = ready ? `URL Project:<br>${escapeHtml(url)}<br>Anon Key: đã có` : 'URL Project: -<br>Anon Key: -';
  if (state) state.textContent = ready ? 'Đã nối ›' : 'Chưa nối ›';
  if (pill) {
    pill.classList.toggle('off', !ready);
    const label = pill.querySelector('b');
    if (label) label.textContent = ready ? 'Đã nối Supabase' : 'Chưa nối Supabase';
  }
  return { ready, url, key };
}

function saveSupabaseFromPopup() {
  ensureSupabaseDialog();
  const url = normalizeSupabaseUrl($('#supabaseUrl')?.value || DEFAULT_SUPABASE_URL);
  const key = String($('#supabaseAnonKey')?.value || DEFAULT_SUPABASE_ANON_KEY).trim();
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
  ensureAgentDialog();
  const data = readSettings();
  const name = String(data.settings?.agentName || DEFAULT_AGENT_NAME).trim();
  const raw = String(data.settings?.agentJson || DEFAULT_AGENT_JSON).trim();
  const nameInput = $('#agentName');
  const jsonInput = $('#agentJson');
  if (nameInput) nameInput.value = name;
  if (jsonInput) jsonInput.value = raw;

  const card = document.querySelector('[data-open-dialog="agentDialog"]');
  const small = card?.querySelector('small');
  const state = card?.querySelector('em');
  if (small) small.innerHTML = `Agent: ${escapeHtml(name || 'Đã cấu hình')}<br />JSON: ${raw ? 'đã có' : '-'}`;
  if (state) state.textContent = name || raw ? 'Đã cấu hình ›' : 'Chưa cấu hình ›';
}

function loadAgentJsonFromPopup() {
  ensureAgentDialog();
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
  ensureAgentDialog();
  const status = $('#agentStatus');
  const name = ($('#agentName')?.value || DEFAULT_AGENT_NAME).trim();
  const raw = ($('#agentJson')?.value || DEFAULT_AGENT_JSON).trim();
  try {
    if (raw) JSON.parse(raw);
    const data = readSettings();
    data.settings = { ...(data.settings || {}), agentName: name, agentJson: raw };
    writeSettings(data);
    setAgentUi();
    if (status) status.textContent = 'Đã lưu cấu hình AI Agent trên máy này.';
    toast('Đã lưu Agent.');
  } catch {
    if (status) status.textContent = 'Agent JSON không hợp lệ, chưa lưu.';
    toast('Không lưu Agent.');
  }
}

function slug(value = 'file') {
  const normalized = String(value || 'file').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 72) || 'file';
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportTestForm(formId) {
  const form = readArray(TEST_FORM_KEY).find((item) => item.id === formId);
  if (!form) return toast('Không tìm thấy file test để xuất.');
  const customers = readArray(TEST_ROW_KEY).filter((row) => row.form_id === formId);
  downloadJson(`test-sp-${slug(form.title || form.route)}-${form.test_date || 'local'}.json`, {
    app: 'Bếp Sỉ Báo Cáo',
    export_type: 'test_product_total_form',
    exported_at: new Date().toISOString(),
    form,
    customers
  });
  toast('Đã xuất file test tổng.');
}

function exportMarketForm(formId) {
  const form = readArray(MARKET_FORM_KEY).find((item) => item.id === formId);
  if (!form) return toast('Không tìm thấy file báo cáo để xuất.');
  const customers = readArray(MARKET_ROW_KEY).filter((row) => row.form_id === formId);
  downloadJson(`bao-cao-thi-truong-${slug(form.title || form.route)}-${form.report_date || 'local'}.json`, {
    app: 'Bếp Sỉ Báo Cáo',
    export_type: 'market_report_total_form',
    exported_at: new Date().toISOString(),
    form,
    customers
  });
  toast('Đã xuất file báo cáo tổng.');
}

function makeExportButton(type, id) {
  const attr = type === 'test' ? 'data-export-test-form' : 'data-export-market-form';
  return `<button type="button" class="form-export-btn" ${attr}="${escapeHtml(id)}">⬇ Xuất file tổng</button>`;
}

function addExportToCard(card, type, id) {
  if (!card || !id || card.querySelector('[data-export-test-form],[data-export-market-form]')) return;
  const openLabel = Array.from(card.children).find((child) => child.tagName === 'B');
  const wrap = document.createElement('div');
  wrap.className = 'form-export-actions';
  wrap.innerHTML = makeExportButton(type, id);
  if (openLabel) {
    openLabel.replaceWith(wrap);
    wrap.appendChild(openLabel);
  } else {
    card.appendChild(wrap);
  }
}

function addExportToDetail(top, type, id) {
  if (!top || !id || top.querySelector('[data-export-test-form],[data-export-market-form]')) return;
  const wrap = document.createElement('div');
  wrap.className = 'form-export-actions';
  wrap.innerHTML = makeExportButton(type, id);
  top.appendChild(wrap);
}

function enhanceFormExports() {
  $$('#onaTestList .test-file[data-open-test-detail]').forEach((card) => addExportToCard(card, 'test', card.dataset.openTestDetail));
  const testFormId = $('#testCustomerForm')?.dataset?.formId;
  addExportToDetail($('#onaTestList .test-detail-top'), 'test', testFormId);

  $$('#marketReportList .market-file[data-open-report]').forEach((card) => addExportToCard(card, 'market', card.dataset.openReport));
  const marketFormId = $('#marketCustomerForm')?.dataset?.formId;
  addExportToDetail($('#marketReportList .market-detail-top'), 'market', marketFormId);
}

function bindPopupActions() {
  document.addEventListener('click', (event) => {
    const target = event.target;

    const exportTest = target.closest('[data-export-test-form]');
    if (exportTest) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportTestForm(exportTest.dataset.exportTestForm);
      return;
    }

    const exportMarket = target.closest('[data-export-market-form]');
    if (exportMarket) {
      event.preventDefault();
      event.stopImmediatePropagation();
      exportMarketForm(exportMarket.dataset.exportMarketForm);
      return;
    }

    if (target.closest('[data-open-dialog="supabaseDialog"]')) ensureSupabaseDialog();
    if (target.closest('[data-open-dialog="agentDialog"]')) ensureAgentDialog();

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

function observeUiFixes() {
  let scheduled = false;
  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureAdminDialogs();
      enhanceFormExports();
    });
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.body, { childList: true, subtree: true });
  schedule();
}

function init() {
  injectAdminPopupCss();
  ensureAdminDialogs();
  setDbUi();
  setAgentUi();
  bindPopupActions();
  observeUiFixes();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
else init();
