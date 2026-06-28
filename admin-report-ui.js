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

const PRODUCT_NAMES = ['Trà Đen', 'Trà Quả Mộng', 'Trà Gạo Rang', 'Trà Lài', 'Trà Olong', 'Trà Olong Sen'];
const STATUS_LABELS = {
  pending: 'Chưa thử',
  ok: 'OK',
  interested: 'Quan tâm',
  sample: 'Cần mẫu',
  follow: 'Báo Tân',
  bad: 'Chưa tốt',
  retry: 'Thử lại'
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

function activeReport() {
  const state = readState();
  return (state.reports || []).find((report) => report.id === state.activeReportId) || null;
}

function readAnalyses() {
  const rows = readJson(ANALYSIS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

function writeAnalyses(rows) {
  writeJson(ANALYSIS_KEY, rows);
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

function statusLabel(status) {
  return STATUS_LABELS[status] || status || 'Chưa rõ';
}

function testsByStatus(report, statuses) {
  const rows = [];
  (report.customers || []).forEach((customer) => {
    Object.entries(customer.tests || {}).forEach(([product, test]) => {
      if (statuses.includes(test?.status)) rows.push({ customer, product, test });
    });
  });
  return rows;
}

function productsSummary(report) {
  const map = new Map();
  PRODUCT_NAMES.forEach((product) => map.set(product, { product, ok: 0, interested: 0, sample: 0, follow: 0, bad: 0, retry: 0, pending: 0 }));
  (report.customers || []).forEach((customer) => {
    Object.entries(customer.tests || {}).forEach(([product, test]) => {
      if (!map.has(product)) map.set(product, { product, ok: 0, interested: 0, sample: 0, follow: 0, bad: 0, retry: 0, pending: 0 });
      const row = map.get(product);
      const status = test?.status || 'pending';
      row[status] = (row[status] || 0) + 1;
    });
  });
  return [...map.values()];
}

function buildLocalAnalysis(report) {
  const customers = report.customers || [];
  const goodRows = testsByStatus(report, ['ok', 'interested']);
  const sampleRows = testsByStatus(report, ['sample']);
  const followRows = testsByStatus(report, ['follow']);
  const badRows = testsByStatus(report, ['bad', 'retry']);
  const productRows = productsSummary(report);
  const bestProducts = productRows
    .map((row) => ({ ...row, score: row.ok * 3 + row.interested * 2 + row.sample + row.follow }))
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score > 0)
    .slice(0, 3);
  const weakProducts = productRows
    .map((row) => ({ ...row, score: row.bad + row.retry }))
    .sort((a, b) => b.score - a.score)
    .filter((row) => row.score > 0)
    .slice(0, 3);

  const customerActions = customers.map((customer) => {
    const tests = Object.values(customer.tests || {});
    const hasBad = tests.some((test) => ['bad', 'retry'].includes(test.status));
    const hasSample = tests.some((test) => test.status === 'sample');
    const hasFollow = tests.some((test) => test.status === 'follow') || /báo|tan|tân|gọi|goi/i.test(customer.note || '');
    const hasGood = tests.some((test) => ['ok', 'interested'].includes(test.status));
    if (hasBad) return { customer: customer.name, priority: 'high', action: 'Xử lý phản hồi chưa tốt / thử lại sản phẩm phù hợp', reason: 'Có sản phẩm bị đánh giá chưa tốt hoặc cần thử lại.' };
    if (hasSample) return { customer: customer.name, priority: 'high', action: 'Chuẩn bị và gửi mẫu', reason: 'Khách có nhu cầu cần mẫu.' };
    if (hasFollow) return { customer: customer.name, priority: 'medium', action: 'Báo lại / gọi lại theo lịch', reason: 'Khách cần báo lại hoặc follow-up.' };
    if (hasGood) return { customer: customer.name, priority: 'medium', action: 'Đẩy chốt đơn thử', reason: 'Khách có tín hiệu OK hoặc quan tâm.' };
    return { customer: customer.name, priority: 'low', action: 'Tiếp tục theo dõi', reason: 'Chưa có tín hiệu rõ.' };
  });

  return {
    summary: `Báo cáo ${report.kind || 'thị trường'} tại ${report.market || 'chưa ghi thị trường'} có ${customers.length} khách. Có ${sampleRows.length} yêu cầu mẫu, ${followRows.length} mục cần báo lại, ${badRows.length} phản hồi cần xử lý và ${goodRows.length} tín hiệu OK/quan tâm.`,
    market_insights: [
      customers.length ? `Đã ghi nhận ${customers.length} khách trong khu vực/báo cáo này.` : 'Chưa có khách trong báo cáo.',
      sampleRows.length ? `Nhu cầu mẫu xuất hiện ${sampleRows.length} lần, nên ưu tiên chuẩn bị mẫu.` : 'Chưa thấy nhu cầu mẫu rõ.',
      badRows.length ? `Có ${badRows.length} phản hồi chưa tốt/cần thử lại, cần xử lý trước khi đẩy đơn.` : 'Chưa có nhiều phản hồi xấu.'
    ],
    product_insights: productRows.map((row) => ({
      product: row.product,
      status: row.bad || row.retry ? 'watch' : row.ok || row.interested ? 'good' : row.sample || row.follow ? 'watch' : 'unknown',
      insight: `${row.ok} OK, ${row.interested} quan tâm, ${row.sample} cần mẫu, ${row.follow} báo lại, ${row.bad + row.retry} cần xử lý.`
    })),
    best_products: bestProducts.map((row) => `${row.product}: tín hiệu tốt ${row.score}`),
    weak_products: weakProducts.map((row) => `${row.product}: ${row.score} phản hồi cần xử lý`),
    customer_actions: customerActions,
    sample_requests: sampleRows.map((row) => ({ customer: row.customer.name, products: [row.product], note: row.test.note || row.customer.note || '' })),
    follow_up_list: followRows.map((row) => ({ customer: row.customer.name, date: row.customer.followDate || '', note: row.test.note || row.customer.note || '' })),
    order_opportunities: customers.filter((customer) => Object.values(customer.tests || {}).some((test) => ['ok', 'interested', 'sample', 'follow'].includes(test.status))).map((customer) => ({
      customer: customer.name,
      products: Object.entries(customer.tests || {}).filter(([, test]) => ['ok', 'interested', 'sample', 'follow'].includes(test.status)).map(([product]) => product),
      confidence: Object.values(customer.tests || {}).some((test) => test.status === 'ok') ? 'high' : 'medium',
      reason: 'Có tín hiệu OK/quan tâm/cần mẫu/báo lại trong báo cáo gốc.'
    })),
    risks: badRows.length ? badRows.map((row) => `${row.customer.name} - ${row.product}: ${statusLabel(row.test.status)}${row.test.note ? ` (${row.test.note})` : ''}`) : ['Chưa có rủi ro rõ từ dữ liệu hiện tại.'],
    next_steps: [
      sampleRows.length ? 'Chuẩn bị danh sách gửi mẫu cho khách cần mẫu.' : 'Tiếp tục thu thập phản hồi mẫu.',
      followRows.length ? 'Lên lịch gọi/báo lại các khách đang chờ phản hồi.' : 'Chưa có lịch follow-up rõ.',
      badRows.length ? 'Xử lý phản hồi xấu trước khi chốt đơn.' : 'Có thể ưu tiên khách có tín hiệu OK/quan tâm.'
    ]
  };
}

function runAnalysisForActiveReport() {
  const report = activeReport();
  if (!report) return smallToast('Chọn báo cáo trước rồi mới phân tích.');
  if (!(report.customers || []).length) return smallToast('Báo cáo chưa có khách để phân tích.');

  const agent = readJson(AGENT_CONFIG_KEY, null) || { selectedAgentId: 'bepi-report-analyst', selectedAgentName: 'Bépi Report Analyst' };
  const analysis = buildLocalAnalysis(report);
  const row = {
    id: `analysis-${report.id}`,
    reportId: report.id,
    reportTitle: `${report.kind || 'Báo cáo'} · ${report.market || 'Chưa ghi thị trường'}`,
    reportDate: report.date || '',
    agentId: agent.selectedAgentId || 'bepi-report-analyst',
    agentName: agent.selectedAgentName || agent.name || 'Bépi Report Analyst',
    createdAt: new Date().toISOString(),
    result: analysis
  };

  const rows = readAnalyses().filter((item) => item.reportId !== report.id);
  rows.unshift(row);
  writeAnalyses(rows);
  renderReportModuleCounts();
  switchReportView('analyzed');
  location.hash = '#reportsSection';
  smallToast('Đã tạo báo cáo phân tích.');
}

function renderAnalysisCard(item) {
  const result = item.result || {};
  const actions = result.customer_actions || [];
  const opportunities = result.order_opportunities || [];
  return `<article class="analysis-card">
    <div class="analysis-card-head">
      <div><span>${escHtml(item.agentName || 'AI Agent')}</span><strong>${escHtml(item.reportTitle || 'Báo cáo')}</strong><small>${reportDate(item.reportDate)} · ${actions.length} hành động · ${opportunities.length} cơ hội</small></div>
      <button type="button" data-source-report="${escHtml(item.reportId)}">Mở gốc</button>
    </div>
    <p>${escHtml(result.summary || 'Chưa có tóm tắt.')}</p>
    <div class="analysis-mini-list">
      ${(result.next_steps || []).slice(0, 3).map((step) => `<em>${escHtml(step)}</em>`).join('')}
    </div>
  </article>`;
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
  const analyses = readAnalyses();
  const orders = reports.filter(isOrderRelatedReport);
  const rawCount = document.getElementById('rawReportCount');
  const analyzedCount = document.getElementById('analyzedReportCount');
  const orderCount = document.getElementById('orderReportCount');
  if (rawCount) rawCount.textContent = reports.length;
  if (analyzedCount) analyzedCount.textContent = analyses.length;
  if (orderCount) orderCount.textContent = orders.length;

  const analyzedList = document.getElementById('analyzedReportList');
  if (analyzedList) {
    if (!analyses.length) {
      analyzedList.className = 'module-empty';
      analyzedList.innerHTML = '<h3>Chưa có báo cáo AI</h3><p>Mở một báo cáo gốc rồi bấm “AI phân tích”.</p>';
    } else {
      analyzedList.className = 'analysis-list';
      analyzedList.innerHTML = analyses.slice(0, 30).map(renderAnalysisCard).join('');
    }
  }

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
  document.addEventListener('click', (event) => {
    const source = event.target.closest('[data-source-report]');
    if (source) openSourceReport(source.dataset.sourceReport);
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
    const analyze = event.target.closest('#analyzeReportBtn');
    if (!load && !save && !clear && !analyze) return;
    event.preventDefault();
    event.stopPropagation();
    if (load) loadAgentFromTextarea(true);
    if (save) saveAgentConfig();
    if (clear) clearAgentConfig();
    if (analyze) runAnalysisForActiveReport();
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
