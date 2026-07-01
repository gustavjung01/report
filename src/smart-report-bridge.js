document.addEventListener('click', (event) => {
  const button = event.target.closest('#smartReportRun');
  if (!button) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  const page = document.querySelector('[data-page="ai"]');
  if (!page) return;
  const proxy = document.createElement('button');
  proxy.type = 'button';
  proxy.id = 'aiBtn';
  proxy.hidden = true;
  page.appendChild(proxy);
  proxy.click();
  setTimeout(() => proxy.remove(), 0);
}, true);
