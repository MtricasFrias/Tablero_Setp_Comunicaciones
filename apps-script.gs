/**
 * CULTURA SETP — Backend de la encuesta (Google Apps Script)
 * ---------------------------------------------------------------
 * Guarda las respuestas en la hoja "Respuestas" y le entrega los datos
 * al panel de análisis. La configuración (metas, nombres de equipo,
 * padrón) se edita en las pestañas de la hoja, sin tocar este código.
 *
 * Instalación y actualización: ver INSTALACION.md
 *
 * Columnas de "Respuestas":
 *   timestamp | fecha | equipo | nombre | correo | valoracion | comentario
 *
 * Límite práctico: ~5.000 respuestas. Para más, habría que paginar.
 */

var TZ = 'America/Bogota';
var SHEET_RESP   = 'Respuestas';
var SHEET_CONFIG = 'Config';
var SHEET_PADRON = 'Padron';
var HEADER = ['timestamp', 'fecha', 'equipo', 'nombre', 'correo', 'valoracion', 'comentario'];

/** El panel pide los datos aquí (GET). */
function doGet(e) {
  return json_({
    ok: true,
    config: getConfig_(),
    rows: getRows_(),
    padron: getPadronCount_()   // solo el número, no la lista
  });
}

/** La encuesta envía cada respuesta aquí (POST, form-urlencoded). */
function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var p = (e && e.parameter) || {};
    var nombre = String(p.nombre || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    var correo = String(p.correo || '').trim().toLowerCase().slice(0, 120);
    var rating = parseInt(p.valoracion, 10);
    var equipo = String(p.equipo || '0');
    var com    = String(p.comentario || '').slice(0, 500);

    if (nombre.length < 3)                        return json_({ ok:false, error:'nombre' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return json_({ ok:false, error:'correo' });
    if (!(rating >= 1 && rating <= 5))            return json_({ ok:false, error:'valoracion' });

    var padron = getPadronSet_();
    if (padron && !padron[correo])                return json_({ ok:false, error:'padron' });

    var sh = sheetResp_();
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][4]).trim().toLowerCase() === correo) return json_({ ok:true, dup:true });
    }

    var now = new Date();
    sh.appendRow([ now, "'" + fecha_(now), equipo, nombre, correo, rating, com ]);
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
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
  }
  return sh;
}

function getRows_() {
  var sh = sheetResp_();
  var v = sh.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < v.length; i++) {
    var correo = String(v[i][4] || '').replace(/^'/, '').trim();
    if (!correo) continue;
    out.push({
      ts:         v[i][0] ? new Date(v[i][0]).getTime() : 0,   // el panel calcula la fecha desde aquí
      equipo:     String(v[i][2] || '0'),
      nombre:     String(v[i][3] || ''),
      correo:     correo,
      valoracion: Number(v[i][5]) || 0,
      comentario: String(v[i][6] || '')
    });
  }
  return out;
}

function getConfig_() {
  var c = { metaTotal:310000, metaDiaria:5000, fechaInicio:'', fechaFin:'',
            equipo1:'Equipo 1', equipo2:'Equipo 2', equipo3:'Equipo 3' };
  var sh = ss_().getSheetByName(SHEET_CONFIG);
  if (sh) {
    var v = sh.getDataRange().getValues();
    for (var i = 0; i < v.length; i++) {
      var k = String(v[i][0] || '').trim();
      if (k && v[i][1] !== '') {
        var raw = v[i][1];
        if (k === 'fechaInicio' || k === 'fechaFin') {
          c[k] = (raw instanceof Date)
            ? Utilities.formatDate(raw, TZ, 'yyyy-MM-dd')
            : String(raw).trim().slice(0, 10);
        } else {
          c[k] = raw;
        }
      }
    }
  }
  c.metaTotal  = Number(c.metaTotal)  || 310000;
  c.metaDiaria = Number(c.metaDiaria) || 5000;
  return c;
}

function getPadronSet_() {
  var sh = ss_().getSheetByName(SHEET_PADRON);
  if (!sh) return null;
  var v = sh.getDataRange().getValues();
  var set = {}, any = false;
  for (var i = 0; i < v.length; i++) {
    var d = String(v[i][0] || '').trim().toLowerCase();
    if (d && d.indexOf('@') > 0) { set[d] = 1; any = true; }
  }
  return any ? set : null;
}

function getPadronCount_() {
  var s = getPadronSet_();
  return s ? Object.keys(s).length : 0;
}

/**
 * Ejecuta esta función UNA vez desde el editor.
 * - Crea/deja listas las pestañas Respuestas, Config y Padron.
 * - Fija el encabezado correcto de Respuestas (nombre + correo).
 * NO borra respuestas existentes. Si vienes de la versión con "documento",
 * borra tú las filas viejas de Respuestas (deja solo la fila 1) antes de usar.
 */
function inicializar() {
  var sh = sheetResp_();
  sh.getRange(1, 1, 1, HEADER.length).setValues([HEADER]);
  sh.setFrozenRows(1);

  var cfg = ss_().getSheetByName(SHEET_CONFIG) || ss_().insertSheet(SHEET_CONFIG);
  if (cfg.getLastRow() === 0) {
    cfg.getRange(1, 1, 5, 2).setValues([
      ['metaTotal',  310000],
      ['metaDiaria', 5000],
      ['equipo1',    'Equipo 1 · Territorio'],
      ['equipo2',    'Equipo 2 · Paraderos'],
      ['equipo3',    'Equipo 3 · Instituciones']
    ]);
  }
  var pad = ss_().getSheetByName(SHEET_PADRON) || ss_().insertSheet(SHEET_PADRON);
  if (pad.getLastRow() === 0) pad.getRange(1, 1).setValue('correo_habilitado');
}
