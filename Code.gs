// Paste this into Extensions > Apps Script inside your Google Sheet.
const SHEET = 'subjects';

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) {
    sh = ss.insertSheet(SHEET);
    sh.getRange('A:D').setNumberFormat('@'); // keep everything as plain text
    sh.appendRow(['id', 'name', 'order', 'topics_json']);
  }
  return sh;
}

function readAll_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('all');
  if (hit) return hit;
  const rows = sheet_().getDataRange().getValues().slice(1).filter(r => r[0] !== '');
  const subjects = rows.map(r => {
    let topics = [];
    try { topics = JSON.parse(r[3] || '[]'); } catch (e) {}
    return { id: String(r[0]), name: String(r[1]), order: Number(r[2]) || 0, topics };
  }).sort((a, b) => a.order - b.order);
  const out = JSON.stringify({ subjects });
  try { cache.put('all', out, 600); } catch (e) {} // too big for cache? just skip
  return out;
}

function doGet() {
  return ContentService.createTextOutput(readAll_()).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let result = { ok: true };
  try {
    const body = JSON.parse(e.postData.contents);
    const sh = sheet_();
    const ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues().map(r => String(r[0]));
    if (body.action === 'save') {
      body.subjects.forEach(s => {
        const json = JSON.stringify(s.topics || []);
        if (json.length > 49000) throw new Error('"' + s.name + '" is too large for one cell. Split it into two subjects.');
        const row = [s.id, s.name, s.order, json];
        const i = ids.indexOf(String(s.id));
        if (i >= 0) sh.getRange(i + 2, 1, 1, 4).setValues([row]);
        else { sh.appendRow(row); ids.push(String(s.id)); }
      });
    } else if (body.action === 'delete') {
      const i = ids.indexOf(String(body.id));
      if (i >= 0) sh.deleteRow(i + 2);
    } else throw new Error('Unknown action');
    CacheService.getScriptCache().remove('all');
  } catch (err) {
    result = { ok: false, error: String(err.message || err) };
  } finally {
    lock.releaseLock();
  }
  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
}
