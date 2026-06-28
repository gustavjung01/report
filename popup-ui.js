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
  if (clean === 'supabaseSection') return 'adminSection';
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

setActivePage(location.hash || 'createSection', false);
updateViewportLock();
setPopupState();
