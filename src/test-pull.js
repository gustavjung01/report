import { makeOnaTest, makeOnaTestItem, todayIsoDate } from '../data-model.js';
import { LOCAL_STORES, openLocalDb, putManyLocal } from '../local-db.js';

let cfg = { url: '', key: '' };

async function loadCfg() {
  const res = await fetch('/api/config', { cache: 'no-store' }).catch(() => null);
  if (!res || !res.ok) return false;
  const data = await res.json();
  cfg.url = String(data.supabaseUrl || '').replace('/rest/v1/', '').replace(/\/$/, '');
  cfg.key = data.supabaseKey || '';
  return Boolean(cfg.url && cfg.key && navigator.onLine);
}

async function table(name) {
  const res = await fetch(`${cfg.url}/rest/v1/${name}?select=*`, {
    headers: { apikey: cfg.key, Authorization: `Bearer ${cfg.key}` },
    cache: 'no-store'
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function pullTestFromSupabase() {
  await openLocalDb();
  if (!(await loadCfg())) return false;
  const files = await table('test_files');
  const products = await table('test_file_products');
  const customers = await table('test_customers');
  const results = await table('test_customer_results');
  const tests = [];
  for (const f of files) tests.push(makeOnaTest({ id: f.id, test_date: f.test_date || todayIsoDate(), sales: f.sales || '', customer_name: f.title || 'File test', overall_status: 'pending', overall_note: f.note || '', sync_status: 'synced', created_at: f.created_at, updated_at: f.updated_at, raw_payload: { kind: 'test_file' } }));
  for (const c of customers) tests.push(makeOnaTest({ id: c.id, test_date: String(c.created_at || todayIsoDate()).slice(0, 10), sales: '', customer_name: c.customer_name || '', customer_phone: c.phone || '', area: c.area || '', overall_status: c.status || 'pending', overall_note: c.note || '', sync_status: 'synced', created_at: c.created_at, updated_at: c.updated_at, raw_payload: { kind: 'test_customer', file_id: c.file_id } }));
  const items = [];
  for (const p of products) items.push(makeOnaTestItem({ id: p.id, test_id: p.file_id, product_id: p.id, product_name: p.product_name || '', status: 'pending', note: '', created_at: p.created_at, updated_at: p.updated_at, raw_payload: { kind: 'selected_product', source: 'supabase' } }));
  for (const r of results) items.push(makeOnaTestItem({ id: r.id, test_id: r.customer_id, product_id: r.product_id || '', product_name: r.product_name || '', status: r.status || 'pending', note: r.note || '', created_at: r.created_at, updated_at: r.updated_at }));
  await putManyLocal(LOCAL_STORES.onaTests, tests);
  await putManyLocal(LOCAL_STORES.onaTestItems, items);
  return true;
}

await pullTestFromSupabase().catch((error) => console.warn('pull test failed', error));
document.addEventListener('click', async (event) => {
  if (!event.target.closest('#syncBtn')) return;
  const ok = await pullTestFromSupabase().catch(() => false);
  if (ok) setTimeout(() => location.reload(), 250);
}, true);
