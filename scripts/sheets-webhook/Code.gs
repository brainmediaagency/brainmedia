/**
 * Google Apps Script — Sheets log + Drive file upload (no Firebase Storage / Blaze).
 *
 * IMPORTANT: Do NOT reorder existing columns without an explicit product decision.
 * Ops template cols 1–12 stay fixed (col 12 = Fatura, manual). Col 13 = JOB ID
 * (Firestore job id) was approved for stable row identity (FUNC-02 / v13).
 * v14: pushNotify audience = all five app roles (OR), optional externalIds.
 * v15: onesignalUpsertUsers — create Audience users by Firebase uid + role tag.
 * v16: wipeBrainUploads — trash all files/folders under BrainUploads (management/coordinator).
 * v17: pushNotify excludeExternalIds → OneSignal exclude_aliases.external_id (skip actor).
 *
 * SON DURUM values (only):
 *   Konfirme | Reddedildi | Çekildi | İptal edildi
 * (Muhabire ilet does not write SON DURUM.)
 *
 * Deploy as Web App:
 *   Execute as: Me
 *   Who has access: Anyone / Herkes
 * After code changes: Deploy → Manage deployments → Edit → New version → Deploy
 * (New deployment = new URL → update VITE_SHEETS_WEBHOOK_URL once.)
 *
 * Auth (v12+): Firebase ID token via accounts:lookup (preferred).
 * Script properties:
 *   FIREBASE_WEB_API_KEY = Firebase web API key (same as VITE_FIREBASE_API_KEY; server-side only)
 *   WEBHOOK_SECRET = optional legacy fallback for one version (remove after clients ship idToken)
 *   ONESIGNAL_APP_ID = OneSignal App ID (optional; for pushNotify)
 *   ONESIGNAL_REST_API_KEY = OneSignal REST API Key (optional; for pushNotify)
 *
 * Client must send idToken in JSON/form body (or Authorization: Bearer when available).
 * doGet ping stays public (version/features only — no secrets).
 */

var SCRIPT_SERVICE = 'brain-sheets-drive-webhook-v17'
var SCRIPT_VERSION = 'v17'
var FIREBASE_PROJECT_ID = 'brain-c5fcb'
var DEFAULT_SHEET_NAME = 'IslemLogu'
var DEFAULT_DRIVE_ROOT = 'BrainUploads'

/** Roles that may mutate sheets / Drive / push (when customClaims.role is present). */
var ROLES_SHEET = {
  reporter: true,
  media_planning: true,
  coordinator: true,
  management: true,
}
var ROLES_DRIVE = {
  reporter: true,
  media_planning: true,
  human_resources: true,
  coordinator: true,
  management: true,
}
/** Callers of notify* → pushNotify (audience default = all five role tags; optional externalIds). */
var ROLES_PUSH = {
  media_planning: true,
  reporter: true,
  human_resources: true,
  coordinator: true,
  management: true,
}

/**
 * Fixed ops template — do not reorder cols 1–12 without approval.
 * Col 11 is unused (legacy “MERVE HANIM” label may still exist in live workbooks);
 * the app never writes that column. Col 12 = fatura (manual).
 * Col 13 = JOB ID (Firestore job id) — appended for stable row match (v13+).
 * ensureHeaderRow_ only runs on empty sheets — existing header rows are never
 * fully overwritten; ensureJobIdHeader_ may write M1 if that cell is empty.
 */
var HEADERS = [
  'TARİH',
  'FİRMA ADI',
  'FİRMA SAHİBİ',
  'TEL NO',
  'ADRES',
  'MPU',
  'DK',
  'HABER',
  'SON DURUM',
  'KAZANÇ',
  '', // unused (legacy MERVE HANIM — app does not write)
  '', // fatura — manual; app never fills
  'JOB ID',
]

var COL = {
  TARIH: 1,
  FIRMA_ADI: 2,
  FIRMA_SAHIBI: 3,
  TEL_NO: 4,
  ADRES: 5,
  MPU: 6,
  DK: 7,
  HABER: 8,
  SON_DURUM: 9,
  KAZANC: 10,
  UNUSED_11: 11,
  FATURA: 12,
  JOB_ID: 13,
}

var FOLDER_NAMES = {
  hiring: 'Hiring',
  'z-reports': 'ZReports',
  'voice-recordings': 'VoiceRecordings',
}

function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {}
    return routeParameterizedAction_(params, true, e)
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? String(err.message) : 'Unknown error',
    }, 500)
  }
}

function parseFormBody_(raw) {
  var formParams = {}
  String(raw || '')
    .split('&')
    .forEach(function (pair) {
      var parts = pair.split('=')
      var key = decodeURIComponent((parts[0] || '').replace(/\+/g, ' '))
      var val = decodeURIComponent(
        (parts.slice(1).join('=') || '').replace(/\+/g, ' '),
      )
      if (key) formParams[key] = val
    })
  return formParams
}

