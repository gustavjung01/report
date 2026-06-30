import { LOCAL_STORES, getAllLocal, getLocal, putLocal, putManyLocal } from '../local-db.js';

const CATALOG_VERSION = 'bepsi-hung-phat-v2-safe-1';
const SOURCE_PRODUCTS_URL = 'https://raw.githubusercontent.com/gustavjung01/F-B-Order/main/data/catalog/hung-phat/v2/products.csv';
const SOURCE_REPO = 'gustavjung01/F-B-Order';
const DISABLED_SOURCE_KEYS = new Set([
  'siro-gtp-dau-duong-den-bgkq-0007',
  'siro-sam-dua-vina-bgkq-0009'
]);

const CATEGORY_MAP = {
  siro: ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Siro', 'siro'],
  'sinh-to-berino': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Sinh tố', 'sinh-to'],
  'sinh-to-glod': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Sinh tố', 'sinh-to'],
  'sinh-to-vina-650gram': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Sinh tố', 'sinh-to'],
  'duong-den': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Đường đen', 'duong-den'],
  'tran-chau': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Trân châu', 'tran-chau'],
  '3q-gion': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', '3Q / thạch', 'thach-3q'],
  'sot-topping': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Sốt topping', 'sot-topping'],
  'trai-cay-hop': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Trái cây hộp', 'trai-cay-hop'],
  'rau-cau': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Rau câu', 'rau-cau'],
  flan: ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Flan / pudding', 'flan-pudding'],
  'bot-sua': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Bột sữa / kem béo', 'bot-sua-kem-beo'],
  'sua-dac': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Sữa đặc', 'sua-dac'],
  'bot-cacao': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Bột cacao / tạo vị', 'bot-tao-vi'],
  'tra-cac-loai': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Trà', 'tra'],
  'do-le': ['Nguyên liệu trà sữa', 'nguyen-lieu-tra-sua', 'Đồ lẻ', 'do-le'],
  'ong-hut': ['Ly/bao bì/phụ kiện', 'phu-kien', 'Ống hút', 'ong-hut'],
  muong: ['Ly/bao bì/phụ kiện', 'phu-kien', 'Muỗng', 'muong'],
  nap: ['Ly/bao bì/phụ kiện', 'phu-kien', 'Nắp', 'nap'],
  'bao-ly': ['Ly/bao bì/phụ kiện', 'phu-kien', 'Bao ly', 'bao-ly'],
  'nguyen-lieu-my-cay': ['Nguyên liệu mì cay', 'my-cay', 'Nguyên liệu mì cay', 'nguyen-lieu-my-cay'],
  'thuc-pham-dong-lanh': ['Đông lạnh', 'dong-lanh', 'Thực phẩm đông lạnh', 'thuc-pham-dong-lanh'],
  'nguyen-lieu-banh-trang': ['Nguyên liệu bánh tráng', 'banh-trang', 'Nguyên liệu bánh tráng', 'nguyen-lieu-banh-trang']
};

