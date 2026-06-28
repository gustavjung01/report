const REPORT_STATE_KEY = 'bepi-field-report-v5';
const AGENT_CONFIG_KEY = 'bepi-ai-agent-config-v1';
const ANALYSIS_KEY = 'bepi-ai-analysis-v1';

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function smallToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(smallToast.t);
  smallToast.t = setTimeout(() => toast.classList.remove('show'), 3200);
}

function readReports() {
  const state = readJson(REPORT_STATE_KEY, { reports: [] });
  return Array.isArray(state.reports) ? state.reports : [];
}

function reportDate(v) {
  if (!v) return '--';
  try { return new Intl.DateTimeFormat('vi-VN').format(new Date(`${v}T00:00:00`)); }
  catch { return v; }
}

function updateAdminPreview() {
  const state = readJson(REPORT_STATE_KEY, { settings: {} });
  const settings = state.settings || {};
  const supabaseOk = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(settings.supabaseUrl || '') && Boolean(settings.supabaseAnonKey);
  const supabasePreview = document.getElementById('supabasePreviewStatus');
  if (supabasePreview) supabasePreview.textContent = supabaseOk ? 'Đã lưu URL/key DB' : 'Chưa đủ URL/key DB';

  const agent = readJson(AGENT_CONFIG_KEY, null);
  const agentPreview = document.getElementById('agentPreviewStatus');
  if (agentPreview) {
    const name = agent?.selectedAgentName || agent?.name || '';
    agentPreview.textContent = name ? `Đang chọn: ${name}` : 'Chưa nạp agent JSON';
  }
}

function parseAgentList(config) {
  if (!config || typeof config !== 'object') return [];
  const raw = Array.isArray(config.agents) ? config.agents
    : Array.isArray(config.agentConfigs) ? config.agentConfigs
    : config.agent ? [config.agent]
    : [config];

  return raw.map((agent, index) => {
    const id = String(agent.id || agent.name || agent.displayName || agent.agentId || `agent-${index + 1}`);
    const name = String(agent.displayName || agent.name || agent.title || id);
    return { id, name, raw: agent };
  }).filter((agent) => agent.id && agent.name);
}

function setAgentStatus(text, ok = false) {
  const status = document.getElementById('agentStatus');
  if (!status) return;
  status.className = `sheet-status ${ok ? 'ok' : 'warn'}`;
  status.textContent = text;
}

function fillAgentSelect(list, selectedId = '') {
  const select = document.getElementById('agentSelect');
  if (!select) return;
  select.innerHTML = '<option value="">Chọn agent</option>' + list.map((agent) => `<option value="${agent.id}">${agent.name}</option>`).join('');
  select.value = selectedId || list[0]?.id || '';
}

function loadAgentFromTextarea(showToast = true) {
  const textarea = document.getElementById('agentJson');
  if (!textarea) return [];
  const raw = textarea.value.trim();
  if (!raw) {
    fillAgentSelect([]);
    setAgentStatus('Chưa có agent JSON.');
    return [];
  }

  try {
    const config = JSON.parse(raw);
    const list = parseAgentList(config);
    fillAgentSelect(list);
    setAgentStatus(`Đã load ${list.length || 1} agent từ JSON.`, true);
    if (showToast) smallToast('Đã load agent JSON.');
    return list;
  } catch (error) {
    fillAgentSelect([]);
    setAgentStatus(`JSON lỗi: ${error.message}`);
    if (showToast) smallToast('Agent JSON đang lỗi cú pháp.');
    return [];
  }
}

function saveAgentConfig() {
  const nameInput = document.getElementById('agentName');
  const textarea = document.getElementById('agentJson');
  const select = document.getElementById('agentSelect');
  if (!textarea || !select) return;

  const list = loadAgentFromTextarea(false);
  if (!list.length) return smallToast('Chưa có agent hợp lệ để lưu.');
  const selected = list.find((agent) => agent.id === select.value) || list[0];

  const payload = {
    name: nameInput?.value.trim() || selected.name,
    selectedAgentId: selected.id,
    selectedAgentName: selected.name,
    savedAt: new Date().toISOString(),
    json: textarea.value.trim(),
    agents: list.map((agent) => ({ id: agent.id, name: agent.name }))
  };
  writeJson(AGENT_CONFIG_KEY, payload);
  setAgentStatus(`Đã lưu agent: ${selected.name}`, true);
  updateAdminPreview();
  smallToast('Đã lưu AI Agent.');
}

