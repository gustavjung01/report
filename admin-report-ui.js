const REPORT_STATE_KEY = 'bepi-field-report-v5';
const AGENT_CONFIG_KEY = 'bepi-ai-agent-config-v1';
const ANALYSIS_KEY = 'bepi-ai-analysis-v1';

const DEFAULT_AGENT_CONFIG = {
  agents: [
    {
      id: 'bepi-report-analyst',
      name: 'Bépi Report Analyst',
      displayName: 'Bépi Report Analyst',
      purpose: 'Phân tích báo cáo thô từ Bépi Field Report, tổng hợp thị trường, sản phẩm, khách cần chăm sóc và cơ hội lên đơn.',
      output: 'analysis-json-only'
    }
  ]
};

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
  if (!toast) return alert(text);
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(smallToast.t);
  smallToast.t = setTimeout(() => toast.classList.remove('show'), 3600);
}

function readState() {
  return readJson(REPORT_STATE_KEY, { reports: [], activeReportId: '', settings: {} });
}

function writeState(state) {
  writeJson(REPORT_STATE_KEY, state);
}

function readReports() {
  const state = readState();
  return Array.isArray(state.reports) ? state.reports : [];
}

function reportDate(v) {
  if (!v) return '--';
  try { return new Intl.DateTimeFormat('vi-VN').format(new Date(`${v}T00:00:00`)); }
  catch { return v; }
}

function escHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isGoogleServiceAccountJson(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false;
  const keys = Object.keys(config);
  return config.type === 'service_account'
    || Boolean(config.private_key)
    || Boolean(config.client_email && config.token_uri && config.auth_uri)
    || keys.includes('private_key_id')
    || keys.includes('client_x509_cert_url');
}

function updateAdminPreview() {
  const state = readState();
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
    : Array.isArray(config.flows) ? config.flows
    : config.agent ? [config.agent]
    : config.name || config.displayName || config.id ? [config]
    : [];

  return raw.map((agent, index) => {
    const id = String(agent.id || agent.name || agent.displayName || agent.agentId || agent.resourceName || `agent-${index + 1}`);
    const name = String(agent.displayName || agent.name || agent.title || id);
    return { id, name, raw: agent };
  }).filter((agent) => agent.id && agent.name);
}

function extractJsonCandidate(text) {
  const raw = String(text || '').trim();
  if (!raw) return JSON.stringify(DEFAULT_AGENT_CONFIG, null, 2);
  if (raw.startsWith('{') || raw.startsWith('[')) return raw;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstObj = raw.indexOf('{');
  const lastObj = raw.lastIndexOf('}');
  if (firstObj >= 0 && lastObj > firstObj) return raw.slice(firstObj, lastObj + 1);

  const firstArr = raw.indexOf('[');
  const lastArr = raw.lastIndexOf(']');
  if (firstArr >= 0 && lastArr > firstArr) return raw.slice(firstArr, lastArr + 1);

  return raw;
}

function parseAgentText(text) {
  const candidate = extractJsonCandidate(text);
  const config = JSON.parse(candidate);
  const normalized = Array.isArray(config) ? { agents: config } : config;

  if (isGoogleServiceAccountJson(normalized)) {
    throw new Error('Đây là Service Account JSON của Google Cloud, không phải Agent JSON. Không dán credential/key vào PWA. Hãy xóa/rotate key này trên Google Cloud.');
  }

  const agents = parseAgentList(normalized);
  if (!agents.length) {
    throw new Error('JSON này không có danh sách agent. Cần JSON dạng {"agents":[{"id":"...","name":"..."}]} hoặc bấm Xóa để dùng agent mặc định.');
  }

  return { config: normalized, json: JSON.stringify(normalized, null, 2), agents };
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
  select.innerHTML = '<option value="">Chọn agent</option>' + list.map((agent) => `<option value="${escHtml(agent.id)}">${escHtml(agent.name)}</option>`).join('');
  select.value = selectedId || list[0]?.id || '';
}

function loadDefaultAgent(showToast = true) {
  const textarea = document.getElementById('agentJson');
  const list = parseAgentList(DEFAULT_AGENT_CONFIG);
  if (textarea) textarea.value = JSON.stringify(DEFAULT_AGENT_CONFIG, null, 2);
  fillAgentSelect(list);
  setAgentStatus('Đã nạp agent mặc định Bépi Report Analyst. Bấm Lưu Agent để dùng.', true);
  if (showToast) smallToast('Đã nạp agent mặc định.');
  return list;
}

function loadAgentFromTextarea(showToast = true) {
  const textarea = document.getElementById('agentJson');
  if (!textarea) {
    smallToast('Không thấy ô Agent JSON.');
    return [];
  }

  if (!textarea.value.trim()) return loadDefaultAgent(showToast);

  try {
    const parsed = parseAgentText(textarea.value);
    textarea.value = parsed.json;
    fillAgentSelect(parsed.agents);
    setAgentStatus(`Đã load ${parsed.agents.length} agent. Chọn agent rồi bấm Lưu Agent.`, true);
    if (showToast) smallToast(`Đã load ${parsed.agents.length} agent.`);
    return parsed.agents;
  } catch (error) {
    fillAgentSelect([]);
    setAgentStatus(error.message);
    if (showToast) smallToast('Không load được Agent JSON. Xem dòng báo lỗi trong popup.');
    return [];
  }
}