const CHOICE_GROUPS_BY_SOURCE_KEY = {
  'siro-thai-pixe-bgkq-0002': [{ key: 'flavor', name: 'Vị', required: true, values: ['Dâu', 'Đào', 'Nho', 'Kiwi', 'Chanh dây', 'Phúc bồn tử', 'Dưa lưới', 'Vải', 'Cam', 'Việt quất', 'Táo xanh', 'Blue Curacao', 'Bạc hà', 'Sô-cô-la', 'Trà xanh Matcha', 'Hỗn hợp trái cây (Blue Punch)', 'Khoai môn', 'Cookies'] }],
  'siro-thai-dingfong-bgkq-0003': [{ key: 'flavor', name: 'Vị', required: true, values: ['Blue Hawaii', 'Dưa hấu', 'Nho', 'Xoài', 'Bạc hà', 'Chanh dây', 'Đào', 'Dâu', 'Dưa lưới', 'Táo xanh', 'Vải', 'Việt quất'] }],
  'siro-gold-2l-bgkq-0004': [{ key: 'flavor', name: 'Vị', required: true, values: ['Bạc hà', 'Cam', 'Caramel', 'Chanh', 'Chanh dây', 'Đào', 'Dâu', 'Dừa', 'Dưa hấu', 'Dưa lưới', 'Đường đen', 'Khoai môn'] }],
  'siro-gold-700ml-bgkq-0005': [{ key: 'flavor', name: 'Vị', required: true, values: ['Việt quất', 'Dâu', 'Chanh', 'Vải', 'Thơm', 'Mãng cầu', 'Kiwi', 'Chanh dây', 'Đào', 'Dưa hấu', 'Ổi hồng', 'Xoài', 'Dưa lưới', 'Nhãn', 'Lựu', 'Trái cây nhiệt đới'] }],
  'siro-gtp-bgkq-0006': [{ key: 'flavor', name: 'Vị', required: true, values: ['Trái cây nhiệt đới', 'Sâm dứa', 'Ổi xá lị', 'Khoai môn', 'Việt quất', 'Phúc bồn tử', 'Chanh dây', 'Dưa lưới', 'Bạc hà', 'Kiwi', 'Vải', 'Nho', 'Táo xanh', 'Đào', 'Cam', 'Đường đen', 'Sô-cô-la', 'Dâu', 'Caramel', 'Blue Curacao'] }],
  'siro-vina-bgkq-0008': [{ key: 'flavor', name: 'Vị', required: true, values: ['Dâu', 'Đào', 'Vải', 'Ổi', 'Việt quất', 'Phúc bồn tử', 'Bạc hà', 'Khoai môn', 'Blue Curacao', 'Sâm dứa', 'Dưa lưới', 'Kiwi', 'Táo xanh', 'Chanh dây', 'Xoài', 'Măng cụt', 'Mật ong'] }],
  'siro-carisa-bgkq-0010': [{ key: 'flavor', name: 'Vị', required: true, values: ['Chanh xanh', 'Sâm dứa', 'Dưa lưới', 'Vải', 'Đào', 'Khoai môn', 'Cam', 'Dâu', 'Ổi hồng', 'Việt quất', 'Chanh dây', 'Me', 'Mơ', 'Lựu', 'Sầu riêng', 'Sô-cô-la'] }],
  'siro-changthai-bgkq-0011': [{ key: 'flavor', name: 'Vị', required: true, values: ['Đào', 'Khoai môn', 'Mãng cầu', 'Ổi', 'Blue Curacao', 'Bạc hà', 'Trà xanh', 'Kiwi', 'Táo xanh', 'Phúc bồn tử', 'Dưa lưới', 'Xoài', 'Chanh dây', 'Việt quất', 'Dâu', 'Vải'] }],
  'siro-douxian-2l-tron-bgkq-0012': [{ key: 'flavor', name: 'Vị', required: true, values: ['Dâu', 'Đào', 'Vải', 'Bạc hà', 'Chanh', 'Đường đen', 'Dưa lưới', 'Táo xanh', 'Việt quất', 'Sô-cô-la'] }],
  'siro-douxian-2l-hoang-kim-bgkq-0014': [{ key: 'flavor', name: 'Vị', required: true, values: ['Đào'] }]
};

const FALLBACK_PRODUCTS_CSV = `product_key,name,brand,category,image_key,price_from,status
siro-thai-pixe-bgkq-0002,Siro Thái PIXE,PIXE,Siro,bgkq-0002,62000,draft
siro-thai-dingfong-bgkq-0003,Siro Thái DINGFONG,DINGFONG,Siro,bgkq-0003,62000,draft
siro-gold-2l-bgkq-0004,Siro Gold 2l,Gold,Siro,bgkq-0004,140000,draft
siro-gold-700ml-bgkq-0005,Siro Gold 700ml,Gold,Siro,bgkq-0005,53000,draft
siro-gtp-bgkq-0006,Siro GTP,GTP,Siro,bgkq-0006,140000,draft
siro-vina-bgkq-0008,Siro Vina,Vina,Siro,bgkq-0008,40000,draft
sinh-to-berrino-dau-bgkq-0015,Sinh Tố Berrino Dâu,Berrino,Sinh Tố Berino,bgkq-0015,89000,draft
sinh-to-berrino-dao-bgkq-0016,Sinh Tố Berrino Đào,Berrino,Sinh Tố Berino,bgkq-0016,91000,draft
sinh-to-berrino-oi-bgkq-0017,Sinh tố Berrino ổi,Berrino,Sinh Tố Berino,bgkq-0017,111000,draft`;

let catalogPromise = null;

