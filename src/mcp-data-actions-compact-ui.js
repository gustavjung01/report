function installStyle() {
  let style = document.querySelector('style[data-mcp-data-actions-compact]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpDataActionsCompact = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    #dataShell.active .mcp-route-export-row{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin:0 0 8px!important;position:relative!important;z-index:1!important}
    #dataShell.active .mcp-route-export-row button{min-height:32px!important;border-radius:10px!important;font-size:11px!important;font-weight:900!important;padding:6px 8px!important}
    #dataShell.active .mcp-route-admin-row{display:none!important}
    #dataShell.active .data-shell-open-card{margin-top:0!important}
    @media(max-width:380px){#dataShell.active .mcp-route-export-row{grid-template-columns:1fr!important}}
  `;
}

function compactMcpDataActions() {
  installStyle();
  const shell = document.querySelector('#dataShell.active');
  const mcpTab = document.querySelector('#dataHub [data-data-view="mcp"].active');
  if (!shell || !mcpTab) return;

  const rows = [...shell.querySelectorAll('.mcp-route-export-row')];
  rows.slice(1).forEach((row) => row.remove());
  const row = rows[0];
  if (!row) return;

  [...row.querySelectorAll('[data-mcp-start]')].forEach((button) => button.remove());
  [...shell.querySelectorAll('.mcp-route-admin-row')].forEach((item) => item.remove());

  if (!row.querySelector('[data-mcp-route-admin]')) {
    row.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-mcp-route-admin>Quản trị tuyến</button>');
  }

  const startButtons = [...shell.querySelectorAll('[data-mcp-start]')];
  startButtons.slice(1).forEach((button) => button.remove());
}

function schedule() {
  clearTimeout(schedule.timer);
  schedule.timer = setTimeout(compactMcpDataActions, 120);
}

installStyle();
window.addEventListener('DOMContentLoaded', schedule);
window.addEventListener('mcp:session-changed', schedule);
document.addEventListener('click', schedule, true);
setInterval(schedule, 1200);
schedule();
