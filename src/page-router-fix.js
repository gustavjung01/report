const shellPages = {
  mcp: { subtitle: 'MCP tuyến', nav: 'create' },
  'order-shell': { subtitle: 'Đơn hàng', nav: 'create' },
  'report-shell': { subtitle: 'Báo cáo', nav: 'create' }
};

function setPage(page) {
  const config = shellPages[page];
  if (!config) return false;
  document.querySelectorAll('.page').forEach((element) => element.classList.toggle('active', element.dataset.page === page));
  document.querySelectorAll('.nav button').forEach((button) => button.classList.toggle('active', button.dataset.page === config.nav));
  const subtitle = document.querySelector('#subtitle');
  if (subtitle) subtitle.textContent = config.subtitle;
  return true;
}

function isExplicitPageTrigger(element) {
  if (!element || !element.matches?.('[data-page]')) return false;
  if (element.matches('section.page')) return false;
  return element.matches('button, a, [role="button"], .card, .home-card, .nav button, .head button');
}

document.addEventListener('click', (event) => {
  const trigger = event.target.closest('button[data-page], a[data-page], [role="button"][data-page], .card[data-page], .home-card[data-page], .nav button[data-page], .head button[data-page]');
  if (!isExplicitPageTrigger(trigger)) return;
  const target = trigger.dataset.page;
  if (!shellPages[target]) return;
  if (!setPage(target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}, true);

window.addEventListener('DOMContentLoaded', () => {
  const active = document.querySelector('.page.active')?.dataset.page;
  if (active && shellPages[active]) setPage(active);
});