function saveAgentConfig() {
  const nameInput = document.getElementById('agentName');
  const textarea = document.getElementById('agentJson');
  const select = document.getElementById('agentSelect');
  if (!textarea || !select) return smallToast('Không thấy form AI Agent.');

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
  if (!textarea) return;

  if (!saved) {
    if (!textarea.value.trim()) loadDefaultAgent(false);
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
  if (nameInput) nameInput.value = '';
  const list = loadDefaultAgent(false);
  fillAgentSelect(list);
  updateAdminPreview();
  smallToast('Đã reset AI Agent.');
}

function isOrderRelatedReport(report) {
  const text = [report.kind, report.market, report.note, report.sales]
    .concat((report.customers || []).flatMap((c) => [c.name, c.area, c.note, ...(c.marketTags || [])]))
    .join(' ')
    .toLowerCase();

  if (/lên đơn|len don|đơn hàng|don hang|order|chốt|chot|đặt hàng|dat hang|lấy hàng|lay hang|giao hàng|giao hang/.test(text)) return true;

  return (report.customers || []).some((customer) => Object.values(customer.tests || {}).some((test) => ['ok', 'interested', 'sample', 'follow'].includes(test.status)));
}

function orderReason(report) {
  const customers = report.customers || [];
  const hotCustomers = customers.filter((customer) => Object.values(customer.tests || {}).some((test) => ['ok', 'interested', 'sample', 'follow'].includes(test.status)));
  if (/đơn|don|order/i.test(report.kind || '')) return 'Báo cáo loại lên đơn hàng';
  if (hotCustomers.length) return `${hotCustomers.length} khách có tín hiệu OK/quan tâm/cần mẫu/báo lại`;
  return 'Có nội dung liên quan đơn hàng trong ghi chú';
}

function reportCardById(id) {
  const cards = [...document.querySelectorAll('[data-report-id]')];
  return cards.find((card) => card.dataset.reportId === id);
}

function openSourceReport(reportId) {
  const card = reportCardById(reportId);
  if (card) {
    card.click();
    return;
  }

  const state = readState();
  state.activeReportId = reportId;
  writeState(state);
  location.hash = '#workspaceSection';
  location.reload();
}

function renderReportModuleCounts() {
  const reports = readReports();
  const analyses = readJson(ANALYSIS_KEY, []);
  const orders = reports.filter(isOrderRelatedReport);
  const rawCount = document.getElementById('rawReportCount');
  const analyzedCount = document.getElementById('analyzedReportCount');
  const orderCount = document.getElementById('orderReportCount');
  if (rawCount) rawCount.textContent = reports.length;
  if (analyzedCount) analyzedCount.textContent = Array.isArray(analyses) ? analyses.length : 0;
  if (orderCount) orderCount.textContent = orders.length;

  const orderList = document.getElementById('orderReportList');
  if (orderList) {
    if (!orders.length) {
      orderList.className = 'module-empty';
      orderList.innerHTML = '<h3>Chưa có đơn hàng</h3><p>Đơn hàng sẽ được lấy từ báo cáo gốc: loại “Lên đơn hàng” hoặc khách có tín hiệu OK/quan tâm/cần mẫu/báo lại.</p>';
    } else {
      orderList.className = 'order-mini-list';
      orderList.innerHTML = orders.slice(0, 30).map((r) => `<button type="button" class="order-mini-card" data-source-report="${escHtml(r.id)}"><strong>${escHtml(r.market || r.kind || 'Báo cáo')}</strong><small>${reportDate(r.date)} · ${r.customers?.length || 0} khách · ${escHtml(orderReason(r))}</small><em>Mở báo cáo gốc</em></button>`).join('');
    }
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
  document.getElementById('orderReportList')?.addEventListener('click', (event) => {
    const card = event.target.closest('[data-source-report]');
    if (!card) return;
    openSourceReport(card.dataset.sourceReport);
  });
  switchReportView('raw');
  window.addEventListener('storage', renderReportModuleCounts);
  setInterval(renderReportModuleCounts, 2500);
}

function bindAgentButtons() {
  document.addEventListener('click', (event) => {
    const load = event.target.closest('#loadAgentBtn');
    const save = event.target.closest('#saveAgentBtn');
    const clear = event.target.closest('#clearAgentBtn');
    if (!load && !save && !clear) return;
    event.preventDefault();
    event.stopPropagation();
    if (load) loadAgentFromTextarea(true);
    if (save) saveAgentConfig();
    if (clear) clearAgentConfig();
  }, true);
  document.getElementById('agentSelect')?.addEventListener('change', () => setAgentStatus('Đã chọn agent, bấm Lưu Agent để lưu.', true));
}

function bootAdminReportUi() {
  bindDialogs();
  bindReportModules();
  bindAgentButtons();
  loadSavedAgentConfig();
  updateAdminPreview();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootAdminReportUi);
} else {
  bootAdminReportUi();
}
