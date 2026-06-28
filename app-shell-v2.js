import { readSupabaseSettings, configureSupabaseV2, isSupabaseV2Ready } from './supabase-v2.js';

const PAGE_TITLES = {
  createSection: 'Tạo dữ liệu mới',
  dataSection: 'Dữ liệu đã tạo',
  aiSection: 'AI tổng hợp',
  adminSection: 'Admin'
};

const root = document.querySelector('.phone-shell');
const navLinks = Array.from(document.querySelectorAll('[data-page-link]'));
const pages = Array.from(document.querySelectorAll('.app-page'));
const toast = document.getElementById('toast');
const headerSubtitle = document.getElementById('headerSubtitle');
const dbStatusPill = document.getElementById('dbStatusPill');

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function setPage(pageId, push = true) {
  const target = document.getElementById(pageId) ? pageId : 'createSection';
  pages.forEach((page) => page.classList.toggle('is-active', page.id === target));
  navLinks.forEach((link) => link.classList.toggle('is-active', link.dataset.pageLink === target));
  if (root) root.dataset.activePage = target;
  if (headerSubtitle) headerSubtitle.textContent = PAGE_TITLES[target] || 'Bếp Sỉ Báo Cáo';
  if (push && location.hash !== `#${target}`) history.replaceState(null, '', `#${target}`);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function restorePageFromHash() {
  const id = location.hash.replace('#', '') || 'createSection';
  setPage(id, false);
}

function bindNavigation() {
  document.addEventListener('click', (event) => {
    const link = event.target.closest('[data-page-link]');
    const jump = event.target.closest('[data-page-jump]');
    if (!link && !jump) return;
    event.preventDefault();
    setPage(link?.dataset.pageLink || jump.dataset.pageJump);
  });
  window.addEventListener('hashchange', restorePageFromHash);
  restorePageFromHash();
}

function bindDataTabs() {
  const buttons = Array.from(document.querySelectorAll('[data-data-view]'));
  const panels = Array.from(document.querySelectorAll('[data-data-panel]'));
  buttons.forEach((button) => {
    button.addEventListener('click', () => {
      const view = button.dataset.dataView;
      buttons.forEach((item) => item.classList.toggle('is-active', item === button));
      panels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.dataPanel === view));
    });
  });
}

function bindDialogs() {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-open-dialog]');
    if (opener) {
      const dialog = document.getElementById(opener.dataset.openDialog);
      if (dialog?.showModal) dialog.showModal();
      else dialog?.setAttribute('open', '');
      return;
    }
    const closer = event.target.closest('[data-close-dialog]');
    if (closer) {
      const dialog = closer.closest('dialog');
      if (dialog?.close) dialog.close();
      else dialog?.removeAttribute('open');
    }
  });
}

function isUnsafeKey(value = '') {
  return /sb_secret_|service_role/i.test(String(value));
}

function updateSupabasePreview() {
  const settings = readSupabaseSettings();
  configureSupabaseV2(settings);
  const ready = isSupabaseV2Ready() && !isUnsafeKey(settings.supabaseAnonKey);
  const urlInput = document.getElementById('supabaseUrl');
  const keyInput = document.getElementById('supabaseAnonKey');
  const preview = document.getElementById('supabasePreviewStatus');
  if (urlInput) urlInput.value = settings.supabaseUrl || '';
  if (keyInput) keyInput.value = settings.supabaseAnonKey || '';
  if (preview) {
    preview.innerHTML = ready
      ? `URL Project: ${settings.supabaseUrl}<br />Anon Key: đã lưu`
      : 'URL Project: -<br />Anon Key: -';
  }
  if (dbStatusPill) {
    dbStatusPill.classList.toggle('off', !ready);
    dbStatusPill.querySelector('b').textContent = ready ? 'Đã nối Supabase' : 'Chưa nối Supabase';
  }
}

function bindSupabaseMockActions() {
  const save = document.getElementById('saveSupabaseBtn');
  const test = document.getElementById('testSupabaseBtn');
  const status = document.getElementById('supabaseStatus');
  save?.addEventListener('click', () => {
    const url = document.getElementById('supabaseUrl')?.value?.trim() || '';
    const key = document.getElementById('supabaseAnonKey')?.value?.trim() || '';
    if (isUnsafeKey(key)) {
      if (status) status.textContent = 'Sai key: không dùng service_role/sb_secret trong PWA.';
      showToast('Không lưu secret key trong PWA.');
      return;
    }
    const current = JSON.parse(localStorage.getItem('bepi-field-report-v5') || '{"settings":{}}');
    current.settings = { ...(current.settings || {}), supabaseUrl: url, supabaseAnonKey: key };
    localStorage.setItem('bepi-field-report-v5', JSON.stringify(current));
    updateSupabasePreview();
    if (status) status.textContent = 'Đã lưu cấu hình Supabase trên máy này.';
    showToast('Đã lưu DB.');
  });
  test?.addEventListener('click', () => {
    updateSupabasePreview();
    showToast(isSupabaseV2Ready() ? 'Cấu hình DB đã sẵn sàng.' : 'Chưa đủ URL/key Supabase.');
  });
}

function bindCreateCards() {
  document.querySelectorAll('[data-create-type]').forEach((card) => {
    card.addEventListener('click', () => {
      const labels = {
        order: 'Form Đơn hàng sẽ làm ở Phase 3.',
        test: 'Form Test sản phẩm sẽ làm ở Phase 4.',
        market: 'Form Báo cáo thị trường sẽ làm ở Phase 5.'
      };
      showToast(labels[card.dataset.createType] || 'Đã chọn nghiệp vụ.');
    });
  });
}

function bindAiMock() {
  document.getElementById('mockAiButton')?.addEventListener('click', () => {
    showToast('AI tổng hợp mẫu. Phase 7 sẽ nối dữ liệu thật.');
  });
}

bindNavigation();
bindDataTabs();
bindDialogs();
bindSupabaseMockActions();
bindCreateCards();
bindAiMock();
updateSupabasePreview();
