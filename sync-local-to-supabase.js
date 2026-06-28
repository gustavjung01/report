(() => {
  const SETTINGS_KEY = 'bepi-field-report-v5';
  const TEST_FORM_KEY = 'bepi-local-test-forms-v1';
  const TEST_ROW_KEY = 'bepi-local-test-rows-v1';
  const MARKET_FORM_KEY = 'bepi-local-market-forms-v1';
  const MARKET_ROW_KEY = 'bepi-local-market-rows-v1';

  const $ = (selector, root = document) => root.querySelector(selector);

  function toast(message) {
    const node = $('#toast');
    if (!node) return;
    node.textContent = message;
    node.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove('show'), 2600);
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

  function config() {
    const stored = readJson(SETTINGS_KEY, { settings: {} });
    const cfg = window.BEPI_CONFIG || {};
    const supabaseUrl = String(stored.settings?.supabaseUrl || cfg.supabaseUrl || '').replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
    const supabaseAnonKey = String(stored.settings?.supabaseAnonKey || cfg.supabaseAnonKey || '').trim();
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
    const response = await fetch(url, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(cleanRows)
    });
    const text = await response.text();
    if (!response.ok) {
      let message = text;
      try { message = JSON.parse(text).message || message; } catch {}
      throw new Error(`${table}: ${message || response.status}`);
    }
    return cleanRows.length;
  }

  function testRowsForDb() {
    const forms = readArray(TEST_FORM_KEY);
    const rows = readArray(TEST_ROW_KEY);
    const formById = Object.fromEntries(forms.map((form) => [form.id, form]));

    const tests = rows.map((row) => {
      const form = formById[row.form_id] || {};
      const productResults = Array.isArray(row.product_results) ? row.product_results : [];
      return {
        id: row.id || uid('ona-test'),
        test_date: form.test_date || row.test_date || new Date().toISOString().slice(0, 10),
        sales: form.sales || row.sales || '',
        customer_id: '',
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
        created_at: row.created_at || form.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      };
    });

    const items = [];
    rows.forEach((row) => {
      const productResults = Array.isArray(row.product_results) ? row.product_results : [];
      productResults.forEach((item, index) => {
        items.push({
          id: `${row.id || uid('test-row')}-${item.product_id || index}`.replace(/[^a-zA-Z0-9_-]/g, '-'),
          test_id: row.id,
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
          created_at: row.created_at || new Date().toISOString()
        });
      });
    });

    return { tests, items, formsCount: forms.length, rowsCount: rows.length };
  }

  function marketRowsForDb() {
    const forms = readArray(MARKET_FORM_KEY);
    const rows = readArray(MARKET_ROW_KEY);
    const formById = Object.fromEntries(forms.map((form) => [form.id, form]));

    const reports = rows.map((row) => {
      const form = formById[row.form_id] || {};
      return {
        id: row.id || uid('market-report'),
        report_date: form.report_date || row.report_date || new Date().toISOString().slice(0, 10),
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
        raw_payload: { form, row },
        created_at: row.created_at || form.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
        synced_at: new Date().toISOString()
      };
    });

    return { reports, formsCount: forms.length, rowsCount: rows.length };
  }

  async function syncLocalToSupabase() {
    const button = $('#syncQueueBtn');
    const status = $('#localDialog .muted-note');
    if (button) {
      button.disabled = true;
      button.textContent = 'Đang đồng bộ...';
    }
    try {
      const test = testRowsForDb();
      const market = marketRowsForDb();

      let count = 0;
      count += await upsert('ona_tests', test.tests);
      count += await upsert('ona_test_items', test.items);
      count += await upsert('market_reports', market.reports);

      if (status) status.textContent = `Đã đẩy ${count} dòng lên Supabase. Test: ${test.rowsCount} khách, Báo cáo: ${market.rowsCount} khách.`;
      toast(`Đã đồng bộ ${count} dòng lên Supabase.`);
    } catch (error) {
      if (status) status.textContent = error.message || 'Đồng bộ lỗi.';
      toast('Đồng bộ lỗi.');
    } finally {
      if (button) {
        button.disabled = false;
        button.textContent = 'Đồng bộ lên Supabase';
      }
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
