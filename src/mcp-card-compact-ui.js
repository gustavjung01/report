function mountMcpCardCompactUi() {
  let style = document.querySelector('style[data-mcp-card-compact-ui]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpCardCompactUi = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    section.page[data-page="mcp"] .mcp-list{
      gap:6px!important;
    }
    section.page[data-page="mcp"] .mcp-customer{
      padding:7px 8px!important;
      border-radius:14px!important;
      box-shadow:0 5px 12px rgba(12,55,50,.04)!important;
    }
    section.page[data-page="mcp"] .mcp-customer-head{
      gap:7px!important;
      align-items:start!important;
    }
    section.page[data-page="mcp"] .mcp-customer-head>div{
      min-width:0!important;
      overflow:hidden!important;
    }
    section.page[data-page="mcp"] .mcp-customer h3{
      font-size:14px!important;
      line-height:1.06!important;
      margin:0 0 1px!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    section.page[data-page="mcp"] .mcp-customer small{
      font-size:10.5px!important;
      line-height:1.08!important;
    }
    section.page[data-page="mcp"] .mcp-customer-head small{
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    section.page[data-page="mcp"] .mcp-badge{
      padding:3px 6px!important;
      font-size:9.5px!important;
      line-height:1.1!important;
    }
    section.page[data-page="mcp"] .mcp-note{
      margin-top:2px!important;
      font-size:10px!important;
      line-height:1.05!important;
      color:#74818a!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
    }
    section.page[data-page="mcp"] .mcp-location{
      margin-top:0!important;
      font-size:10px!important;
      line-height:1.05!important;
      white-space:nowrap!important;
      overflow:hidden!important;
      text-overflow:ellipsis!important;
      color:#63727c!important;
    }
    section.page[data-page="mcp"] .mcp-location a,
    section.page[data-page="mcp"] .mcp-note a{
      font-size:10px!important;
      font-weight:850!important;
      color:#2167da!important;
      text-decoration:underline!important;
    }
    section.page[data-page="mcp"] .mcp-actions{
      gap:4px!important;
      margin-top:5px!important;
    }
    section.page[data-page="mcp"] .mcp-actions button{
      min-height:28px!important;
      border-radius:8px!important;
      font-size:10px!important;
      line-height:1!important;
      padding:0 2px!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions{
      gap:4px!important;
      margin-top:4px!important;
    }
    section.page[data-page="mcp"] .mcp-manage-actions button{
      min-height:26px!important;
      border-radius:8px!important;
      font-size:10px!important;
      line-height:1!important;
      padding:0 3px!important;
    }
  `;
}

function compactMcpLocationText(root = document) {
  const locations = root.querySelectorAll?.('section.page[data-page="mcp"] .mcp-location') || [];
  locations.forEach((item) => {
    if (item.dataset.compactMcpLocation === '1') return;
    const link = item.querySelector('a[href]');
    if (!link) return;
    link.textContent = 'Google Maps';
    const note = item.previousElementSibling?.classList?.contains('mcp-note') ? item.previousElementSibling : null;
    if (note) {
      note.insertAdjacentHTML('beforeend', ` <span aria-hidden="true">·</span> 📍 ${link.outerHTML}`);
      item.remove();
      return;
    }
    item.innerHTML = `📍 ${link.outerHTML}`;
    item.dataset.compactMcpLocation = '1';
  });
}

let observer = null;
function observeMcpCards() {
  const page = document.querySelector('section.page[data-page="mcp"]');
  if (!page || observer) return;
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) compactMcpLocationText(node);
      });
    }
    compactMcpLocationText(page);
  });
  observer.observe(page, { childList: true, subtree: true });
}

function bootMcpCardCompactUi() {
  mountMcpCardCompactUi();
  compactMcpLocationText();
  observeMcpCards();
}

bootMcpCardCompactUi();
window.addEventListener('DOMContentLoaded', bootMcpCardCompactUi);
window.addEventListener('mcp:session-changed', () => setTimeout(bootMcpCardCompactUi, 0));
