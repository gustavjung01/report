const APP_NAME = 'Bépi Field Report';
const DATA_SHEET_PROP = 'BEPI_DATA_SPREADSHEET_ID';
const DEFAULT_FOLDER_ID = '1DTIHNs8NzOATNHTId9G8qRaInHsXxtGO';
const DATA_SPREADSHEET_PREFIX = 'Bépi Field Report - Data';

const TAB_ALL = 'Tổng hợp';
const TAB_MARKET = 'Thị trường';
const TAB_TSST = 'TSST';
const TAB_ORDER = 'Lên đơn hàng';
const TAB_TEST = 'Test';
const TAB_CUSTOMERS = 'Chi tiết khách hàng';
const TAB_CONFIG = '_Config';

const PRODUCTS = ['Trà Đen', 'Trà Quả Mộng', 'Trà Gạo Rang', 'Trà Lài', 'Trà Olong', 'Trà Olong Sen'];

const REPORT_HEADERS = [
  'ID báo cáo',
  'Thời gian gửi',
  'Loại báo cáo',
  'Ngày báo cáo',
  'Thị trường / khu vực',
  'Sales phụ trách',
  'Ghi chú báo cáo',
  'Tổng khách',
  'Cần mẫu',
  'Báo A Tân / báo sau',
  'Cần xử lý',
  'Tạo lúc',
  'Cập nhật lúc'
];

const CUSTOMER_HEADERS = [
  'ID báo cáo',
  'ID khách',
  'Thời gian gửi',
  'Loại báo cáo',
  'Ngày báo cáo',
  'Thị trường / khu vực',
  'Sales phụ trách',
  'Tên khách hàng',
  'Khu vực khách',
  'Loại SP test',
  'Hẹn báo lại',
  'Test chung thị trường',
  'Ghi chú tổng',
  ...PRODUCTS.flatMap((product) => [`${product} - trạng thái`, `${product} - ghi chú`])
];

function doGet(e) {
  try {
    if (e && e.parameter && e.parameter.payload) return doPost(e);
    if (e && e.parameter && e.parameter.setup === '1') {
      const ss = getOrCreateDataSpreadsheet({ settings: readSettingsFromQuery(e) });
      ensureWorkbook(ss);
      return jsonOutput({ ok: true, message: 'Đã tạo / kiểm tra file Sheet dữ liệu.', spreadsheetId: ss.getId(), spreadsheetUrl: ss.getUrl() });
    }
    const info = currentSpreadsheetInfo();
    return jsonOutput({ ok: true, message: 'Bépi Field Report API đang hoạt động.', dataSheet: info });
  } catch (error) {
    return errorOutput(error);
  }
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    if (!payload.report || !payload.report.id) return jsonOutput({ ok: false, message: 'Thiếu report.id' });

    const ss = getOrCreateDataSpreadsheet(payload);
    ensureWorkbook(ss);

    const kind = normalizeKind(payload.report.kind || payload.report.reportType || 'Thị trường');
    const submittedAt = payload.submittedAt || new Date().toISOString();
    payload.report.kind = kind;
    payload.submittedAt = submittedAt;

    upsertReport(ss.getSheetByName(TAB_ALL), payload);
    upsertReport(ss.getSheetByName(kind), payload);
    upsertCustomerRows(ss.getSheetByName(TAB_CUSTOMERS), payload);

    SpreadsheetApp.flush();

    return jsonOutput({
      ok: true,
      message: 'Đã ghi báo cáo vào Sheet mới.',
      reportId: payload.report.id,
      kind,
      spreadsheetId: ss.getId(),
      spreadsheetUrl: ss.getUrl(),
      tabs: [TAB_ALL, kind, TAB_CUSTOMERS]
    });
  } catch (error) {
    return errorOutput(error);
  }
}

