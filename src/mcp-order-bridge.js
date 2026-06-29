function mountMcpOrderBridgeStyle() {
  let style = document.querySelector('style[data-mcp-order-bridge]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpOrderBridge = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] [data-mcp-create-order]{
      border-color:#ffd8a8!important;
      background:#fff8ef!important;
      color:#b95f00!important;
    }
  `;
}

function ensureMcpOrderButtons() {
  const section = document.querySelector('section.page[data-page="mcp"]');
  if (!section) return;
  section.querySelectorAll('.mcp-customer[data-customer-id]').forEach((card) => {
    if (card.querySelector('[data-mcp-create-order]')) return;
    const customerId = card.dataset.customerId || '';
    const target = card.querySelector('.mcp-manage-actions') || card.querySelector('.mcp-actions');
    if (!target || !customerId) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.mcpCreateOrder = '1';
    button.dataset.customerId = customerId;
    button.textContent = '+ Đơn';
    target.appendChild(button);
  });
}

function handleClick(event) {
  const button = event.target.closest('[data-mcp-create-order]');
  if (!button || !button.closest('section.page[data-page="mcp"]')) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.dispatchEvent(new CustomEvent('mcp:order-request', { detail: { customerId: button.dataset.customerId || '' } }));
}

function boot() {
  mountMcpOrderBridgeStyle();
  ensureMcpOrderButtons();
}

window.addEventListener('click', handleClick, true);
window.addEventListener('mcp:session-changed', () => setTimeout(ensureMcpOrderButtons, 0));
const observer = new MutationObserver(() => ensureMcpOrderButtons());
observer.observe(document.documentElement, { childList: true, subtree: true });
boot();
window.addEventListener('DOMContentLoaded', boot);
