import { LOCAL_STORES, getAllLocal } from '../local-db.js';

const LABELS = {
  pending: 'Chưa thử',
  ok: 'OK',
  interested: 'Quan tâm',
  sample: 'Cần mẫu',
  follow: 'Báo sau',
  bad: 'Chưa tốt',
  retry: 'Thử lại',
};

const escapeHtml = (value = '') => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  "'": '&#39;',
  '"': '&quot;',
}[char]));

const query = (selector) => document.querySelector(selector);

function normalizeStatus(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function statusTone(status) {
  const value = normalizeStatus(status);
  if (['ok', 'tot', 'good', 'dat'].includes(value)) return 'ok';
  if (['bad', 'retry', 'chua tot', 'thu lai', 'fail', 'not ok'].includes(value)) return 'bad';
  return 'warn';
}

function ensureCss() {
  if (query('#compactCss')) return;
  const style = document.createElement('style');
  style.id = 'compactCss';
  style.textContent = `
    #modal{width:min(420px,calc(100vw - 18px));max-height:calc(100dvh - 18px);overflow:hidden;padding:0;border-radius:18px}
    #modal::backdrop{background:rgba(8,35,55,.34)}
    .compact-modal{max-height:calc(100dvh - 18px);overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:0;background:#fff;border-radius:18px}
    .compact-modal header{position:sticky;top:0;z-index:3;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 15px 10px;background:linear-gradient(#fff 82%,rgba(255,255,255,.92));border-bottom:1px solid #edf3f1}
    .compact-modal h2{font-size:18px;line-height:1.2;margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .compact-modal header button{flex:0 0 auto;border:0;border-radius:999px;background:#eef5f2;padding:8px 12px;color:#082337;font-weight:750}
    .compact-list{padding:8px 12px 14px}
    .compact-customer{border:1px solid #dce8e5;border-radius:12px;padding:8px 10px;background:#fbfffd;margin-top:7px}
    .compact-customer b{font-size:14px}
    .compact-meta{font-size:11px;color:#63727c;margin-left:6px}
    .compact-results{display:flex;flex-wrap:wrap;gap:6px;margin-top:7px}
    .compact-result{display:inline-flex;align-items:center;gap:4px;max-width:100%;padding:3px 6px;border:1px solid #dce8e5;border-radius:999px;background:#fff;font-size:12px;line-height:1.25}
    .compact-product{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:128px}
    .compact-status{padding:2px 6px;border-radius:999px;border:1px solid transparent;font-size:11px;font-weight:850;white-space:nowrap}
    .compact-status.ok{background:#e7f9eb;color:#167c32;border-color:#bdeec9}
    .compact-status.warn{background:#fff7df;color:#9a5a00;border-color:#f1d17d}
    .compact-status.bad{background:#fff0ed;color:#c63b2e;border-color:#f3b7ad}
    .compact-note{font-size:11px;color:#63727c;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:92px}
    .compact-empty{margin:7px 0 0;font-size:12px;color:#63727c}
    @media(max-width:380px){.compact-product{max-width:104px}.compact-note{max-width:72px}.compact-list{padding-left:9px;padding-right:9px}}
  `;
  document.head.appendChild(style);
}

function resultHtml(result) {
  const label = LABELS[result.status] || result.status || 'Chưa thử';
  const tone = statusTone(result.status || label);
  return `
    <span class="compact-result">
      <span class="compact-product">${escapeHtml(result.product_name)}</span>
      <span class="compact-status ${tone}">${escapeHtml(label)}</span>
      ${result.note ? `<span class="compact-note">${escapeHtml(result.note)}</span>` : ''}
    </span>
  `;
}

async function openCompact(fileId) {
  ensureCss();

  const tests = await getAllLocal(LOCAL_STORES.onaTests);
  const items = await getAllLocal(LOCAL_STORES.onaTestItems);
  const file = tests.find((test) => test.id === fileId);
  const customers = tests.filter((test) => test.raw_payload && test.raw_payload.file_id === fileId);

  let html = `<div class="modal compact-modal"><header><h2>${escapeHtml(file?.customer_name || 'File test')}</h2><button type="button" data-close>Đóng</button></header><div class="compact-list">`;

  for (const customer of customers) {
    const results = items.filter((item) => item.test_id === customer.id);
    html += `
      <article class="compact-customer">
        <b>${escapeHtml(customer.customer_name)}</b>
        ${customer.area ? `<span class="compact-meta">${escapeHtml(customer.area)}</span>` : ''}
        ${customer.customer_phone ? `<span class="compact-meta">${escapeHtml(customer.customer_phone)}</span>` : ''}
        ${results.length ? `<div class="compact-results">${results.map(resultHtml).join('')}</div>` : '<p class="compact-empty">Chưa ghi kết quả sản phẩm.</p>'}
      </article>
    `;
  }

  html += `${customers.length ? '' : '<p class="empty">Chưa có khách.</p>'}</div></div>`;
  const modal = query('#modal');
  modal.innerHTML = html;
  modal.showModal();
}

document.addEventListener('click', (event) => {
  const detailButton = event.target.closest('[data-detail]');
  if (!detailButton) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openCompact(detailButton.dataset.detail);
}, true);