function parsePayload(e) {
  if (e && e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
  if (e && e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    try {
      return JSON.parse(raw);
    } catch (error) {
      const match = raw.match(/(?:^|&)payload=([^&]+)/);
      if (match) return JSON.parse(decodeURIComponent(match[1].replace(/\+/g, ' ')));
      throw error;
    }
  }
  return {};
}

function readSettingsFromQuery(e) {
  const p = e.parameter || {};
  return { driveFolderId: p.folderId || p.doc_id || p.driveFolderId || DEFAULT_FOLDER_ID };
}

function getOrCreateDataSpreadsheet(payload) {
  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty(DATA_SHEET_PROP);

  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (error) {
      props.deleteProperty(DATA_SHEET_PROP);
    }
  }

  const folderId = resolveFolderId(payload);
  const folder = DriveApp.getFolderById(folderId);
  const existing = findExistingDataSpreadsheet(folder);
  if (existing) {
    props.setProperty(DATA_SHEET_PROP, existing.getId());
    return SpreadsheetApp.openById(existing.getId());
  }

  const name = `${DATA_SPREADSHEET_PREFIX} - ${formatNowForName()}`;
  const ss = SpreadsheetApp.create(name);
  const file = DriveApp.getFileById(ss.getId());
  file.moveTo(folder);
  props.setProperty(DATA_SHEET_PROP, ss.getId());
  return ss;
}

function resolveFolderId(payload) {
  const settings = (payload && payload.settings) || {};
  return settings.driveFolderId || settings.folderId || settings.doc_id || payload.doc_id || DEFAULT_FOLDER_ID;
}

function findExistingDataSpreadsheet(folder) {
  const files = folder.getFiles();
  while (files.hasNext()) {
    const file = files.next();
    if (file.getMimeType() === MimeType.GOOGLE_SHEETS && file.getName().indexOf(DATA_SPREADSHEET_PREFIX) === 0) return file;
  }
  return null;
}

function ensureWorkbook(ss) {
  const defaultSheet = ss.getSheets()[0];

  const allSheet = ensureSheet(ss, TAB_ALL, REPORT_HEADERS);
  ensureSheet(ss, TAB_MARKET, REPORT_HEADERS);
  ensureSheet(ss, TAB_TSST, REPORT_HEADERS);
  ensureSheet(ss, TAB_ORDER, REPORT_HEADERS);
  ensureSheet(ss, TAB_TEST, REPORT_HEADERS);
  ensureSheet(ss, TAB_CUSTOMERS, CUSTOMER_HEADERS);
  const config = ensureSheet(ss, TAB_CONFIG, ['Key', 'Value']);

  config.getRange(2, 1, 5, 2).setValues([
    ['Folder ID', DEFAULT_FOLDER_ID],
    ['Data Sheet ID', ss.getId()],
    ['Data Sheet URL', ss.getUrl()],
    ['Updated At', new Date().toISOString()],
    ['Tabs', [TAB_ALL, TAB_MARKET, TAB_TSST, TAB_ORDER, TAB_TEST, TAB_CUSTOMERS].join(', ')]
  ]);
  config.hideSheet();

  if (defaultSheet && defaultSheet.getName() === 'Sheet1' && ss.getSheets().length > 1) ss.deleteSheet(defaultSheet);
  ss.setActiveSheet(allSheet);
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const first = sheet.getLastRow() ? sheet.getRange(1, 1).getValue() : '';
  if (first !== headers[0]) sheet.clear();

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length)
    .setFontWeight('bold')
    .setBackground('#0a6b5f')
    .setFontColor('#ffffff');
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function upsertReport(sheet, payload) {
  removeOldRows(sheet, 1, payload.report.id);
  sheet.appendRow(buildReportRow(payload));
  autosizeSafe(sheet, REPORT_HEADERS.length);
}