function looksLikeFormBody_(raw, contentType) {
  var ct = String(contentType || '')
  if (ct.indexOf('application/x-www-form-urlencoded') !== -1) return true
  var s = String(raw || '')
  return s.indexOf('action=') === 0 || s.indexOf('&action=') !== -1
}

function doPost(e) {
  try {
    var params = e && e.parameter ? e.parameter : {}

    if (params.action === 'driveStorageUsage' || params.action === 'uploadResult') {
      return routeParameterizedAction_(params, false, e)
    }

    var raw = e && e.postData && e.postData.contents ? e.postData.contents : ''
    if (!raw) {
      return jsonResponse_({ ok: false, error: 'Empty body' }, 400)
    }

    var contentType =
      e && e.postData && e.postData.type ? String(e.postData.type) : ''
    if (looksLikeFormBody_(raw, contentType)) {
      var formParams = parseFormBody_(raw)
      if (formParams.action) {
        return routeParameterizedAction_(formParams, false, e)
      }
    }

    var body
    try {
      body = JSON.parse(raw)
    } catch (parseErr) {
      return jsonResponse_({ ok: false, error: 'Invalid JSON body' }, 400)
    }

    var action = body.action || ''
    if (!action && (body.islem === 'approved' || body.islem === 'cancelled')) {
      action = 'upsertJobRow'
    }

    var auth = authorizeMutatingRequest_(body, action, e)
    if (!auth.ok) return auth.response

    if (body.action === 'uploadFile') {
      return handleUpload_(body)
    }
    if (body.action === 'driveStorageUsage') {
      return handleDriveStorageUsage_()
    }
    if (body.action === 'wipeBrainUploads') {
      return handleWipeBrainUploads_()
    }
    if (body.action === 'uploadResult') {
      return handleUploadResult_(body.token || '')
    }
    if (body.action === 'upsertJobRow') {
      return handleUpsertJobRow_(body)
    }
    if (body.action === 'updateSonDurum') {
      return handleUpdateSonDurum_(body)
    }
    if (body.action === 'updateDkHaber') {
      return handleUpdateDkHaber_(body)
    }
    if (body.action === 'pushNotify') {
      return handlePushNotify_(body)
    }
    if (body.action === 'onesignalUpsertUsers') {
      return handleOnesignalUpsertUsers_(body)
    }

    if (body.islem === 'approved' || body.islem === 'cancelled') {
      if (!body.sonDurum) {
        body.sonDurum =
          body.islem === 'approved' ? 'Konfirme' : 'İptal edildi'
      }
      return handleUpsertJobRow_(body)
    }

    return jsonResponse_({
      ok: false,
      error:
        'Invalid request (expected upsertJobRow/updateSonDurum/updateDkHaber/uploadFile/uploadResult/driveStorageUsage/wipeBrainUploads/pushNotify/onesignalUpsertUsers)',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    }, 400)
  } catch (err) {
    return jsonResponse_({
      ok: false,
      error: err && err.message ? String(err.message) : 'Unknown error',
    }, 500)
  }
}

function routeParameterizedAction_(params, allowAnonymousPing, e) {
  var action = params.action || ''

  if (action === 'uploadResult') {
    var authUpload = authorizeMutatingRequest_(params, 'uploadResult', e)
    if (!authUpload.ok) return authUpload.response
    return handleUploadResult_(params.token || '')
  }

  if (action === 'driveStorageUsage') {
    var authUsage = authorizeMutatingRequest_(params, 'driveStorageUsage', e)
    if (!authUsage.ok) return authUsage.response
    return handleDriveStorageUsage_()
  }

  if (allowAnonymousPing) {
    return jsonResponse_({
      ok: true,
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
      features: [
        'upsertJobRow',
        'updateSonDurum',
        'updateDkHaber',
        'uploadFile',
        'uploadResult',
        'driveStorageUsage',
        'wipeBrainUploads',
        'pushNotify',
        'onesignalUpsertUsers',
        'firebaseIdTokenAuth',
      ],
      auth: 'firebase-id-token',
    })
  }

  return jsonResponse_({ ok: false, error: 'Unknown action' }, 400)
}

/**
 * Extract Firebase ID token from JSON/form body or Authorization: Bearer.
 * Apps Script web apps often omit headers — body.idToken is the primary path.
 */
function extractIdToken_(payload, e) {
  if (payload && payload.idToken) {
    return String(payload.idToken).trim()
  }
  if (payload && payload.id_token) {
    return String(payload.id_token).trim()
  }
  try {
    var headers =
      e && e.headers
        ? e.headers
        : e && e.parameter && e.parameter.headers
          ? e.parameter.headers
          : null
    if (headers) {
      var authHeader =
        headers.Authorization ||
        headers.authorization ||
        headers['Authorization'] ||
        headers['authorization'] ||
        ''
      var m = String(authHeader).match(/^Bearer\s+(.+)$/i)
      if (m && m[1]) return String(m[1]).trim()
    }
  } catch (ignore) {}
  return ''
}

