function attachStyles() {
  if (!document.querySelector('link[data-ui-polish]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'src/polish.css';
    link.dataset.uiPolish = 'true';
    document.head.appendChild(link);
  }
  if (!document.querySelector('style[data-test-fixes]')) {
    const style = document.createElement('style');
    style.dataset.testFixes = 'true';
    style.textContent = '.hero{display:none}.result-line{display:grid;grid-template-columns:1fr auto;gap:6px 10px;align-items:center;margin-top:8px;padding:9px 10px;border:1px solid #dce9e6;border-radius:12px;background:#fbfffd}.result-line span{font-weight:750}.result-line b{font-size:12px;color:#007866}.result-line small{grid-column:1/-1;color:#63727c}';
    document.head.appendChild(style);
  }
}

function focusTestFirstShell() {
  const title = document.querySelector('.hero h1');
  const desc = document.querySelector('.hero p');
  if (title) title.textContent = 'Test sản phẩm';
  if (desc) desc.textContent = 'Tạo file test tổng, nhập đúng sản phẩm cần test rồi qua Dữ liệu để thêm khách.';

  document.querySelectorAll('.card').forEach((card) => {
    const text = card.textContent || '';
    if (text.includes('File test') || text.includes('Test sản phẩm')) {
      card.removeAttribute('data-open');
      card.setAttribute('data-open-test', '');
      const titleNode = card.querySelector('b');
      const small = card.querySelector('small');
      const cta = card.querySelector('em');
      if (titleNode) titleNode.textContent = 'File test tổng';
      if (small) small.textContent = 'Nhập thủ công sản phẩm cần test. Không lấy nguồn Bếp Sỉ.';
      if (cta) cta.textContent = 'Tạo file test';
    } else {
      card.classList.add('is-hidden');
    }
  });

  document.querySelectorAll('[data-page="ai"]').forEach((el) => {
    if (el.matches('button')) el.classList.add('is-hidden');
  });

  const dataTitle = document.querySelector('[data-page="data"] h1');
  if (dataTitle) dataTitle.textContent = 'Dữ liệu test';

  const tabs = document.querySelector('.tabs');
  if (tabs) tabs.classList.add('is-hidden');

  const warn = document.querySelector('.warn');
  if (warn) warn.textContent = 'Giai đoạn này tối ưu riêng Test. Supabase giữ tạm, chưa làm lại schema.';
}

attachStyles();
window.addEventListener('DOMContentLoaded', focusTestFirstShell);
setTimeout(focusTestFirstShell, 300);