function clean(value = '') {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalize(value = '') {
  return clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseCsv(raw = '') {
  const text = String(raw || '').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [headers = [], ...records] = rows;
  return records.map((values) => Object.fromEntries(headers.map((header, index) => [clean(header), clean(values[index])])));
}

async function fetchProductsCsv() {
  try {
    const response = await fetch(SOURCE_PRODUCTS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } catch (error) {
    console.warn('Không tải được catalog Bếp Sỉ, dùng fallback tối thiểu.', error);
    return FALLBACK_PRODUCTS_CSV;
  }
}

function categoryInfo(rawCategory = '') {
  const key = normalize(rawCategory);
  return CATEGORY_MAP[key] || ['Khác', 'khac', clean(rawCategory) || 'Khác', key || 'khac'];
}

function sourceSku(row = {}) {
  const image = normalize(row.image_key || '');
  const key = normalize(row.product_key || '');
  const match = (image || key).match(/bgkq-?(\d+)/i) || key.match(/(\d{4})$/);
  return match ? `BGKQ-${String(match[1]).padStart(4, '0')}` : clean(row.sku || row.product_key || '');
}

function inferSize(text = '') {
  const value = normalize(text).replace(/lit/g, 'l');
  const rules = [
    [/2-5kg|2-5-kg/, '2,5 kg'], [/650g|650-gram/, '650 g'], [/700ml/, '700 ml'], [/730ml/, '730 ml'], [/750ml/, '750 ml'], [/760ml/, '760 ml'], [/930ml/, '930 ml'],
    [/500gr|500g/, '500 g'], [/1kg|1-kg/, '1 kg'], [/2kg|2-kg/, '2 kg'], [/3kg|3-kg/, '3 kg'], [/1l|1-lit/, '1 L'], [/2l|2-lit/, '2 L']
  ];
  for (const [pattern, label] of rules) if (pattern.test(value)) return label;
  return '';
}

function inferFlavor(row = {}, categoryKey = '') {
  if (!['sinh-to', 'sot-topping', 'flan-pudding', 'bot-tao-vi'].includes(categoryKey)) return '';
  const name = normalize(row.name);
  const flavors = [['dau-tam', 'Dâu tằm'], ['viet-quoc', 'Việt quất'], ['phuc-bon-tu', 'Phúc bồn tử'], ['chanh-day', 'Chanh dây'], ['mang-cau', 'Mãng cầu'], ['socola', 'Sô-cô-la'], ['so', 'Sô-cô-la'], ['mon', 'Khoai môn'], ['dau', 'Dâu'], ['dao', 'Đào'], ['oi', 'Ổi'], ['vai', 'Vải'], ['kiwi', 'Kiwi'], ['xoai', 'Xoài'], ['nho', 'Nho'], ['dua', 'Dừa']];
  return flavors.find(([key]) => name.includes(key))?.[1] || '';
}

function inferUnit(row = {}, categoryKey = '', size = '') {
  const key = normalize(`${row.product_key} ${row.name}`);
  if (['siro', 'sinh-to', 'duong-den', 'sot-topping'].includes(categoryKey)) return /2l|2-lit|binh/.test(key) ? 'bình' : 'chai';
  if (/kg|bao|bich/.test(key) || /kg/.test(normalize(size))) return 'bịch';
  if (['ong-hut', 'muong', 'nap', 'bao-ly'].includes(categoryKey)) return 'bịch';
  if (categoryKey === 'thuc-pham-dong-lanh') return 'gói';
  return 'cái';
}

function displayName(row = {}) {
  const sourceKey = row.product_key;
  if (sourceKey === 'siro-gold-2l-bgkq-0004') return 'Siro Golden Farm 2 L';
  if (sourceKey === 'siro-gold-700ml-bgkq-0005') return 'Siro Golden Farm 700 ml';
  if (sourceKey === 'siro-douxian-2l-tron-bgkq-0012') return 'Siro Douxian 2,5 kg bình tròn';
  if (sourceKey === 'siro-douxian-2l-hoang-kim-bgkq-0014') return 'Siro Douxian 2,5 kg bình vuông';
  return clean(row.name).replace(/\bglod\b/ig, 'Gold').replace(/\bGol\b/g, 'Gold').replace(/berino/ig, 'Berrino').replace(/\s{2,}/g, ' ').trim();
}

function inferBrand(name = '') {
  const text = normalize(name);
  const known = ['Torani', 'PIXE', 'Ding Fong', 'Golden Farm', 'Gold', 'GTP', 'Vina', 'Carisa', 'Chang Thai', 'Douxian', 'Berrino', 'Gia Uy', 'Bibi', 'Sea', 'Zion', 'Ok', 'Hùng Chương', 'Hershey', 'Lộc Phát', 'Phúc Long', 'Cozy', 'Luave', 'Mole', 'Rich'];
  return known.find((brand) => text.includes(normalize(brand))) || '';
}

function buildAliases({ name, sku, brand, category, flavor, size }) {
  return [...new Set([name, sku, `${brand} ${flavor}`, `${category} ${brand}`, `${name} ${size}`].map(clean).filter(Boolean))];
}

function rowToProduct(row = {}) {
  const sku = sourceSku(row);
  const [industry, industryKey, category, categoryKey] = categoryInfo(row.category);
  const name = displayName(row);
  const brand = clean(row.brand) || inferBrand(name);
  const size = inferSize(`${row.product_key} ${row.name}`);
  const flavor = inferFlavor(row, categoryKey);
  const unit = inferUnit(row, categoryKey, size);
  const price = Math.max(0, Number(row.price_from || row.price || 0));
  const id = `${industryKey}-${categoryKey}-${normalize(brand || 'no-brand')}-${normalize(flavor || 'mac-dinh')}-${normalize(size || 'std')}-${normalize(sku).replace(/-/g, '')}`;
  const choiceGroups = CHOICE_GROUPS_BY_SOURCE_KEY[row.product_key] || [];
  const choiceSummary = choiceGroups.length ? choiceGroups.map((group) => `${group.name}: ${group.values.length} lựa chọn`).join(' · ') : '';
  const searchLabel = `${sku} · ${name}${size ? ` · ${size}` : ''} · ${price ? `${price.toLocaleString('vi-VN')}đ` : 'chưa có giá'}`;
  return {
    id,
    product_id: `${industryKey}-${categoryKey}-${normalize(brand || 'no-brand')}-${normalize(size || 'std')}`,
    sku,
    source_sku: sku,
    source_product_key: clean(row.product_key),
    source_repo: SOURCE_REPO,
    name,
    product_name: name,
    brand: brand || '',
    industry,
    industry_key: industryKey,
    category,
    category_key: categoryKey,
    flavor,
    size,
    package: '',
    unit,
    price,
    unit_price: price,
    price_mode: price ? 'fixed' : 'manual',
    active: price > 0,
    orderable: price > 0,
    status: clean(row.status) || 'draft',
    choice_groups: choiceGroups,
    choice_summary: choiceSummary,
    aliases: buildAliases({ name, sku, brand, category, flavor, size }),
    search_label: searchLabel,
    search_text: normalize([sku, name, brand, category, flavor, size, choiceSummary].filter(Boolean).join(' ')),
    sync_status: 'synced',
    raw_payload: { source: 'bepsi_f_b_order', source_repo: SOURCE_REPO, source_url: SOURCE_PRODUCTS_URL, source_row: row, normalized_version: CATALOG_VERSION },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    synced_at: new Date().toISOString()
  };
}

function sortCatalog(rows = []) {
  return rows.slice().sort((a, b) => String(a.industry_key).localeCompare(String(b.industry_key)) || String(a.category_key).localeCompare(String(b.category_key)) || String(a.name).localeCompare(String(b.name)) || String(a.sku).localeCompare(String(b.sku)));
}

export async function importBepsiProductCatalog() {
  const csv = await fetchProductsCsv();
  const products = sortCatalog(parseCsv(csv).filter((row) => row.product_key && !DISABLED_SOURCE_KEYS.has(row.product_key)).map(rowToProduct));
  await putManyLocal(LOCAL_STORES.products, products);
  await putLocal(LOCAL_STORES.meta, { key: 'product_catalog_version', value: CATALOG_VERSION, source: SOURCE_REPO, rows: products.length, imported_at: new Date().toISOString() });
  return products;
}

export async function ensureProductCatalog({ force = false } = {}) {
  if (catalogPromise && !force) return catalogPromise;
  catalogPromise = (async () => {
    try {
      const [meta, current] = await Promise.all([
        getLocal(LOCAL_STORES.meta, 'product_catalog_version').catch(() => null),
        getAllLocal(LOCAL_STORES.products).catch(() => [])
      ]);
      if (force || meta?.value !== CATALOG_VERSION || current.length < 50) return importBepsiProductCatalog();
      return sortCatalog(current);
    } catch (error) {
      console.warn('Product catalog load failed; app continues without catalog.', error);
      return [];
    }
  })();
  return catalogPromise;
}

export function matchCatalogProduct(input = '', catalog = []) {
  const needle = normalize(input);
  if (!needle) return null;
  return catalog.find((item) => normalize(item.sku) === needle)
    || catalog.find((item) => normalize(item.search_label) === needle || normalize(item.name) === needle)
    || catalog.find((item) => item.search_text?.includes(needle))
    || null;
}

export function productCatalogVersion() {
  return CATALOG_VERSION;
}
