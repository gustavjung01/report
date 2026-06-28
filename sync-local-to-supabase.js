(() => {
  const SETTINGS_KEY = 'bepi-field-report-v5';
  const TEST_FORM_KEY = 'bepi-local-test-forms-v1';
  const TEST_ROW_KEY = 'bepi-local-test-rows-v1';
  const MARKET_FORM_KEY = 'bepi-local-market-forms-v1';
  const MARKET_ROW_KEY = 'bepi-local-market-rows-v1';
  const FIXED_SUPABASE_URL = 'https://noiadkpkvdohljgopgfb.supabase.co';
  const FIXED_SUPABASE_KEY = ['sb_publishable_n6LXv', '-fd-ImF3XzeU2mrjg', '_G7tBGy66'].join('');

  const $ = (selector, root = document) => root.querySelector(selector);
  const now = () => new Date().toISOString();
  const today = () => new Date().toISOString().slice(0, 10);

  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 3000);
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function readArray(key) {
    const rows = readJson(key, []);
    return Array.isArray(rows) ? rows : [];
  }

  function uid(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function slug(value = 'x') {
    return String(value || 'x')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'x';
  }

  function stableCustomerId(row = {}, form = {}) {
    const name = row.customer_name || row.name || '';
    const phone = row.customer_phone || row.phone || '';
    const area = row.area || form.route || form.area || '';
    if (!name && !phone) return null;
    return `cust-${slug(name)}-${slug(phone || area)}`.slice(0, 90);
  }

  function config() {
    const cfg = window.BEPI_CONFIG || {};
    const stored = readJson(SETTINGS_KEY, { settings: {} });
    const supabaseUrl = String(cfg.supabaseUrl || stored.settings?.supabaseUrl || FIXED_SUPABASE_URL).replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const supabaseAnonKey = String(cfg.supabaseAnonKey || stored.settings?.supabaseAnonKey || FIXED_SUPABASE_KEY).trim();
    return { supabaseUrl, supabaseAnonKey };
  }

  function headers() {
    const { supabaseAnonKey } = config();
    if (!supabaseAnonKey) throw new Error('Thiếu Supabase anon key.');
    return {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal'
    };
  }

  async function upsert(table, rows, conflict = 'id') {
    const cleanRows = rows.filter(Boolean);
    if (!cleanRows.length) return 0;
    const { supabaseUrl } = config();
    if (!supabaseUrl) throw new Error('Thiếu Supabase URL.');
    const url = `${supabaseUrl}/rest/v1/${table}?on_conflict=${encodeURIComponent(conflict)}`;
    const response = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(cleanRows) });
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try { message = JSON.parse(text).message || message; } catch {}
      throw new Error(`${table}: ${message || response.status}`);
    }
    return cleanRows.length;
  }

  function collectCustomers(testRows, marketRows, testFormById, marketFormById) {
    const map = new Map();
    const add = (row, form, source) => {
      const id = stableCustomerId(row, form);
      if (!id || map.has(id)) return id;
      map.set(id, {
        id,
        name: row.customer_name || row.name || 'Khách chưa tên',
        phone: row.customer_phone || row.phone || '',
        area: row.area || form.route || form.area || '',
        address: row.address || '',
        shop_type: row.shop_type || '',
        note: row.note || row.general_note || '',
        tags: [source],
        raw_payload: { source, row, form },
        created_at: row.created_at || form.created_at || now(),
        updated_at: now()
      });
      return id;
    };
    testRows.forEach((row) => add(row, testFormById[row.form_id] || {}, 'test'));
    marketRows.forEach((row) => add(row, marketFormById[row.form_id] || {}, 'market'));
    return Array.from(map.values());
  }

  function testRowsForDb(testFormById) {
    const rows = readArray(TEST_ROW_KEY);
    const tests = rows.map((row) => {
      const form = testFormById[row.form_id] || {};
      const productResults = Array.isArray(row.product_results) ? row.product_results : [];
      return {
        id: row.id || uid('ona-test'),
        test_date: form.test_date || row.test_date || today(),
        sales: form.sales || row.sales || '',
        customer_id: stableCustomerId(row, form),
        customer_name: row.customer_name || '',
        customer_phone: row.customer_phone || '',
        area: row.area || form.route || '',
        shop_type: row.shop_type || '',
        test_type: 'Test sản phẩm',
        follow_date: null,
        need_sample: productResults.some((item) => item.need_sample),
        overall_status: productResults.some((item) => item.result === 'bad') ? 'bad' : 'pending',
        overall_note: row.general_note || form.note || '',
        sync_status: 'synced',
        raw_payload: { form, row },
        created_at: row.created_at || form.created_at || now(),
        updated_at: now(),
        synced_at: now()
      };
    });

    const items = [];
    rows.forEach((row) => {
      const productResults = Array.isArray(row.product_results) ? row.product_results : [];
      const testId = row.id || uid('ona-test');
      productResults.forEach((item, index) => {
        items.push({
          id: `${testId}-${item.product_id || index}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
          test_id: testId,
          product_id: item.product_id || '',
          product_name: item.product_name || '',
          status: item.result || 'pending',
          note: [
            item.tried ? 'Đã thử' : '',
            item.liked ? 'Khách thích' : '',
            item.need_sample ? 'Cần mẫu' : '',
            item.price_ok ? 'Giá OK' : '',
            item.other_feedback || '',
            item.next_action ? `Tiếp theo: ${item.next_action}` : ''
          ].filter(Boolean).join(' · '),
          created_at: row.created_at || now()
        });
      });
    });

    return { tests, items, rowsCount: rows.length };
  }

  function marketRowsForDb(marketFormById) {
    const rows = readArray(MARKET_ROW_KEY);
    const reports = rows.map((row) => {
      const form = marketFormById[row.form_id] || {};
      return {
        id: row.id || uid('market-report'),
        report_date: form.report_date || row.report_date || today(),
        sales: form.sales || row.sales || '',
        market_area: row.area || form.route || '',
        route_name: form.route || '',
        market_type: row.shop_type || '',
        total_shops: 1,
        competitor_summary: row.competitor || '',
        price_summary: row.note || '',
        demand_summary: row.demand || '',
        company_product_summary: '',
        opportunity_summary: row.opportunity || '',
        risk_summary: '',
        next_action: row.next_action || '',
        note: [form.title || '', row.customer_name || '', row.customer_phone || '', row.note || ''].filter(Boolean).join(' · '),
        sync_status: 'synced',
        raw_payload: { form, row, customer_id: stableCustomerId(row, form) },
        created_at: row.created_at || form.created_at || now(),
        updated_at: now(),
        synced_at: now()
      };
    });
    return { reports, rowsCount: rows.length };
  }

  async function syncLocalToSupabase() {
    const button = $('#syncQueueBtn');
    const status = $('#localDialog .muted-note');
    if (button) { button.disabled = true; button.textContent = 'Đang đồng bộ...'; }
    try {
      const testForms = readArray(TEST_FORM_KEY);
      const marketForms = readArray(MARKET_FORM_KEY);
      const testRows = readArray(TEST_ROW_KEY);
      const marketRows = readArray(MARKET_ROW_KEY);
      const testFormById = Object.fromEntries(testForms.map((form) => [form.id, form]));
      const marketFormById = Object.fromEntries(marketForms.map((form) => [form.id, form]));
      const customers = collectCustomers(testRows, marketRows, testFormById, marketFormById);
      const test = testRowsForDb(testFormById);
      const market = marketRowsForDb(marketFormById);

      let count = 0;
      count += await upsert('customers_master', customers);
      count += await upsert('ona_tests', test.tests);
      count += await upsert('ona_test_items', test.items);
      count += await upsert('market_reports', market.reports);

      if (status) status.textContent = `Đã đẩy ${count} dòng lên Supabase. Khách: ${customers.length}, Test: ${test.rowsCount}, Báo cáo: ${market.rowsCount}.`;
      toast(`Đã đồng bộ ${count} dòng.`);
    } catch (error) {
      if (status) status.textContent = error.message || 'Đồng bộ lỗi.';
      toast(error.message || 'Đồng bộ lỗi.');
      console.error('Sync Supabase error:', error);
    } finally {
      if (button) { button.disabled = false; button.textContent = 'Đồng bộ lên Supabase'; }
    }
  }

  function init() {
    const button = $('#syncQueueBtn');
    if (!button) return;
    button.textContent = 'Đồng bộ lên Supabase';
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      syncLocalToSupabase();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
