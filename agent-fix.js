const AGENT_SETTINGS_KEY = 'bepi-field-report-v5';
const PHANTOM_AGENT_NAME = 'Bếp Sỉ Report Analyst';
const PHANTOM_AGENT_ID = 'bep-si-report-analyst';

const agent$ = (selector, root = document) => root.querySelector(selector);

function agentToast(message) {
  const node = agent$('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(agentToast.timer);
  agentToast.timer = setTimeout(() => node.classList.remove('show'), 2400);
}

function readAgentStore() {
  try {
    const data = JSON.parse(localStorage.getItem(AGENT_SETTINGS_KEY) || '{"settings":{}}');
    data.settings = data.settings || {};
    return data;
  } catch {
    return { settings: {} };
  }
}

function writeAgentStore(data) {
  localStorage.setItem(AGENT_SETTINGS_KEY, JSON.stringify(data));
}

function isPhantomAgent(name = '', raw = '') {
  const text = `${name || ''}\n${raw || ''}`;
  return text.includes(PHANTOM_AGENT_NAME) || text.includes(PHANTOM_AGENT_ID);
}

function clearPhantomAgentStore() {
  const data = readAgentStore();
  const name = String(data.settings.agentName || '').trim();
  const raw = String(data.settings.agentJson || '').trim();
  if (!isPhantomAgent(name, raw)) return data;
  data.settings.agentName = '';
  data.settings.agentJson = '';
  writeAgentStore(data);
  return data;
}

function ensureAgentButtons() {
  const dialog = agent$('#agentDialog');
  if (!dialog) return;
  let actions = agent$('.dialog-actions', dialog);
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'dialog-actions';
    (agent$('.dialog-body', dialog) || dialog).appendChild(actions);
  }
  let check = agent$('#loadAgentJsonBtn');
  if (!check) {
    check = document.createElement('button');
    check.type = 'button';
    check.id = 'loadAgentJsonBtn';
    actions.appendChild(check);
  }
  check.textContent = 'Kiểm tra JSON';
  let save = agent$('#saveAgentBtn');
  if (!save) {
    save = document.createElement('button');
    save.type = 'button';
    save.id = 'saveAgentBtn';
    save.className = 'primary';
    actions.appendChild(save);
  }
  save.textContent = 'Lưu Agent';
}

function sanitizeAgentPopup() {
  clearPhantomAgentStore();
  ensureAgentButtons();
  const nameInput = agent$('#agentName');
  const jsonInput = agent$('#agentJson');
  const status = agent$('#agentStatus');
  const name = String(nameInput?.value || '').trim();
  const raw = String(jsonInput?.value || '').trim();

  if (isPhantomAgent(name, raw)) {
    if (nameInput) nameInput.value = '';
    if (jsonInput) jsonInput.value = '';
    if (status) status.textContent = 'Chưa có Agent JSON thật. Dán JSON thật rồi bấm Lưu Agent.';
  }

  const data = readAgentStore();
  const storedName = String(data.settings.agentName || '').trim();
  const storedRaw = String(data.settings.agentJson || '').trim();
  const card = document.querySelector('[data-open-dialog="agentDialog"]');
  const small = card?.querySelector('small');
  const state = card?.querySelector('em');
  const configured = storedRaw && !isPhantomAgent(storedName, storedRaw);
  if (small) small.innerHTML = configured ? `Agent: ${storedName || 'Đã lưu'}<br />JSON: đã lưu` : 'Chưa có Agent JSON thật.';
  if (state) state.textContent = configured ? 'Đã cấu hình ›' : 'Chưa cấu hình ›';
}

function checkCurrentAgentJson() {
  const status = agent$('#agentStatus');
  const jsonInput = agent$('#agentJson');
  const nameInput = agent$('#agentName');
  const raw = String(jsonInput?.value || '').trim();
  const name = String(nameInput?.value || '').trim();

  if (!raw || isPhantomAgent(name, raw)) {
    if (nameInput && isPhantomAgent(name, raw)) nameInput.value = '';
    if (jsonInput) jsonInput.value = '';
    clearPhantomAgentStore();
    if (status) status.textContent = 'Chưa có Agent JSON thật. Dán JSON thật rồi bấm Lưu Agent.';
    agentToast('Chưa có Agent thật.');
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (status) status.textContent = 'JSON hợp lệ. Bấm Lưu Agent để lưu cấu hình này.';
    agentToast('JSON hợp lệ.');
    return parsed;
  } catch {
    if (status) status.textContent = 'Agent JSON không hợp lệ.';
    agentToast('JSON lỗi.');
    return null;
  }
}

function saveCurrentAgent() {
  const status = agent$('#agentStatus');
  const name = String(agent$('#agentName')?.value || '').trim();
  const raw = String(agent$('#agentJson')?.value || '').trim();

  if (!raw || isPhantomAgent(name, raw)) {
    const data = clearPhantomAgentStore();
    data.settings.agentName = '';
    data.settings.agentJson = '';
    writeAgentStore(data);
    sanitizeAgentPopup();
    if (status) status.textContent = 'Chưa lưu: chưa có Agent JSON thật.';
    agentToast('Chưa lưu Agent.');
    return;
  }

  try {
    JSON.parse(raw);
    const data = readAgentStore();
    data.settings = { ...(data.settings || {}), agentName: name, agentJson: raw };
    writeAgentStore(data);
    sanitizeAgentPopup();
    if (status) status.textContent = 'Đã lưu Agent JSON thật trên máy này.';
    agentToast('Đã lưu Agent.');
  } catch {
    if (status) status.textContent = 'Agent JSON không hợp lệ, chưa lưu.';
    agentToast('Không lưu Agent.');
  }
}

document.addEventListener('click', (event) => {
  if (event.target.closest('[data-open-dialog="agentDialog"]')) {
    setTimeout(sanitizeAgentPopup, 0);
    return;
  }
  if (event.target.closest('#loadAgentJsonBtn')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    checkCurrentAgentJson();
    return;
  }
  if (event.target.closest('#saveAgentBtn')) {
    event.preventDefault();
    event.stopImmediatePropagation();
    saveCurrentAgent();
  }
}, true);

function initAgentFix() {
  sanitizeAgentPopup();
  const observer = new MutationObserver(() => requestAnimationFrame(sanitizeAgentPopup));
  observer.observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAgentFix, { once: true });
else initAgentFix();
