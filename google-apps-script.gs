/*
  Bépi Field Report - Google Apps Script receiver.

  Deploy Web App:
  - Execute as: Me
  - Who has access: Anyone
  - URL phải kết thúc bằng /exec

  Nếu muốn app tạo file báo cáo trong Google Drive:
  - Tạo một thư mục cố định trên Drive
  - Copy Folder ID trong URL thư mục
  - Dán Folder ID vào app và bật "Tạo Google Doc khi gửi Sheet"
*/

const REPORT_SHEET_NAME = 'Báo cáo';
const CUSTOMER_SHEET_NAME = 'Chi tiết khách hàng';
const PRODUCTS = ['Trà Đen', 'Trà Quả Mộng', 'Trà Gạo Rang', 'Trà Lài', 'Trà Olong', 'Trà Olong Sen'];

const REPORT_HEADERS = [
  'ID báo cáo', 'Thời gian gửi', 'Ngày báo cáo', 'Thị trường / khu vực', 'Sales phụ trách',
  'Ghi chú báo cáo', 'Tổng khách', 'Cần mẫu', 'Báo A Tân / báo sau', 'Cần xử lý',
  'File báo cáo Drive', 'Tạo lúc', 'Cập nhật lúc'
];

const CUSTOMER_HEADERS = [
  'ID báo cáo', 'ID khách', 'Thời gian gửi', 'Ngày báo cáo', 'Thị trường / khu vực', 'Sales phụ trách',
  'Tên khách hàng', 'Khu vực khách', 'Loại SP test', 'Hẹn báo lại', 'Test chung thị trường', 'Ghi chú tổng',
  ...PRODUCTS.flatMap((product) => [`${product} - trạng thái`, `${product} - ghi chú`])
];

function doGet() {
  return jsonOutput({ ok: true, message: 'Bépi Field Report Sheet API đang hoạt động.' });
}

function doPost(e) {
  try {
    const payload = parsePayload(e);
    if (!payload.report || !payload.report.id) return jsonOutput({ ok: false, message: 'Thiếu report.id' });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const reportSheet = ensureSheet(ss, REPORT_SHEET_NAME, REPORT_HEADERS);
    const customerSheet = ensureSheet(ss, CUSTOMER_SHEET_NAME, CUSTOMER_HEADERS);

    let fileUrl = '';
    if (payload.settings && payload.settings.createDriveFile && payload.settings.driveFolderId) {
      fileUrl = createOrUpdateReportDoc(payload, payload.settings.driveFolderId);
    }

    removeOldRows(reportSheet, 1, payload.report.id);
    removeOldRows(customerSheet, 1, payload.report.id);
    appendReportRow(reportSheet, payload, fileUrl);
    appendCustomerRows(customerSheet, payload);

    return jsonOutput({ ok: true, message: 'Đã ghi báo cáo.', reportId: payload.report.id, fileUrl });
  } catch (error) {
    return jsonOutput({ ok: false, message: error.message, stack: error.stack });
  }
}

function parsePayload(e) {
  if (e && e.parameter && e.parameter.payload) return JSON.parse(e.parameter.payload);
  if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents);
  return {};
}

function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);

  const currentFirst = sheet.getLastRow() ? sheet.getRange(1, 1).getValue() : '';
  if (!currentFirst || currentFirst !== headers[0]) {
    sheet.clear();
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#0a6b5f').setFontColor('#ffffff');
  sheet.autoResizeColumns(1, headers.length);
  return sheet;
}

function removeOldRows(sheet, idColumn, reportId) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return;
  const values = sheet.getRange(2, idColumn, lastRow - 1, 1).getValues();
  for (let i = values.length - 1; i >= 0; i--) {
    if (String(values[i][0]) === String(reportId)) sheet.deleteRow(i + 2);
  }
}

function appendReportRow(sheet, payload, fileUrl) {
  const r = payload.report;
  const s = r.summary || {};
  sheet.appendRow([
    r.id,
    payload.submittedAt || new Date().toISOString(),
    r.date || '',
    r.market || '',
    r.sales || '',
    r.note || '',
    s.totalCustomers || 0,
    s.needSample || 0,
    s.follow || 0,
    s.bad || 0,
    fileUrl || '',
    r.createdAt || '',
    r.updatedAt || ''
  ]);
}

function appendCustomerRows(sheet, payload) {
  const r = payload.report;
  const rows = (payload.customers || []).map((c) => {
    const base = [
      r.id,
      c.id || '',
      payload.submittedAt || new Date().toISOString(),
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
}

function createOrUpdateReportDoc(payload, folderId) {
  const r = payload.report;
  const folder = DriveApp.getFolderById(folderId);
  const name = `Bao cao ${r.date || ''} - ${safeName(r.market || 'Thi truong')} - ${r.id}`;
  const files = folder.getFilesByName(name);
  let file;
  let doc;

  if (files.hasNext()) {
    file = files.next();
    doc = DocumentApp.openById(file.getId());
    doc.getBody().clear();
  } else {
    doc = DocumentApp.create(name);
    file = DriveApp.getFileById(doc.getId());
    file.moveTo(folder);
  }

  writeReportDoc(doc, payload);
  doc.saveAndClose();
  return file.getUrl();
}

function writeReportDoc(doc, payload) {
  const r = payload.report;
  const body = doc.getBody();
  body.appendParagraph('BÁO CÁO KHẢO SÁT THỊ TRƯỜNG TRÀ SỮA').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph(`Ngày: ${r.date || ''}`);
  body.appendParagraph(`Thị trường: ${r.market || ''}`);
  body.appendParagraph(`Sales: ${r.sales || ''}`);
  if (r.note) body.appendParagraph(`Ghi chú: ${r.note}`);
  body.appendParagraph('');

  const customers = payload.customers || [];
  body.appendParagraph(`Tổng khách: ${customers.length}`).setHeading(DocumentApp.ParagraphHeading.HEADING2);

  customers.forEach((c, index) => {
    body.appendParagraph(`${index + 1}. ${c.name || ''}${c.area ? ' - ' + c.area : ''}`).setHeading(DocumentApp.ParagraphHeading.HEADING3);
    PRODUCTS.forEach((product) => {
      const test = c.tests && c.tests[product] ? c.tests[product] : {};
      if ((test.status || 'pending') !== 'pending' || test.note) {
        body.appendParagraph(`- ${product}: ${statusVi(test.status || 'pending')}${test.note ? ' (' + test.note + ')' : ''}`);
      }
    });
    if (c.marketTags && c.marketTags.length) body.appendParagraph(`- Thị trường: ${c.marketTags.join(', ')}`);
    if (c.followDate) body.appendParagraph(`- Hẹn báo lại: ${c.followDate}`);
    if (c.note) body.appendParagraph(`- Ghi chú: ${c.note}`);
  });
}

function safeName(value) {
  return String(value).replace(/[\\/:*?"<>|]/g, '-').trim().slice(0, 80);
}

function statusVi(status) {
  const map = {
    pending: 'Chưa thử', ok: 'OK', interested: 'Quan tâm', sample: 'Cần mẫu',
    follow: 'Báo A Tân', bad: 'Chưa tốt', retry: 'Thử lại'
  };
  return map[status] || status || 'Chưa thử';
}

function jsonOutput(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
