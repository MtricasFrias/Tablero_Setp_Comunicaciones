/**
 * CULTURA SETP — Backend de la encuesta (Google Apps Script)
 * ---------------------------------------------------------------
 * Guarda las respuestas en la hoja "Respuestas" y le entrega los datos
 * al panel de análisis. No necesitas tocar este código: la configuración
 * (metas, nombres de equipo, padrón) se edita en las pestañas de la hoja.
 *
 * Instalación paso a paso: ver INSTALACION.md
 *
 * Límite práctico: ~5.000 respuestas. Para más, habría que paginar.
 */

var TZ = 'America/Bogota';
var SHEET_RESP   = 'Respuestas';
var SHEET_CONFIG = 'Config';
var SHEET_PADRON = 'Padron';

/** El panel pide los datos aquí (GET). */
function doGet(e) {
  var out = {
    ok: true,
    config: getConfig_(),
    rows: getRows_(),
    padron: getPadronCount_()   // solo el número, no la lista
  };
  return json_(out);
}

/** La encuesta envía cada respuesta aquí (POST, form-urlencoded). */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = (e && e.parameter) || {};
    var doc    = String(p.documento || '').replace(/\D/g, '');
    var rating = parseInt(p.valoracion, 10);
    var equipo = String(p.equipo || '0');
    var com    = String(p.comentario || '').slice(0, 500);

    if (doc.length < 6 || doc.length > 10)  return json_({ ok:false, error:'documento' });
    if (!(rating >= 1 && rating <= 5))       return json_({ ok:false, error:'valoracion' });

    var padron = getPadronSet_();
    if (padron && !padron[doc])              return json_({ ok:false, error:'padron' });

    var sh = sheetResp_();
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][3]) === doc)      return json_({ ok:true, dup:true });
    }

    var now = new Date();
    sh.appendRow([ now, fecha_(now), equipo, "'" + doc, rating, com ]);
    return json_({ ok:true });

  } catch (err) {
    return json_({ ok:false, error:String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

/* ---------- helpers ---------- */

function fecha_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function sheetResp_() {
  var sh = ss_().getSheetByName(SHEET_RESP);
  if (!sh) {
    sh = ss_().insertSheet(SHEET_RESP);
    sh.appendRow(['timestamp', 'fecha', 'equipo', 'documento', 'valoracion', 'comentario']);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getRows_() {
  var sh = sheetResp_();
  var v = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var docCell = String(v[i][3] || '').replace(/^'/, '');
    if (!docCell) continue;
    out.push({
      ts:         v[i][0] ? new Date(v[i][0]).getTime() : 0,
      fecha:      String(v[i][1] || ''),
      equipo:     String(v[i][2] || '0'),
      documento:  docCell,
      valoracion: Number(v[i][4]) || 0,
      comentario: String(v[i][5] || '')
    });
  }
  return out;
}

function getConfig_() {
  var c = { metaTotal:1000, metaDiaria:40,
            equipo1:'Equipo 1', equipo2:'Equipo 2', equipo3:'Equipo 3' };
  var sh = ss_().getSheetByName(SHEET_CONFIG);
  if (!sh) return c;
  var v = sh.getDataRange().getValues();
  for (var i = 0; i < v.length; i++) {
    var k = String(v[i][0] || '').trim();
    if (k && v[i][1] !== '') c[k] = v[i][1];
  }
  c.metaTotal  = Number(c.metaTotal)  || 1000;
  c.metaDiaria = Number(c.metaDiaria) || 40;
  return c;
}

function getPadronSet_() {
  var sh = ss_().getSheetByName(SHEET_PADRON);
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  var set = {}, any = false;
  for (var i = 0; i < v.length; i++) {
    var d = String(v[i][0] || '').replace(/\D/g, '');
    if (d) { set[d] = 1; any = true; }
  }
  return any ? set : null;
}

function getPadronCount_() {
  var s = getPadronSet_();
  return s ? Object.keys(s).length : 0;
}

/** Ejecuta esta función UNA vez desde el editor para crear las pestañas. */
function inicializar() {
  sheetResp_();
  var cfg = ss_().getSheetByName(SHEET_CONFIG) || ss_().insertSheet(SHEET_CONFIG);
  if (cfg.getLastRow() === 0) {
    cfg.getRange(1, 1, 5, 2).setValues([
      ['metaTotal',  1000],
      ['metaDiaria', 40],
      ['equipo1',    'Equipo 1 · Territorio'],
      ['equipo2',    'Equipo 2 · Paraderos'],
      ['equipo3',    'Equipo 3 · Instituciones']
    ]);
  }
  var pad = ss_().getSheetByName(SHEET_PADRON) || ss_().insertSheet(SHEET_PADRON);
  if (pad.getLastRow() === 0) pad.getRange(1, 1).setValue('documento_habilitado');
}
