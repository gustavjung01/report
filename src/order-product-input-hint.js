function ensureProductInputHintCss() {
  if (document.querySelector('style[data-order-product-input-hint]')) return;
  const style = document.createElement('style');
  style.dataset.orderProductInputHint = '1';
  style.textContent = `
    #modal[data-type="order-create"] input[data-order-product]{
      padding-right:38px!important;
      border-color:#b9ddd4!important;
      background-color:#fbfffd!important;
      background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 18 18'%3E%3Cpath fill='%23007866' d='M4.2 6.6 9 11.4l4.8-4.8 1.1 1.1L9 13.6 3.1 7.7z'/%3E%3C/svg%3E")!important;
      background-repeat:no-repeat!important;
      background-position:right 10px center!important;
      background-size:18px 18px!important;
    }
    #modal[data-type="order-create"] input[data-order-product]:focus{
      border-color:#00957f!important;
      box-shadow:0 0 0 3px rgba(0,149,127,.12)!important;
      outline:0!important;
    }
  `;
  document.head.appendChild(style);
}

function removeCatalogLoadedNoise(modal) {
  modal.querySelectorAll('.data-shell-note, small').forEach((node) => {
    const text = (node.textContent || '').trim();
    if (/^Đã nạp\s+\d+\s+mã sản phẩm chuẩn từ Bếp Sỉ/i.test(text)) node.remove();
  });
}

function tuneProductInputs(root = document) {
  const modal = root.querySelector?.('#modal[data-type="order-create"]') || document.querySelector('#modal[data-type="order-create"]');
  if (!modal) return;
  removeCatalogLoadedNoise(modal);
  modal.querySelectorAll('input[data-order-product]').forEach((input) => {
    input.placeholder = 'Nhập tay / tìm SKU ▾';
    input.title = 'Có thể nhập tay nếu sản phẩm chưa có trong data, hoặc bấm + Chọn sản phẩm để lọc/chọn nhiều mã.';
    input.setAttribute('aria-label', 'Sản phẩm, có thể nhập tay hoặc chọn từ catalog');
  });
}

function bootProductInputHint() {
  ensureProductInputHintCss();
  tuneProductInputs();
  const observer = new MutationObserver(() => tuneProductInputs());
  observer.observe(document.body, { childList: true, subtree: true });
}

bootProductInputHint();
window.addEventListener('DOMContentLoaded', bootProductInputHint);