/**
 * Verify Firebase ID token via Identity Toolkit accounts:lookup.
 * API key is project-scoped (brain-c5fcb); invalid/expired tokens fail.
 * Returns { ok, uid, email, role, claims } or { ok:false, error }.
 */
function verifyFirebaseIdToken_(idToken) {
  var apiKey = PropertiesService.getScriptProperties().getProperty(
    'FIREBASE_WEB_API_KEY',
  )
  if (!apiKey) {
    return { ok: false, error: 'FIREBASE_WEB_API_KEY not configured' }
  }

  var resp = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' +
      encodeURIComponent(apiKey),
    {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ idToken: idToken }),
      muteHttpExceptions: true,
    },
  )
  var code = resp.getResponseCode()
  var text = resp.getContentText()
  if (code < 200 || code >= 300) {
    return { ok: false, error: 'Invalid or expired token' }
  }

  var data
  try {
    data = JSON.parse(text)
  } catch (parseErr) {
    return { ok: false, error: 'Invalid token lookup response' }
  }

  var users = data.users || []
  if (!users.length) {
    return { ok: false, error: 'Invalid or expired token' }
  }

  var user = users[0]
  var claims = {}
  if (user.customAttributes) {
    try {
      claims = JSON.parse(user.customAttributes) || {}
    } catch (attrErr) {
      claims = {}
    }
  }

  // Soft project check when claim present (accounts:lookup already scopes to API key project).
  if (claims.aud && String(claims.aud) !== FIREBASE_PROJECT_ID) {
    return { ok: false, error: 'Token audience mismatch' }
  }

  return {
    ok: true,
    uid: user.localId || '',
    email: user.email || '',
    role: claims.role ? String(claims.role) : '',
    claims: claims,
    projectId: FIREBASE_PROJECT_ID,
  }
}

function roleAllowedForAction_(action, role) {
  // No custom claim → allow any verified user for non-push; push also allowed
  // when claim missing (Firestore remains authoritative for app RBAC).
  if (!role) return true

  if (action === 'pushNotify') {
    return Boolean(ROLES_PUSH[role])
  }
  if (action === 'onesignalUpsertUsers' || action === 'wipeBrainUploads') {
    return role === 'management' || role === 'coordinator'
  }
  if (
    action === 'uploadFile' ||
    action === 'uploadResult' ||
    action === 'driveStorageUsage'
  ) {
    return Boolean(ROLES_DRIVE[role])
  }
  // Sheet mutations
  return Boolean(ROLES_SHEET[role])
}

/**
 * Prefer Firebase ID token. Legacy WEBHOOK_SECRET accepted for one version
 * so deploy order is safe (remove secret path in a later version).
 */