function buildReportRow(payload) {
  const r = payload.report;
  const summary = r.summary || {};
  const customers = payload.customers || [];
  return [
    r.id,
    payload.submittedAt || new Date().toISOString(),
    r.kind || 'Thị trường',
    r.date || '',
    r.market || '',
    r.sales || '',
    r.note || '',
    numberOr(summary.totalCustomers, customers.length),
    numberOr(summary.needSample, customers.filter((c) => customerNeeds(c, 'sample')).length),
    numberOr(summary.follow, customers.filter((c) => customerNeeds(c, 'follow')).length),
    numberOr(summary.bad, customers.filter((c) => customerNeeds(c, 'bad')).length),
    r.createdAt || '',
    r.updatedAt || ''
  ];
}

function upsertCustomerRows(sheet, payload) {
  removeOldRows(sheet, 1, payload.report.id);
  const r = payload.report;
  const rows = (payload.customers || []).map((c) => {
    const base = [
      r.id,
      c.id || '',
      payload.submittedAt || new Date().toISOString(),
      r.kind || 'Thị trường',
      r.date || '',
      r.market || '',
      r.sales || '',
      c.name || '',
      c.area || '',
      c.testType || '',
      c.followDate || '',
      (c.marketTags || []).join(', '),
      c.note || ''
    ];

    const tests = PRODUCTS.flatMap((product) => {
      const test = c.tests && c.tests[product] ? c.tests[product] : {};
      return [statusVi(test.status || 'pending'), test.note || ''];
    });

    return [...base, ...tests];
  });

  if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CUSTOMER_HEADERS.length).setValues(rows);
  autosizeSafe(sheet, CUSTOMER_HEADERS.length);
}

function removeOldRows(sheet, idColumn, reportId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(reportId)) sheet.deleteRow(i + 2);
  }
}

function normalizeKind(kind) {
  const raw = String(kind || '').trim();
  const lower = raw.toLowerCase();
  if (lower.indexOf('test') >= 0) return TAB_TEST;
  if (lower.indexOf('lên') >= 0 || lower.indexOf('len') >= 0 || lower.indexOf('đơn') >= 0 || lower.indexOf('don') >= 0 || lower.indexOf('order') >= 0) return TAB_ORDER;
  if (lower.indexOf('tsst') >= 0 || lower.indexOf('tss') >= 0 || lower.indexOf('trà sữa') >= 0 || lower.indexOf('tra sua') >= 0) return TAB_TSST;
  return TAB_MARKET;
}

function customerNeeds(c, group) {
  const tests = Object.values(c.tests || {});
  const tags = c.marketTags || [];
  const note = c.note || '';
  if (group === 'sample') return tests.some((t) => t.status === 'sample') || tags.some((t) => /mẫu/i.test(t)) || /mẫu/i.test(note);
  if (group === 'follow') return tests.some((t) => t.status === 'follow') || tags.some((t) => /báo sau|tân/i.test(t)) || /báo|tân/i.test(note);
  if (group === 'bad') return tests.some((t) => t.status === 'bad' || t.status === 'retry') || tags.some((t) => /giá cao|khó|nhạt|chưa tốt/i.test(t));
  return false;
}

function statusVi(status) {
  const map = {
    pending: 'Chưa thử',
    ok: 'OK',
    interested: 'Quan tâm',
    sample: 'Cần mẫu',
    follow: 'Báo A Tân',
    bad: 'Chưa tốt',
    retry: 'Thử lại'
  };
  return map[status] || status || 'Chưa thử';
}

function numberOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function autosizeSafe(sheet, colCount) {
  try {
    sheet.autoResizeColumns(1, colCount);
  } catch (error) {}
}

function formatNowForName() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH.mm');
}

function currentSpreadsheetInfo() {
  const id = PropertiesService.getScriptProperties().getProperty(DATA_SHEET_PROP);
  if (!id) return null;
  try {
    const ss = SpreadsheetApp.openById(id);
    return { id: ss.getId(), url: ss.getUrl(), name: ss.getName() };
  } catch (error) {
    return { id, error: error.message };
  }
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function errorOutput(error) {
  return jsonOutput({ ok: false, message: error.message, stack: error.stack });
}
