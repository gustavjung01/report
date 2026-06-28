const editor = document.getElementById('customerEditor');
const quick = document.getElementById('quickAddBtn');
const form = document.getElementById('customerForm');
const cancel = document.getElementById('cancelEditBtn');
const nameInput = document.getElementById('customerName');

const PAGE_IDS = ['createSection', 'reportsSection', 'workspaceSection', 'adminSection'];
let baseViewportHeight = window.innerHeight;

function readReportState() {
  for (const key of ['bepi-field-report-v5', 'bepi-field-report-v4', 'bepi-field-report-v3']) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (error) {}
  }
  return { reports: [], activeReportId: '', settings: {} };
}

function hasActiveReport() {
  const state = readReportState();
  return Boolean(state.activeReportId && Array.isArray(state.reports) && state.reports.some((r) => r.id === state.activeReportId));
}

function normalizePageId(id) {
  if (!id) return 'createSection';
  const clean = String(id).replace('#', '');
  if (clean === 'sheetSection') return 'adminSection';
  return PAGE_IDS.includes(clean) ? clean : 'createSection';
}

function setActivePage(id, updateHash = true) {
  const pageId = normalizePageId(id);

  PAGE_IDS.forEach((pid) => {
    document.getElementById(pid)?.classList.toggle('is-active', pid === pageId);
  });

  document.querySelectorAll('[data-page-link]').forEach((link) => {
    link.classList.toggle('is-active', link.dataset.pageLink === pageId);
  });

  document.body.classList.remove(...PAGE_IDS.map((pid) => `page-${pid}`));
  document.body.classList.add(`page-${pageId}`);

  if (updateHash && location.hash !== `#${pageId}`) {
    history.replaceState(null, '', `#${pageId}`);
  }

  window.scrollTo({ top: 0, left: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function setPopupState() {
  document.body.classList.toggle('popup-open', Boolean(editor && editor.open));
}

function openEditorPopup() {
  if (!editor) return;
  setActivePage('workspaceSection');
  editor.open = true;
  setPopupState();
  setTimeout(() => nameInput && focusIntoView(nameInput), 180);
}

function closeEditorPopup() {
  if (!editor) return;
  editor.open = false;
  setPopupState();
}

function focusIntoView(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  setTimeout(() => {
    el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }, 60);
}

function updateViewportLock() {
  const vv = window.visualViewport;
  const height = vv ? vv.height : window.innerHeight;
  document.documentElement.style.setProperty('--vvh', `${height}px`);

  if (!document.activeElement || !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    baseViewportHeight = Math.max(baseViewportHeight, height);
  }

  const keyboardOpen = height < baseViewportHeight - 120;
  document.body.classList.toggle('keyboard-open', keyboardOpen);

  if (keyboardOpen && document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
    setTimeout(() => document.activeElement.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 80);
  }
}

document.querySelectorAll('[data-page-link]').forEach((link) => {
  link.addEventListener('click', (event) => {
    event.preventDefault();
    setActivePage(link.dataset.pageLink);
  });
});

window.addEventListener('hashchange', () => {
  setActivePage(location.hash, false);
});

if (editor) {
  editor.open = false;
  editor.addEventListener('toggle', setPopupState);
  editor.querySelector('summary')?.addEventListener('click', (event) => {
    if (editor.open) {
      event.preventDefault();
      closeEditorPopup();
    }
  });
}

quick?.addEventListener('click', () => {
  if (!hasActiveReport()) return;
  setTimeout(openEditorPopup, 30);
});

form?.addEventListener('submit', () => setTimeout(closeEditorPopup, 80));
cancel?.addEventListener('click', () => setTimeout(closeEditorPopup, 80));

document.getElementById('reportForm')?.addEventListener('submit', () => {
  setTimeout(() => setActivePage('workspaceSection'), 120);
});

document.getElementById('reportList')?.addEventListener('click', (event) => {
  if (event.target.closest('[data-report-id]')) {
    setTimeout(() => setActivePage('workspaceSection'), 80);
  }
});

document.addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit-customer]');
  if (edit) setTimeout(openEditorPopup, 80);
});

document.addEventListener('focusin', (event) => {
  if (!event.target.matches('input, textarea, select')) return;
  setTimeout(() => event.target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' }), 120);
});

document.addEventListener('focusout', () => {
  setTimeout(updateViewportLock, 120);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && editor?.open) closeEditorPopup();
});

window.visualViewport?.addEventListener('resize', updateViewportLock);
window.visualViewport?.addEventListener('scroll', updateViewportLock);
window.addEventListener('resize', updateViewportLock);

function directToast(text) {
  const toast = document.getElementById('toast');
  if (!toast) return alert(text);
  toast.textContent = text;
  toast.classList.add('show');
  clearTimeout(directToast.t);
  directToast.t = setTimeout(() => toast.classList.remove('show'), 4200);
}

function getScriptUrl() {
  const state = readReportState();
  const url = (document.getElementById('sheetUrl')?.value || state.settings?.sheetEndpoint || '').trim();
  if (!url) {
    directToast('Vào Admin và dán Apps Script URL /exec trước.');
    setActivePage('adminSection');
    return '';
  }
  return url;
}

function directTestPayload() {
  const now = new Date().toISOString();
  return {
    action: 'testReport',
    source: 'Bepi direct GET fallback',
    submittedAt: now,
    settings: { createDriveFile: true, driveFolderId: '1DTIHNs8NzOATNHTId9G8qRaInHsXxtGO' },
    report: {
      id: 'test-' + Date.now(),
      kind: 'Test',
      date: now.slice(0, 10),
      market: 'TEST SHEET DRIVE',
      sales: 'Bepi App',
      note: 'Test trực tiếp từ app',
      createdAt: now,
      updatedAt: now,
      summary: { totalCustomers: 1, needSample: 0, follow: 0, bad: 0 }
    },
    products: ['Trà Đen', 'Trà Quả Mộng', 'Trà Gạo Rang', 'Trà Lài', 'Trà Olong', 'Trà Olong Sen'],
    customers: [{
      id: 'cus-' + Date.now(),
      name: 'Khách test',
      area: 'Test app',
      testType: 'Trà ONA Test',
      followDate: '',
      marketTags: ['Giá tốt'],
      note: 'Dòng test',
      tests: { 'Trà Đen': { status: 'ok', note: 'test ghi Sheet' } }
    }]
  };
}

function openPayload(payload) {
  const url = getScriptUrl();
  if (!url) return;
  const next = url + '?payload=' + encodeURIComponent(JSON.stringify(payload));
  window.open(next, '_blank', 'noopener,noreferrer');
  directToast('Đã mở tab Apps Script. Tab mới sẽ báo OK hoặc lỗi thật.');
}

document.getElementById('testSheetBtn')?.addEventListener('click', (event) => {
  event.preventDefault();
  event.stopImmediatePropagation();
  openPayload(directTestPayload());
}, true);

setActivePage(location.hash || 'createSection', false);
updateViewportLock();
setPopupState();