function loadSavedAgentConfig() {
  const saved = readJson(AGENT_CONFIG_KEY, null);
  const nameInput = document.getElementById('agentName');
  const textarea = document.getElementById('agentJson');
  if (!saved || !textarea) {
    updateAdminPreview();
    return;
  }
  if (nameInput) nameInput.value = saved.name || '';
  textarea.value = saved.json || '';
  const list = loadAgentFromTextarea(false);
  fillAgentSelect(list, saved.selectedAgentId || '');
  if (saved.selectedAgentName) setAgentStatus(`Đã lưu agent: ${saved.selectedAgentName}`, true);
}

function clearAgentConfig() {
  localStorage.removeItem(AGENT_CONFIG_KEY);
  const nameInput = document.getElementById('agentName');
  const textarea = document.getElementById('agentJson');
  if (nameInput) nameInput.value = '';
  if (textarea) textarea.value = '';
  fillAgentSelect([]);
  setAgentStatus('Đã xóa cấu hình agent.');
  updateAdminPreview();
  smallToast('Đã xóa AI Agent.');
}

function renderReportModuleCounts() {
  const reports = readReports();
  const analyses = readJson(ANALYSIS_KEY, []);
  const orders = reports.filter((r) => /đơn|don|order/i.test(String(r.kind || '')));
  const rawCount = document.getElementById('rawReportCount');
  const analyzedCount = document.getElementById('analyzedReportCount');
  const orderCount = document.getElementById('orderReportCount');
  if (rawCount) rawCount.textContent = reports.length;
  if (analyzedCount) analyzedCount.textContent = Array.isArray(analyses) ? analyses.length : 0;
  if (orderCount) orderCount.textContent = orders.length;

  const orderList = document.getElementById('orderReportList');
  if (orderList && orders.length) {
    orderList.className = 'order-mini-list';
    orderList.innerHTML = orders.slice(0, 20).map((r) => `<article class="order-mini-card"><strong>${r.market || 'Đơn hàng'}</strong><small>${reportDate(r.date)} · ${r.customers?.length || 0} khách · ${r.sales || ''}</small></article>`).join('');
  }
}

function switchReportView(view) {
  const raw = document.getElementById('reportRawPanel');
  const analyzed = document.getElementById('reportAnalyzedPanel');
  const orders = document.getElementById('reportOrdersPanel');
  if (!raw || !analyzed || !orders) return;
  raw.hidden = view !== 'raw';
  analyzed.hidden = view !== 'analyzed';
  orders.hidden = view !== 'orders';
  document.querySelectorAll('[data-report-view]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.reportView === view);
  });
  renderReportModuleCounts();
}

function bindDialogs() {
  document.querySelectorAll('[data-open-dialog]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = document.getElementById(button.dataset.openDialog);
      if (!dialog) return;
      document.body.classList.add('dialog-open');
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
      if (dialog.id === 'agentDialog') loadSavedAgentConfig();
    });
  });

  document.querySelectorAll('[data-close-dialog]').forEach((button) => {
    button.addEventListener('click', () => {
      const dialog = button.closest('dialog');
      if (dialog?.close) dialog.close();
      else dialog?.removeAttribute('open');
      document.body.classList.remove('dialog-open');
      updateAdminPreview();
    });
  });

  document.querySelectorAll('.settings-dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      dialog.close();
      document.body.classList.remove('dialog-open');
      updateAdminPreview();
    });
    dialog.addEventListener('close', () => {
      document.body.classList.remove('dialog-open');
      updateAdminPreview();
    });
  });
}

function bindReportModules() {
  document.querySelectorAll('[data-report-view]').forEach((button) => {
    button.addEventListener('click', () => switchReportView(button.dataset.reportView || 'raw'));
  });
  switchReportView('raw');
  window.addEventListener('storage', renderReportModuleCounts);
  setInterval(renderReportModuleCounts, 2500);
}

function bootAdminReportUi() {
  bindDialogs();
  bindReportModules();
  loadSavedAgentConfig();
  document.getElementById('loadAgentBtn')?.addEventListener('click', () => loadAgentFromTextarea(true));
  document.getElementById('saveAgentBtn')?.addEventListener('click', saveAgentConfig);
  document.getElementById('clearAgentBtn')?.addEventListener('click', clearAgentConfig);
  document.getElementById('agentSelect')?.addEventListener('change', () => setAgentStatus('Đã chọn agent, bấm Lưu Agent để lưu.', true));
  updateAdminPreview();
}

window.addEventListener('load', bootAdminReportUi);
