/**
 * CDWS Database API — Google Apps Script
 * Stores parent enquiries in a Google Spreadsheet.
 *
 * Setup:
 * 1) Open the Google Sheet that will hold records.
 * 2) Extensions -> Apps Script; paste this file into Code.gs.
 * 3) Set SPREADSHEET_ID below to the spreadsheet ID.
 * 4) Deploy -> New deployment -> Web app; execute as yourself.
 *    For a public school enquiry form, choose the access setting you intend to support.
 * 5) Copy the /exec URL into js/database.js.
 *
 * This is a Google Sheets backend; it cannot directly write to an .xlsx/.xlsm
 * file stored in GitHub. Upload/convert the workbook to Google Sheets first.
 *
 * For production use, add authentication/authorization before enabling
 * list/update/delete actions. Publicly exposing admin CRUD is unsafe.
 */
const SPREADSHEET_ID = 'PUT_GOOGLE_SHEET_ID_HERE';
const SHEET_NAME = 'Enquiries';
const HEADERS = [
  'id', 'parentName', 'email', 'phone', 'studentName', 'studentClass',
  'category', 'informationRequested', 'contactMethod', 'message',
  'submittedAt', 'updatedAt'
];

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}

function sheet_() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === 'PUT_GOOGLE_SHEET_ID_HERE') {
    throw new Error('Configure SPREADSHEET_ID in Code.gs first.');
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(HEADERS);
  return sh;
}

function rowObject_(row) {
  const out = {};
  HEADERS.forEach((key, i) => out[key] = row[i] == null ? '' : String(row[i]));
  return out;
}

function doGet(e) {
  try {
    const sh = sheet_();
    const action = (e && e.parameter && e.parameter.action) || 'list';
    const rows = sh.getLastRow() > 1
      ? sh.getRange(2, 1, sh.getLastRow() - 1, HEADERS.length).getDisplayValues()
      : [];
    if (action === 'health') return json_({ ok: true, service: 'CDWS Database API' });
    if (action !== 'list') return json_({ ok: false, error: 'Unsupported GET action' });
    return json_({ ok: true, data: rows.map(rowObject_) });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sh = sheet_();
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); }
      catch (_) { body = e.parameter || {}; }
    } else {
      body = (e && e.parameter) || {};
    }
    const action = String(body.action || 'create').toLowerCase();
    const now = new Date().toISOString();

    if (action === 'create') {
      const required = ['parentName', 'email', 'phone', 'studentName', 'studentClass', 'category', 'contactMethod', 'message'];
      const missing = required.filter(k => !String(body[k] || '').trim());
      if (missing.length) return json_({ ok: false, error: 'Missing required fields', fields: missing });
      const id = Utilities.getUuid();
      const record = {
        id,
        parentName: String(body.parentName).trim(),
        email: String(body.email).trim(),
        phone: String(body.phone).trim(),
        studentName: String(body.studentName).trim(),
        studentClass: String(body.studentClass).trim(),
        category: String(body.category).trim(),
        informationRequested: String(body.informationRequested || ''),
        contactMethod: String(body.contactMethod).trim(),
        message: String(body.message).trim(),
        submittedAt: String(body.submittedAt || now),
        updatedAt: now
      };
      sh.appendRow(HEADERS.map(k => record[k] || ''));
      return json_({ ok: true, action: 'create', data: record });
    }

    const id = String(body.id || '').trim();
    if (!id) return json_({ ok: false, error: 'Record id is required' });
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return json_({ ok: false, error: 'Record not found' });
    const ids = sh.getRange(2, 1, lastRow - 1, 1).getDisplayValues().flat();
    const offset = ids.findIndex(v => v === id);
    if (offset < 0) return json_({ ok: false, error: 'Record not found' });
    const sheetRow = offset + 2;

    if (action === 'delete') {
      sh.deleteRow(sheetRow);
      return json_({ ok: true, action: 'delete', id });
    }
    if (action === 'update') {
      const current = rowObject_(sh.getRange(sheetRow, 1, 1, HEADERS.length).getDisplayValues()[0]);
      const mutable = ['parentName','email','phone','studentName','studentClass','category','informationRequested','contactMethod','message'];
      mutable.forEach(k => { if (Object.prototype.hasOwnProperty.call(body, k)) current[k] = String(body[k] || '').trim(); });
      current.updatedAt = now;
      sh.getRange(sheetRow, 1, 1, HEADERS.length).setValues([HEADERS.map(k => current[k] || '')]);
      return json_({ ok: true, action: 'update', data: current });
    }
    return json_({ ok: false, error: 'Unsupported action. Use create, update or delete.' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