function authorizeMutatingRequest_(payload, action, e) {
  var idToken = extractIdToken_(payload, e)
  if (idToken) {
    var verified = verifyFirebaseIdToken_(idToken)
    if (!verified.ok) {
      var detail = verified.error || 'Invalid token'
      var isConfig = /FIREBASE_WEB_API_KEY/i.test(detail)
      return {
        ok: false,
        response: jsonResponse_(
          {
            ok: false,
            error: isConfig
              ? 'FIREBASE_WEB_API_KEY not configured'
              : 'Unauthorized',
            detail: detail,
            service: SCRIPT_SERVICE,
            version: SCRIPT_VERSION,
          },
          isConfig ? 503 : 401,
        ),
      }
    }
    if (!roleAllowedForAction_(action, verified.role)) {
      return {
        ok: false,
        response: jsonResponse_(
          {
            ok: false,
            error: 'Forbidden',
            detail: 'Role not allowed for action',
            service: SCRIPT_SERVICE,
            version: SCRIPT_VERSION,
          },
          403,
        ),
      }
    }
    return { ok: true, user: verified, auth: 'idToken' }
  }

  // Legacy fallback (v12 only) — prefer idToken; remove WEBHOOK_SECRET later.
  var expected = PropertiesService.getScriptProperties().getProperty(
    'WEBHOOK_SECRET',
  )
  var secret = payload && payload.secret ? String(payload.secret) : ''
  if (expected && secret && secret === expected) {
    return { ok: true, user: { uid: '', role: '', legacy: true }, auth: 'secret' }
  }

  return {
    ok: false,
    response: jsonResponse_(
      {
        ok: false,
        error: 'Unauthorized',
        detail: 'idToken required (or legacy secret)',
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      401,
    ),
  }
}

/**
 * Insert or update by JOB ID (preferred, v13+) or FİRMA ADI + TARİH (legacy rows).
 * Preserves fatura, unused col 11, DK, HABER and KAZANÇ cells on update
 * (DK/HABER/KAZANÇ are written by the daily reporter report — status upserts
 * must not wipe them).
 */
function handleUpsertJobRow_(body) {
  var sheet = getOrCreateLogSheet_()
  ensureHeaderRow_(sheet)
  ensureJobIdHeader_(sheet)

  var rowValues = buildJobRowValues_(body)
  var existingRow = findRow_(sheet, body)

  if (existingRow > 1) {
    var faturaVal = sheet.getRange(existingRow, COL.FATURA).getValue()
    rowValues[COL.FATURA - 1] = faturaVal
    var unused11Val = sheet.getRange(existingRow, COL.UNUSED_11).getValue()
    rowValues[COL.UNUSED_11 - 1] = unused11Val
    var dkCol = findHeaderColumn_(sheet, 'DK', COL.DK)
    var haberCol = findHeaderColumn_(sheet, 'HABER', COL.HABER)
    var kazancCol = findKazancColumn_(sheet)
    rowValues[dkCol - 1] = sheet.getRange(existingRow, dkCol).getValue()
    rowValues[haberCol - 1] = sheet.getRange(existingRow, haberCol).getValue()
    rowValues[kazancCol - 1] = sheet.getRange(existingRow, kazancCol).getValue()
    // Preserve existing JOB ID if body omitted it (shouldn't happen from v13 clients).
    var jobIdCol = findHeaderColumn_(sheet, 'JOB ID', COL.JOB_ID)
    if (!String(rowValues[jobIdCol - 1] || '').trim()) {
      rowValues[jobIdCol - 1] = sheet.getRange(existingRow, jobIdCol).getValue()
    }
    // getRange(row, column, numRows, numColumns)
    sheet.getRange(existingRow, 1, 1, HEADERS.length).setValues([rowValues])
    return jsonResponse_({
      ok: true,
      updated: true,
      row: existingRow,
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    })
  }

  sheet.appendRow(rowValues)
  return jsonResponse_({
    ok: true,
    inserted: true,
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

function handleUpdateSonDurum_(body) {
  var sonDurum = String(body.sonDurum || '').trim()
  if (!sonDurum) {
    return jsonResponse_({ ok: false, error: 'Missing sonDurum' }, 400)
  }

  var sheet = getOrCreateLogSheet_()
  ensureHeaderRow_(sheet)
  ensureJobIdHeader_(sheet)

  var existingRow = findRow_(sheet, body)
  if (existingRow < 2) {
    return jsonResponse_({
      ok: false,
      error: 'Row not found (match JOB ID or FİRMA ADI + TARİH)',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    }, 404)
  }

  var sonDurumCol = findHeaderColumn_(sheet, 'SON DURUM', COL.SON_DURUM)
  sheet.getRange(existingRow, sonDurumCol).setValue(sonDurum)
  // Backfill JOB ID on legacy rows when client sends jobId.
  writeJobIdIfPresent_(sheet, existingRow, body)

  return jsonResponse_({
    ok: true,
    updated: true,
    row: existingRow,
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

/**
 * Patch DK + HABER + KAZANÇ (and optional SON DURUM) for daily reporter report.
 * Row match: JOB ID preferred; else FİRMA ADI + TARİH (acquiredDate dd.MM.yyyy).
 * KAZANÇ = per-firma toplam gelir (matrah+KDV), e.g. "12.500 TL".
 * Optional body.sonDurum (e.g. "Çekildi") is written in the same request so a
 * later status-only patch cannot race-clear money columns.
 */
function handleUpdateDkHaber_(body) {
  var sheet = getOrCreateLogSheet_()
  ensureHeaderRow_(sheet)
  ensureJobIdHeader_(sheet)

  var existingRow = findRow_(sheet, body)
  if (existingRow < 2) {
    return jsonResponse_({
      ok: false,
      error: 'Row not found (match JOB ID or FİRMA ADI + TARİH)',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    }, 404)
  }

  var dkCol = findHeaderColumn_(sheet, 'DK', COL.DK)
  var haberCol = findHeaderColumn_(sheet, 'HABER', COL.HABER)
  var kazancCol = findKazancColumn_(sheet)
  sheet.getRange(existingRow, dkCol).setValue(String(body.dk != null ? body.dk : ''))
  sheet.getRange(existingRow, haberCol).setValue(String(body.haber != null ? body.haber : ''))
  // Always write KAZANÇ when the field is present (including "" to clear).
  // Older v6 deployments ignored this key — v10+ must fill column J.
  if (Object.prototype.hasOwnProperty.call(body, 'kazanc')) {
    sheet.getRange(existingRow, kazancCol).setValue(String(body.kazanc != null ? body.kazanc : ''))
  }

  var sonDurum = String(body.sonDurum || '').trim()
  if (sonDurum) {
    var sonDurumCol = findHeaderColumn_(sheet, 'SON DURUM', COL.SON_DURUM)
    sheet.getRange(existingRow, sonDurumCol).setValue(sonDurum)
  }

  writeJobIdIfPresent_(sheet, existingRow, body)

  return jsonResponse_({
    ok: true,
    updated: true,
    row: existingRow,
    kazancCol: kazancCol,
    wroteKazanc: Object.prototype.hasOwnProperty.call(body, 'kazanc'),
    wroteSonDurum: Boolean(sonDurum),
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

function resolveSonDurum_(body) {
  if (body.sonDurum) return String(body.sonDurum)
  if (body.islem === 'approved') return 'Konfirme'
  if (body.islem === 'cancelled') return 'İptal edildi'
  return ''
}

function buildJobRowValues_(body) {
  return [
    body.tarih || '',
    body.firmaAdi || body.firma || '',
    body.firmaSahibi || body.yetkili || '',
    body.telNo || body.telefon || '',
    body.adres || body.il || '',
    body.mpu || '',
    body.dk || '',
    body.haber || '',
    resolveSonDurum_(body),
    body.kazanc || body.tutar || '',
    '', // unused col 11 (legacy MERVE HANIM) — app never fills
    '', // fatura — app never fills; preserved on update
    resolveJobId_(body),
  ]
}

/** Normalize header text for fuzzy match (KAZANÇ ≈ KAZANC). */
function normalizeHeaderKey_(value) {
  return String(value || '')
    .trim()
    .toLocaleUpperCase('tr-TR')
    .replace(/İ/g, 'I')
    .replace(/İ/g, 'I')
    .replace(/[^A-Z0-9]/g, '')
}

function findHeaderColumn_(sheet, headerName, defaultCol) {
  var lastCol = Math.max(sheet.getLastColumn() || 0, HEADERS.length)
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0]
  var target = String(headerName || '').trim()
  var targetKey = normalizeHeaderKey_(target)
  for (var c = 0; c < headers.length; c++) {
    var cell = String(headers[c] || '').trim()
    if (cell === target) {
      return c + 1
    }
  }
  if (targetKey) {
    for (var c2 = 0; c2 < headers.length; c2++) {
      if (normalizeHeaderKey_(headers[c2]) === targetKey) {
        return c2 + 1
      }
    }
  }
  return defaultCol
}

/** Resolve KAZANÇ column (exact, fuzzy, or fixed col 10). */
function findKazancColumn_(sheet) {
  return findHeaderColumn_(sheet, 'KAZANÇ', COL.KAZANC)
}

/** Resolve Firestore job id from body (jobId preferred; isId legacy alias). */
function resolveJobId_(body) {
  return String(body.jobId || body.isId || '').trim()
}

/**
 * Prefer JOB ID match when present; else FİRMA ADI + TARİH for legacy rows.
 */
function findRow_(sheet, body) {
  var byJobId = findRowByJobId_(sheet, body)
  if (byJobId > 1) return byJobId
  return findRowByFirmaAndTarih_(sheet, body)
}

/** Match last row with same JOB ID (col 13). */
function findRowByJobId_(sheet, body) {
  var jobId = resolveJobId_(body)
  if (!jobId) return -1

  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return -1

  var jobIdCol = findHeaderColumn_(sheet, 'JOB ID', COL.JOB_ID)
  var numRows = lastRow - 1
  var values = sheet.getRange(2, jobIdCol, numRows, 1).getValues()
  var found = -1
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === jobId) {
      found = i + 2
    }
  }
  return found
}

/** Match last row with same firma + tarih (date prefix OK if time present). */
function findRowByFirmaAndTarih_(sheet, body) {
  var firma = String(body.firmaAdi || body.firma || '')
    .trim()
    .toLocaleLowerCase('tr-TR')
  var tarih = String(body.tarih || '').trim()
  if (!firma || !tarih) return -1

  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return -1

  var firmaCol = findHeaderColumn_(sheet, 'FİRMA ADI', COL.FIRMA_ADI)
  var tarihCol = findHeaderColumn_(sheet, 'TARİH', COL.TARIH)
  var numRows = lastRow - 1
  var firmas = sheet.getRange(2, firmaCol, numRows, 1).getValues()
  var tarihs = sheet.getRange(2, tarihCol, numRows, 1).getValues()
  var tarihPrefix = tarih.split(' ')[0]
  var found = -1

  for (var i = 0; i < firmas.length; i++) {
    var f = String(firmas[i][0] || '')
      .trim()
      .toLocaleLowerCase('tr-TR')
    var t = String(tarihs[i][0] || '').trim()
    if (t && Object.prototype.toString.call(tarihs[i][0]) === '[object Date]') {
      t = Utilities.formatDate(
        tarihs[i][0],
        Session.getScriptTimeZone() || 'Europe/Istanbul',
        'dd.MM.yyyy',
      )
    }
    if (f === firma && (t === tarih || t.indexOf(tarihPrefix) === 0)) {
      found = i + 2
    }
  }
  return found
}

/** Backfill JOB ID cell when matching a legacy row. */
function writeJobIdIfPresent_(sheet, row, body) {
  var jobId = resolveJobId_(body)
  if (!jobId || row < 2) return
  var jobIdCol = findHeaderColumn_(sheet, 'JOB ID', COL.JOB_ID)
  var existing = String(sheet.getRange(row, jobIdCol).getValue() || '').trim()
  if (!existing) {
    sheet.getRange(row, jobIdCol).setValue(jobId)
  }
}

function handleUpload_(body) {
  if (!body.base64 || !body.fileName) {
    cacheUploadResult_(body.uploadToken, { ok: false, error: 'Missing file' })
    return jsonResponse_({ ok: false, error: 'Missing file' }, 400)
  }

  try {
    var folderKey = body.folder || 'misc'
    var subName = FOLDER_NAMES[folderKey] || 'Misc'
    var folder = getOrCreateUploadFolder_(subName)
    var bytes = Utilities.base64Decode(body.base64)
    var blob = Utilities.newBlob(
      bytes,
      body.mimeType || 'application/octet-stream',
      String(body.fileName).slice(0, 180),
    )
    var file = folder.createFile(blob)
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    var fileId = file.getId()
    var result = {
      ok: true,
      fileId: fileId,
      url: 'https://drive.google.com/uc?export=view&id=' + fileId,
      webViewLink: file.getUrl(),
    }
    cacheUploadResult_(body.uploadToken, result)
    return jsonResponse_(result)
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Upload failed'
    cacheUploadResult_(body.uploadToken, { ok: false, error: message })
    return jsonResponse_({ ok: false, error: message }, 500)
  }
}

function handleUploadResult_(token) {
  if (!token) {
    return jsonResponse_({ ok: false, error: 'Missing token' }, 400)
  }
  var cache = CacheService.getScriptCache()
  var raw = cache.get('upload:' + token)
  if (!raw) {
    return jsonResponse_({ ok: true, pending: true })
  }
  return ContentService.createTextOutput(raw).setMimeType(
    ContentService.MimeType.JSON,
  )
}

function cacheUploadResult_(token, obj) {
  if (!token) return
  try {
    CacheService.getScriptCache().put(
      'upload:' + String(token),
      JSON.stringify(obj),
      600,
    )
  } catch (ignore) {}
}

function handleDriveStorageUsage_() {
  var token = ScriptApp.getOAuthToken()
  var resp = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/about?fields=storageQuota',
    {
      headers: { Authorization: 'Bearer ' + token },
      muteHttpExceptions: true,
    },
  )
  var code = resp.getResponseCode()
  if (code < 200 || code >= 300) {
    return jsonResponse_(
      { ok: false, error: 'Drive about failed (' + code + ')' },
      500,
    )
  }

  var data = JSON.parse(resp.getContentText())
  var q = data.storageQuota || {}
  var used = Number(q.usageInDrive || q.usage || 0)
  var limit = Number(q.limit || 0)
  if (!limit || !isFinite(limit)) {
    limit = 15 * 1024 * 1024 * 1024
  }

  var brainBytes = 0
  var brainCount = 0
  try {
    var rootName =
      PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER') ||
      DEFAULT_DRIVE_ROOT
    var roots = DriveApp.getRootFolder().getFoldersByName(rootName)
    if (roots.hasNext()) {
      var stats = sumFolder_(roots.next())
      brainBytes = stats.bytes
      brainCount = stats.count
    }
  } catch (ignore) {}

  return jsonResponse_({
    ok: true,
    usedBytes: used,
    quotaBytes: limit,
    objectCount: brainCount,
    brainUsedBytes: brainBytes,
    source: 'google-drive',
  })
}

function sumFolder_(folder) {
  var bytes = 0
  var count = 0
  var files = folder.getFiles()
  while (files.hasNext()) {
    var f = files.next()
    bytes += Number(f.getSize())
    count += 1
  }
  var subs = folder.getFolders()
  while (subs.hasNext()) {
    var nested = sumFolder_(subs.next())
    bytes += nested.bytes
    count += nested.count
  }
  return { bytes: bytes, count: count }
}

/**
 * Trash everything under BrainUploads (Hiring / ZReports / VoiceRecordings / …).
 * Optionally empty Drive trash when Advanced Drive service is enabled.
 */
function handleWipeBrainUploads_() {
  var rootName =
    PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER') ||
    DEFAULT_DRIVE_ROOT
  var roots = DriveApp.getRootFolder().getFoldersByName(rootName)
  if (!roots.hasNext()) {
    return jsonResponse_({
      ok: true,
      deletedFiles: 0,
      deletedFolders: 0,
      emptiedTrash: false,
      message: rootName + ' folder not found',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    })
  }

  var root = roots.next()
  var counts = { deletedFiles: 0, deletedFolders: 0 }
  wipeFolderContents_(root, counts)

  var emptiedTrash = false
  try {
    if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.emptyTrash) {
      Drive.Files.emptyTrash()
      emptiedTrash = true
    }
  } catch (trashErr) {
    emptiedTrash = false
  }

  return jsonResponse_({
    ok: true,
    deletedFiles: counts.deletedFiles,
    deletedFolders: counts.deletedFolders,
    emptiedTrash: emptiedTrash,
    rootFolder: rootName,
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

function wipeFolderContents_(folder, counts) {
  var files = folder.getFiles()
  while (files.hasNext()) {
    files.next().setTrashed(true)
    counts.deletedFiles += 1
  }
  var folders = folder.getFolders()
  while (folders.hasNext()) {
    var sub = folders.next()
    wipeFolderContents_(sub, counts)
    sub.setTrashed(true)
    counts.deletedFolders += 1
  }
}

function getOrCreateUploadFolder_(subName) {
  var rootName =
    PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER') ||
    DEFAULT_DRIVE_ROOT
  var root = getOrCreateFolderByName_(DriveApp.getRootFolder(), rootName)
  return getOrCreateFolderByName_(root, subName)
}

function getOrCreateFolderByName_(parent, name) {
  var it = parent.getFoldersByName(name)
  if (it.hasNext()) return it.next()
  return parent.createFolder(name)
}

function getOrCreateLogSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var name =
    PropertiesService.getScriptProperties().getProperty('SHEET_NAME') ||
    DEFAULT_SHEET_NAME
  var sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
  }
  return sheet
}

/**
 * Only write full headers if the sheet is empty.
 * Never overwrite an existing header row (protects the ops Excel layout).
 * Existing sheets: ensureJobIdHeader_ may fill M1 when empty (does not touch A–L).
 */
function ensureHeaderRow_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS)
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold')
  }
}

/**
 * Write "JOB ID" into column M (13) header cell when empty.
 * Safe for live ops workbooks: never overwrites a non-empty M1 / template labels.
 */
function ensureJobIdHeader_(sheet) {
  var cell = sheet.getRange(1, COL.JOB_ID)
  if (!String(cell.getValue() || '').trim()) {
    cell.setValue('JOB ID')
    cell.setFontWeight('bold')
  }
}

/**
 * OneSignal Web Push.
 * Script properties: ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY
 *
 * Targeting (priority):
 * 1. body.externalIds: string[] → include_aliases.external_id (Firebase uid)
 * 2. body.roles: string[] → OR tag filters for those roles
 * 3. body.audience === 'all' or omitted → all five app roles (OR)
 * Optional: body.excludeExternalIds → exclude_aliases.external_id (skip actor)
 */
function handlePushNotify_(body) {
  var props = PropertiesService.getScriptProperties()
  var appId = props.getProperty('ONESIGNAL_APP_ID')
  var apiKey = props.getProperty('ONESIGNAL_REST_API_KEY')
  if (!appId || !apiKey) {
    return jsonResponse_(
      {
        ok: false,
        error: 'OneSignal not configured (set ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY)',
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      503,
    )
  }

  var title = String(body.title || "B'RAIN").substring(0, 120)
  var message = String(body.body || '').substring(0, 300)
  if (!message) message = title
  var url = String(body.url || 'https://brain-c5fcb.web.app/management')

  var ALL_PUSH_ROLES = [
    'management',
    'coordinator',
    'media_planning',
    'reporter',
    'human_resources',
  ]

  var payload = {
    app_id: appId,
    target_channel: 'push',
    headings: { en: title, tr: title },
    contents: { en: message, tr: message },
    url: url,
    chrome_web_icon: 'https://brain-c5fcb.web.app/brand/pwa/icon-192.png',
    firefox_icon: 'https://brain-c5fcb.web.app/brand/pwa/icon-192.png',
  }

  var excludeIds = normalizeExternalIds_(body.excludeExternalIds)
  var externalIds = normalizeExternalIds_(body.externalIds).filter(function (id) {
    return excludeIds.indexOf(id) === -1
  })
  if (externalIds.length > 0) {
    // Targeted push by Firebase uid (OneSignal login / external_id)
    payload.include_aliases = { external_id: externalIds }
  } else if (body.externalIds && normalizeExternalIds_(body.externalIds).length > 0) {
    // All targeted recipients were excluded — no-op
    return jsonResponse_({
      ok: true,
      skipped: true,
      reason: 'all_recipients_excluded',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    })
  } else {
    var roles = normalizePushRoles_(body.roles, body.audience, ALL_PUSH_ROLES)
    payload.filters = buildRoleOrFilters_(roles)
    if (excludeIds.length > 0) {
      payload.exclude_aliases = { external_id: excludeIds }
    }
  }

  var response = UrlFetchApp.fetch(
    'https://api.onesignal.com/notifications?c=push',
    {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Key ' + apiKey,
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    },
  )

  var code = response.getResponseCode()
  var text = response.getContentText()
  var parsed = null
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    parsed = null
  }

  if (code < 200 || code >= 300) {
    return jsonResponse_(
      {
        ok: false,
        error:
          (parsed && (parsed.errors || parsed.error)) ||
          'OneSignal HTTP ' + code,
        onesignal: parsed,
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      502,
    )
  }

  return jsonResponse_({
    ok: true,
    onesignal: parsed,
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

/**
 * Create / update OneSignal Audience users (no push subscription yet).
 * body.users: [{ externalId|uid, role, email?, fullName? }]
 */
function handleOnesignalUpsertUsers_(body) {
  var props = PropertiesService.getScriptProperties()
  var appId = props.getProperty('ONESIGNAL_APP_ID')
  var apiKey = props.getProperty('ONESIGNAL_REST_API_KEY')
  if (!appId || !apiKey) {
    return jsonResponse_(
      {
        ok: false,
        error: 'OneSignal not configured (set ONESIGNAL_APP_ID + ONESIGNAL_REST_API_KEY)',
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      503,
    )
  }

  var users = body.users
  if (!users || !(users instanceof Array) || users.length === 0) {
    return jsonResponse_({ ok: false, error: 'users[] required' }, 400)
  }
  if (users.length > 50) {
    return jsonResponse_({ ok: false, error: 'Max 50 users per request' }, 400)
  }

  var results = []
  for (var i = 0; i < users.length; i++) {
    var u = users[i] || {}
    var externalId = String(u.externalId || u.uid || '').trim()
    var role = String(u.role || '').trim()
    if (!externalId || !role) {
      results.push({ ok: false, error: 'externalId and role required', index: i })
      continue
    }
    var payload = {
      identity: { external_id: externalId },
      properties: {
        language: 'tr',
        timezone_id: 'Europe/Istanbul',
        tags: {
          role: role,
          email: String(u.email || '').substring(0, 120),
          fullName: String(u.fullName || '').substring(0, 64),
        },
      },
    }
    var response = UrlFetchApp.fetch(
      'https://api.onesignal.com/apps/' + appId + '/users',
      {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Key ' + apiKey },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true,
      },
    )
    var code = response.getResponseCode()
    var text = response.getContentText()
    var parsed = null
    try {
      parsed = JSON.parse(text)
    } catch (parseErr) {
      parsed = { raw: text }
    }
    results.push({
      ok: code >= 200 && code < 300,
      status: code,
      externalId: externalId,
      role: role,
      onesignal: parsed,
    })
  }

  var okCount = 0
  for (var j = 0; j < results.length; j++) {
    if (results[j].ok) okCount++
  }

  return jsonResponse_({
    ok: okCount === results.length,
    upserted: okCount,
    total: results.length,
    results: results,
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

function normalizeExternalIds_(raw) {
  if (!raw) return []
  var list = Array.isArray(raw) ? raw : [raw]
  var out = []
  var seen = {}
  for (var i = 0; i < list.length; i++) {
    var id = String(list[i] || '').trim()
    if (!id || seen[id]) continue
    seen[id] = true
    out.push(id)
    if (out.length >= 20) break
  }
  return out
}

function normalizePushRoles_(rolesRaw, audience, allRoles) {
  var allowed = {}
  for (var a = 0; a < allRoles.length; a++) {
    allowed[allRoles[a]] = true
  }
  if (audience === 'all' || rolesRaw == null) {
    return allRoles.slice()
  }
  if (!Array.isArray(rolesRaw) || rolesRaw.length === 0) {
    return allRoles.slice()
  }
  var out = []
  var seen = {}
  for (var i = 0; i < rolesRaw.length; i++) {
    var role = String(rolesRaw[i] || '').trim()
    if (!role || !allowed[role] || seen[role]) continue
    seen[role] = true
    out.push(role)
  }
  return out.length > 0 ? out : allRoles.slice()
}

function buildRoleOrFilters_(roles) {
  var filters = []
  for (var i = 0; i < roles.length; i++) {
    if (i > 0) {
      filters.push({ operator: 'OR' })
    }
    filters.push({
      field: 'tag',
      key: 'role',
      relation: '=',
      value: roles[i],
    })
  }
  return filters
}

function jsonResponse_(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
