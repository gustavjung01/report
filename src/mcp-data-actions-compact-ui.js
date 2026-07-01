function installStyle() {
  let style = document.querySelector('style[data-mcp-data-actions-compact]');
  if (!style) {
    style = document.createElement('style');
    style.dataset.mcpDataActionsCompact = '1';
    document.head.appendChild(style);
  }
  style.textContent = `
    #dataShell.active.mcp-data-compact .data-shell-kpis{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:0 0 8px!important}
    #dataShell.active.mcp-data-compact .data-shell-kpi{min-height:52px!important;padding:7px 6px!important;border-radius:12px!important;display:grid!important;align-content:center!important;gap:2px!important}
    #dataShell.active.mcp-data-compact .data-shell-kpi b{font-size:18px!important;line-height:1!important}
    #dataShell.active.mcp-data-compact .data-shell-kpi span{font-size:10px!important;line-height:1.15!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #dataShell.active.mcp-data-compact .mcp-route-export-row{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;margin:0 0 8px!important;position:relative!important;z-index:1!important}
    #dataShell.active.mcp-data-compact .mcp-route-export-row button{min-height:32px!important;border-radius:10px!important;font-size:10.5px!important;font-weight:900!important;padding:6px 5px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
    #dataShell.active.mcp-data-compact .mcp-route-admin-row{display:none!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card{margin-top:0!important;padding:9px 10px!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card .data-shell-open-btn{display:none!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card h3{font-size:13px!important;margin-bottom:2px!important}
    #dataShell.active.mcp-data-compact .data-shell-open-card small{font-size:11px!important;line-height:1.25!important}
    @media(max-width:360px){#dataShell.active.mcp-data-compact .mcp-route-export-row button{font-size:10px!important;padding-inline:3px!important}}
  `;
}

function ensureActionRow(shell) {
  const openCard = shell.querySelector('.data-shell-open-card');
  let row = shell.querySelector('.mcp-route-export-row');
  if (!row && openCard) {
    openCard.insertAdjacentHTML('beforebegin', '<div class="mcp-route-export-row"></div>');
    row = shell.querySelector('.mcp-route-export-row');
  }
  if (!row) return null;
  [...shell.querySelectorAll('.mcp-route-export-row')].forEach((item) => {
    if (item !== row) item.remove();
  });
  return row;
}

function compactMcpDataActions() {
  installStyle();
  const shell = document.querySelector('#dataShell.active');
  const mcpTab = document.querySelector('#dataHub [data-data-view="mcp"].active');
  if (!shell || !mcpTab) {
    document.querySelector('#dataShell.mcp-data-compact')?.classList.remove('mcp-data-compact');
    return;
  }

  shell.classList.add('mcp-data-compact');
  const row = ensureActionRow(shell);
  if (!row) return;

  [...shell.querySelectorAll('.mcp-route-admin-row')].forEach((item) => item.remove());
  [...row.querySelectorAll('[data-mcp-start]')].forEach((button) => button.remove());

  if (!row.querySelector('[data-mcp-export-routes]')) {
    row.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-mcp-export-routes>Xuất tuyến</button>');
  }
  if (!row.querySelector('[data-mcp-route-admin]')) {
    row.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-mcp-route-admin>Quản trị tuyến</button>');
  }
  if (!row.querySelector('[data-mcp-start]')) {
    row.insertAdjacentHTML('beforeend', '<button type="button" class="secondary" data-mcp-start>Bắt đầu phiên</button>');
  }

  const seen = new Set();
  [...row.querySelectorAll('button')].forEach((button) => {
    const key = button.dataset.mcpExportRoutes ? 'export' : button.dataset.mcpRouteAdmin ? 'admin' : button.dataset.mcpStart !== undefined ? 'start' : button.textContent.trim();
    if (seen.has(key)) button.remove();
    else seen.add(key);
  });

  const startButtons = [...shell.querySelectorAll('[data-mcp-start]')];
  startButtons.forEach((button) => {
    if (!row.contains(button)) button.remove();
  });
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
