/*
  Google Apps Script nhận báo cáo từ Tea Survey Report PWA.

  Cách dùng:
  1. Tạo Google Sheet mới.
  2. Extensions / Tiện ích mở rộng -> Apps Script.
  3. Xóa code cũ, dán toàn bộ file này.
  4. Deploy -> New deployment -> Web app.
  5. Execute as: Me.
  6. Who has access: Anyone.
  7. Copy Web App URL dạng https://script.google.com/macros/s/.../exec.
  8. Dán URL đó vào mục Google Sheet trong PWA.

  Nếu sửa code Apps Script, nhớ Deploy -> Manage deployments -> Edit -> New version -> Deploy.
*/

const REPORT_SHEET_NAME = 'Báo cáo';
const CUSTOMER_SHEET_NAME = 'Chi tiết khách hàng';

const PRODUCTS = [
  'Trà Đen',
  'Trà Quả Mộng',
  'Trà Gạo Rang',
  'Trà Lài',
  'Trà Olong',
  'Trà Olong Sen'
];

const REPORT_HEADERS = [
  'ID báo cáo',
  'Thời gian gửi',
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
  const callback = e && e.parameter && e.parameter.callback;
  const data = { ok: true, message: 'Tea Survey Report Sheet API đang hoạt động.' };
  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${JSON.stringify(data)})`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput(data);
}

function doPost(e) {
  try {
    const payload = parsePayload(e);

    if (!payload.report || !payload.report.id) {
      return jsonOutput({ ok: false, message: 'Thiếu dữ liệu report.id.' });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = ensureSheet(ss, REPORT_SHEET_NAME, REPORT_HEADERS);
    const customerSheet = ensureSheet(ss, CUSTOMER_SHEET_NAME, CUSTOMER_HEADERS);

    removeOldRows(reportSheet, 1, payload.report.id);
    removeOldRows(customerSheet, 1, payload.report.id);

    appendReportRow(reportSheet, payload);
    appendCustomerRows(customerSheet, payload);

    return jsonOutput({ ok: true, message: 'Đã ghi báo cáo vào Google Sheet.', reportId: payload.report.id, action: payload.action || '' });
  } catch (error) {
    return jsonOutput({ ok: false, message: error.message, stack: error.stack });
  }
}

function parsePayload(e) {
  if (e && e.parameter && e.parameter.payload) {
    return JSON.parse(e.parameter.payload);
  }

  if (e && e.postData && e.postData.contents) {
    const raw = e.postData.contents;
    if (raw.indexOf('payload=') === 0) {
      const params = raw.split('&').reduce((acc, pair) => {
        const parts = pair.split('=');
        acc[decodeURIComponent(parts[0] || '')] = decodeURIComponent((parts[1] || '').replace(/\+/g, ' '));
        return acc;
      }, {});
      return JSON.parse(params.payload || '{}');
    }
    return JSON.parse(raw);
  }

  return {};
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const maxColumns = Math.max(headers.length, sheet.getLastColumn() || headers.length);
  const currentHeaders = sheet.getRange(1, 1, 1, maxColumns).getValues()[0];
  const shouldWriteHeaders = currentHeaders.slice(0, headers.length).join('') === '' || currentHeaders[0] !== headers[0];

  if (shouldWriteHeaders) {
    sheet.clear();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight('bold')
      .setBackground('#0f766e')
      .setFontColor('#ffffff');
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

function removeOldRows(sheet, idColumn, reportId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;

  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(reportId)) {
      sheet.deleteRow(i + 2);
    }
  }
}

function appendReportRow(sheet, payload) {
  const report = payload.report;
  const summary = report.summary || {};
  sheet.appendRow([
    report.id,
    payload.submittedAt || new Date().toISOString(),
    report.date || '',
    report.market || '',
    report.sales || '',
    report.note || '',
    summary.totalCustomers || 0,
    summary.needSample || 0,
    summary.follow || 0,
    summary.bad || 0,
    report.createdAt || '',
    report.updatedAt || ''
  ]);
}

function appendCustomerRows(sheet, payload) {
  const report = payload.report;
  const rows = (payload.customers || []).map((customer) => {
    const base = [
      report.id,
      customer.id || '',
      payload.submittedAt || new Date().toISOString(),
      report.date || '',
      report.market || '',
      report.sales || '',
      customer.name || '',
      customer.area || '',
      customer.testType || '',
      customer.followDate || '',
      (customer.marketTags || []).join(', '),
      customer.note || ''
    ];

    const tests = PRODUCTS.flatMap((product) => {
      const test = customer.tests && customer.tests[product] ? customer.tests[product] : {};
      return [statusVi(test.status || 'pending'), test.note || ''];
    });

    return [...base, ...tests];
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, CUSTOMER_HEADERS.length).setValues(rows);
    sheet.autoResizeColumns(1, CUSTOMER_HEADERS.length);
  }
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

function jsonOutput(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
