/**
 * BW Brief Studio — API publique Google Apps Script
 * Déployer comme Web App : Exécuter en tant que "Moi", Accès "Tout le monde"
 * CORS géré automatiquement par Google.
 */
var SHEET_ID   = '1bBp5Cgmjdq-EPWrYQ_Pp40GJs-ss82I-4anLpT83yDw';
var SHEET_NAME = 'Historique';

function getBriefs() {
  var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  var data  = sheet.getDataRange().getValues();
  if (!data || data.length < 2) return [];
  var headers = data[0];
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) {
      obj[String(h)] = (row[i] !== null && row[i] !== undefined) ? String(row[i]) : '';
    });
    return obj;
  }).filter(function(r) { return r.briefId && r.briefId.trim(); });
}

function doGet(e)  { return respond(getBriefs()); }
function doPost(e) { return respond(getBriefs()); }

function respond(briefs) {
  var payload = JSON.stringify({ ok: true, count: briefs.length, briefs: briefs });
  return ContentService.createTextOutput(payload).setMimeType(ContentService.MimeType.JSON);
}
