/**
 * CULTURA SETP — Backend de la encuesta (Google Apps Script)
 * ---------------------------------------------------------------
 * Guarda las respuestas en la hoja "Respuestas", envía un correo de
 * agradecimiento a la persona y le entrega los datos al panel de análisis.
 * La configuración (metas, nombres de equipo, padrón, correo) se edita en
 * las pestañas de la hoja, sin tocar este código.
 *
 * Instalación y actualización: ver INSTALACION.md
 *
 * Columnas de "Respuestas":
 *   timestamp | fecha | equipo | nombre | correo | valoracion | comentario
 *
 * Límite práctico: ~5.000 respuestas. El correo de agradecimiento usa la
 * cuota de Gmail (100/día en Gmail normal, 1.500/día en Workspace); si se
 * agota, la respuesta igual se guarda pero ese correo no se envía.
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
  var p = (e && e.parameter) || {};
  var nombre = String(p.nombre || '').trim().replace(/\s+/g, ' ').slice(0, 120);
  var correo = String(p.correo || '').trim().toLowerCase().slice(0, 120);
  var rating = parseInt(p.valoracion, 10);
  var equipo = String(p.equipo || '0');
  var com    = String(p.comentario || '').slice(0, 500);

  if (nombre.length < 3)                         return json_({ ok:false, error:'nombre' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) return json_({ ok:false, error:'correo' });
  if (!(rating >= 1 && rating <= 5))             return json_({ ok:false, error:'valoracion' });

  var cfg = getConfig_();
  var padron = getPadronSet_();
  if (padron && !padron[correo])                 return json_({ ok:false, error:'padron' });

  var lock = LockService.getScriptLock();
  var esNuevo = false;
  try {
    lock.waitLock(20000);
    var sh = sheetResp_();
    var values = sh.getDataRange().getValues();
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][4]).replace(/^'/, '').trim().toLowerCase() === correo) {
        return json_({ ok:true, dup:true });
      }
    }
    var now = new Date();
    sh.appendRow([ now, "'" + fecha_(now), equipo, nombre, correo, rating, com ]);
    esNuevo = true;
  } catch (err) {
    return json_({ ok:false, error:String(err) });
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }

  if (esNuevo) enviarGracias_(correo, nombre, cfg);   // correo de agradecimiento (fuera del lock)
  return json_({ ok:true });
}

/**
 * Envía el correo de agradecimiento del SETP. Nunca rompe el registro:
 * si se acaba la cuota diaria de Gmail (100/día en Gmail normal, 1.500/día
 * en Google Workspace) o falla, simplemente no se envía.
 * Para desactivarlo: en la pestaña Config pon la fila  correoAuto | no
 */
function enviarGracias_(correo, nombre, cfg) {
  try {
    if (String(cfg.correoAuto || 'si').toLowerCase() === 'no') return;
    if (MailApp.getRemainingDailyQuota() < 3) return;
    var primer = (String(nombre).split(' ')[0] || '').trim();
    MailApp.sendEmail({
      to: correo,
      name: cfg.remitente || 'SETP Ibagué · Cultura SETP',
      subject: cfg.asuntoCorreo || '¡Gracias por ser parte de Cultura SETP!',
      htmlBody: correoHtml_(primer),
      body: correoTexto_(primer),
      noReply: true
    });
  } catch (e) { /* sin cuota / error: se ignora */ }
}

function esc_(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c];
  });
}

function correoTexto_(nombre) {
  return 'Hola ' + nombre + ',\n\n' +
    'Gracias por asistir a la charla y por tomarte un momento para responder la encuesta de CULTURA SETP.\n\n' +
    'Tu opinión es muy valiosa: con ella el Sistema Estratégico de Transporte Público de Ibagué ' +
    'toma mejores decisiones para que moverse por la ciudad sea más seguro, cómodo e incluyente para todos.\n\n' +
    '"Tu comportamiento mueve la ciudad".\n\n' +
    '— Área de Comunicaciones · SETP Ibagué · Alcaldía de Ibagué';
}

function correoHtml_(nombre) {
  var n = esc_(nombre);
  return '' +
  '<div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:0 auto;color:#0D1730">' +
    '<div style="background:#0B1F5C;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0">' +
      '<div style="font-size:20px;font-weight:800;letter-spacing:1px">CULTURA SETP</div>' +
      '<div style="font-size:12px;color:#B9D2F2;margin-top:2px">Tu comportamiento mueve la ciudad</div>' +
    '</div>' +
    '<div style="border:1px solid #E0E6F1;border-top:0;border-radius:0 0 12px 12px;padding:22px;line-height:1.55">' +
      '<p>Hola <b>' + n + '</b>,</p>' +
      '<p>Gracias por asistir a la charla y por tomarte un momento para responder la encuesta.</p>' +
      '<p>Tu opinión es muy valiosa: con ella el <b>Sistema Estratégico de Transporte Público de Ibagué</b> ' +
      'toma mejores decisiones para que moverse por la ciudad sea más seguro, cómodo e incluyente para todos.</p>' +
      '<p style="color:#159BD6;font-weight:700;margin-top:18px">“Tu comportamiento mueve la ciudad”.</p>' +
      '<p style="font-size:13px;color:#5B6A88;margin-top:22px">Área de Comunicaciones · SETP Ibagué<br>Alcaldía de Ibagué</p>' +
    '</div>' +
  '</div>';
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
            equipo1:'Equipo 1', equipo2:'Equipo 2', equipo3:'Equipo 3',
            correoAuto:'si', remitente:'SETP Ibagué · Cultura SETP',
            asuntoCorreo:'¡Gracias por ser parte de Cultura SETP!' };
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
  var defaults = [
    ['metaTotal',   310000],
    ['metaDiaria',  5000],
    ['equipo1',     'Equipo 1 · Territorio'],
    ['equipo2',     'Equipo 2 · Paraderos'],
    ['equipo3',     'Equipo 3 · Instituciones'],
    ['correoAuto',  'si'],
    ['remitente',   'SETP Ibagué · Cultura SETP'],
    ['asuntoCorreo','¡Gracias por ser parte de Cultura SETP!']
  ];
  var tiene = {};
  var cv = cfg.getDataRange().getValues();
  for (var i = 0; i < cv.length; i++) tiene[String(cv[i][0] || '').trim()] = true;
  defaults.forEach(function (row) { if (!tiene[row[0]]) cfg.appendRow(row); });

  var pad = ss_().getSheetByName(SHEET_PADRON) || ss_().insertSheet(SHEET_PADRON);
  if (pad.getLastRow() === 0) pad.getRange(1, 1).setValue('correo_habilitado');
}
