/**
 * Google Apps Script — Sheets log + Drive file upload (no Firebase Storage / Blaze).
 *
 * IMPORTANT: Do NOT reorder existing columns without an explicit product decision.
 * Ops template cols 1–12 stay fixed (col 12 = Fatura, manual).
 * JOB ID: v13–v34 wrote column M (13); v35+ writes column V (22). Legacy M
 * cell values still match on read; new upserts only write V.
 * v14: pushNotify audience = all five app roles (OR), optional externalIds.
 * v15: onesignalUpsertUsers — create Audience users by Firebase uid + role tag.
 * v16: wipeBrainUploads — trash all files/folders under BrainUploads (management/coordinator).
 * v17: pushNotify excludeExternalIds → OneSignal exclude_aliases.external_id (skip actor).
 * v18: Turkish Drive folder names + rename legacy English folders.
 * v19: resetUserPassword — İK/yönetim/koordinatör temporary Auth password reset
 *      (requires FIREBASE_SERVICE_ACCOUNT_JSON Script property).
 * v20: ROLES_DRIVE includes kameraman (KM kadran foto upload).
 * v21: trashDriveFile — soft-delete previous Drive file on photo replace.
 * v22: pushNotify — when `roles` is a non-empty array, do not expand to all
 *      roles just because `audience` is "all" (İK push was reaching MPU).
 * v23: pushNotify ALL_PUSH_ROLES includes kameraman (evening shoot calendar +
 *      calendar-edit pushes were dropping kameraman because only five roles
 *      were allowlisted while ROLES_PUSH already included Kameraman).
 * v24: uploadFileInit + uploadFileChunk — Drive resumable for large voice files
 *      (Apps Script single base64 body cannot hold 25+ min recordings).
 * v25: uploadFileChunk — do not set Content-Length on UrlFetchApp (throws
 *      "Attribute provided with invalid value: Header:Content-Length").
 * v26: pushNotify role targeting resolves active Firestore user UIDs and
 *      delivers via include_aliases.external_id (tag filters were still
 *      hitting MPU when devices had stale/wrong role tags). Tag filters only
 *      as fallback when SA lookup fails.
 * v27: uploadFileInit/Chunk sessions in ScriptProperties (stable across
 *      multi-minute voice uploads; CacheService alone was dropping mid-way).
 *      Soft-cleanup of stale resume keys on init. Spark/Drive only — no
 *      Firebase Storage / Blaze.
 * v28: uploadDirectInit + uploadDirectFinish — browser uploads the file
 *      binary DIRECTLY to Drive's resumable session URL (no base64, no
 *      per-chunk webhook round-trips). Init passes the browser Origin so
 *      Drive answers the client's CORS PUTs; finish sets sharing + links.
 * v29: Çekildi/DK never inserts a new Excel row. Stronger findRow: JOB ID,
 *      firma+iş alım/çekim günü, sıkıştırılmış firma adı, tekil firma.
 *      TARİH Date cells always Europe/Istanbul.
 * v30: TARİH is çekim günü only (`dd.MM.yyyy` Date, never a time string).
 *      Mixed "12.08.2026 18:00" text was overflowing into FİRMA ADI.
 * v31: getDriveFile — authenticated base64 of a BrainUploads file so the
 *      site can play voice in-page (Drive usercontent CORS/CORP 403s the SPA).
 * v32: findRow never overwrites a row that already has a different JOB ID
 *      (fuzzy/phone match only on legacy empty JOB ID cells). deleteJobRow
 *      removes a Konfirme row on revert/reject (JOB ID only, never fuzzy).
 * v33: MPU create writes Onay bekliyor + JOB ID. Reject deletes the pending
 *      row. Revert restores Onay bekliyor. Çekildi still never inserts.
 * v34: 48h auto-cancel pending writes SON DURUM İptal edildi (same as manual
 *      cancel upsert) — no longer deletes the Excel row.
 * v35: JOB ID column moves from M (13) to V (22). New writes only to V;
 *      findRow still matches legacy M. M1 "JOB ID" header cleared when present.
 * v36: Monthly tabs by çekim tarihi — "Eylül 2026". JOB ID search across
 *      target ±2 months + legacy IslemLogu. Row moves when shoot month changes.
 * v37: deleteJobRow / JOB ID scan always includes base month (offset 0) so
 *      rejects without tarih still find the current month tab (e.g. Eylül 2026).
 * v38: shootTarihFromBody_ prefers plannedTarih/cekTarih over tarih so
 *      updateDkHaber finds the çekim month tab (acquired-as-tarih was missing
 *      rows → empty DK/KAZANÇ while SON DURUM could still be Çekildi).
 *
 * SON DURUM values:
 *   Onay bekliyor | Konfirme | Çekildi | İptal edildi
 *   (Reddet → Excel satırı silinir; “Reddedildi” yazılmaz)
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
 *   FIREBASE_SERVICE_ACCOUNT_JSON = full Firebase/Google SA JSON (required for resetUserPassword)
 *   WEBHOOK_SECRET = optional legacy fallback for one version (remove after clients ship idToken)
 *   ONESIGNAL_APP_ID = OneSignal App ID (optional; for pushNotify)
 *   ONESIGNAL_REST_API_KEY = OneSignal REST API Key (optional; for pushNotify)
 *
 * Client must send idToken in JSON/form body (or Authorization: Bearer when available).
 * doGet ping stays public (version/features only — no secrets).
 */

var SCRIPT_SERVICE = 'brain-sheets-drive-webhook-v37'
var SCRIPT_VERSION = 'v38'
var FIREBASE_PROJECT_ID = 'brain-c5fcb'
var DEFAULT_SHEET_NAME = 'IslemLogu'
var DEFAULT_DRIVE_ROOT = 'BrainUploads'

/** Turkish month names for sheet tabs (index 0 = January). */
var TR_MONTH_NAMES = [
  'Ocak',
  'Şubat',
  'Mart',
  'Nisan',
  'Mayıs',
  'Haziran',
  'Temmuz',
  'Ağustos',
  'Eylül',
  'Ekim',
  'Kasım',
  'Aralık',
]

/** Roles that may mutate sheets / Drive / push (when customClaims.role is present). */
var ROLES_SHEET = {
  reporter: true,
  media_planning: true,
  coordinator: true,
  management: true,
  sef: true,
}
var ROLES_DRIVE = {
  reporter: true,
  media_planning: true,
  human_resources: true,
  coordinator: true,
  management: true,
  kameraman: true,
  sef: true,
}
/** Callers of notify* → pushNotify (audience default = all five role tags; optional externalIds). */
var ROLES_PUSH = {
  media_planning: true,
  reporter: true,
  human_resources: true,
  coordinator: true,
  management: true,
  kameraman: true,
  sef: true,
}

/**
 * Fixed ops template — do not reorder cols 1–12 without approval.
 * Col 11 is unused (legacy “MERVE HANIM” label may still exist in live workbooks);
 * the app never writes that column. Col 12 = fatura (manual).
 * JOB ID: v35+ column V (22). Legacy values may remain in M (13).
 * ensureHeaderRow_ only runs on empty sheets — existing header rows are never
 * fully overwritten; ensureJobIdHeader_ writes V1 and clears stale M1 “JOB ID”.
 */
var OPS_COL_COUNT = 12
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
  /** Pre-v35 JOB ID column (M). Read-only for matching. */
  JOB_ID_LEGACY: 13,
  /** v35+ JOB ID column (V). */
  JOB_ID: 22,
}

/** Drive subfolder display names (Turkish). Keys stay stable in client uploads. */
var FOLDER_NAMES = {
  hiring: 'İş görüşmesi raporu',
  'z-reports': 'Z raporu',
  'voice-recordings': 'Ses kayıtları',
  'hr-reports': 'Günlük İK raporu',
  odometer: 'Kameraman KM Raporları',
  // Backward-compatible alias for clients deployed before the odometer key.
  'kameraman-km': 'Kameraman KM Raporları',
}

/** Old English folder names → renamed to FOLDER_NAMES on first upload after deploy. */
var FOLDER_LEGACY_NAMES = {
  hiring: ['Hiring'],
  'z-reports': ['ZReports', 'Z Reports'],
  'voice-recordings': ['VoiceRecordings', 'Voice Recordings'],
  'hr-reports': ['HrReports', 'HRReports', 'HR Reports'],
  odometer: ['KameramanKm', 'Kameraman KM', 'Odometer'],
  'kameraman-km': ['KameramanKm', 'Kameraman KM', 'Odometer'],
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
    if (body.action === 'uploadFileInit') {
      return handleUploadInit_(body)
    }
    if (body.action === 'uploadFileChunk') {
      return handleUploadChunk_(body)
    }
    if (body.action === 'uploadDirectInit') {
      return handleUploadDirectInit_(body)
    }
    if (body.action === 'uploadDirectFinish') {
      return handleUploadDirectFinish_(body)
    }
    if (body.action === 'trashDriveFile') {
      return handleTrashDriveFile_(body)
    }
    if (body.action === 'getDriveFile') {
      return handleGetDriveFile_(body)
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
    if (body.action === 'deleteJobRow') {
      return handleDeleteJobRow_(body)
    }
    if (body.action === 'pushNotify') {
      return handlePushNotify_(body)
    }
    if (body.action === 'onesignalUpsertUsers') {
      return handleOnesignalUpsertUsers_(body)
    }
    if (body.action === 'resetUserPassword') {
      return handleResetUserPassword_(body, auth.user)
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
        'Invalid request (expected upsertJobRow/updateSonDurum/updateDkHaber/deleteJobRow/uploadFile/uploadFileInit/uploadFileChunk/uploadDirectInit/uploadDirectFinish/trashDriveFile/getDriveFile/uploadResult/driveStorageUsage/wipeBrainUploads/pushNotify/onesignalUpsertUsers/resetUserPassword)',
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
        'deleteJobRow',
        'uploadFile',
        'uploadFileInit',
        'uploadFileChunk',
        'uploadDirectInit',
        'uploadDirectFinish',
        'trashDriveFile',
        'getDriveFile',
        'uploadResult',
        'driveStorageUsage',
        'wipeBrainUploads',
        'pushNotify',
        'onesignalUpsertUsers',
        'resetUserPassword',
        'firebaseIdTokenAuth',
        'monthlySheets',
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
  // Password reset: known non-admin roles blocked here; empty claim deferred to
  // handler (resolves role from Firestore via service account).
  if (action === 'resetUserPassword') {
    if (!role) return true
    return (
      role === 'management' ||
      role === 'coordinator' ||
      role === 'human_resources'
    )
  }

  // No custom claim → allow any verified user for non-push; push also allowed
  // when claim missing (Firestore remains authoritative for app RBAC).
  if (!role) return true

  if (action === 'pushNotify') {
    return Boolean(ROLES_PUSH[role])
  }
  if (action === 'onesignalUpsertUsers' || action === 'wipeBrainUploads') {
    return role === 'management' || role === 'coordinator'
  }
  if (action === 'getDriveFile') {
    return role === 'management'
      || role === 'coordinator'
      || role === 'sef'
      || role === 'reporter'
      || role === 'human_resources'
  }
  if (
    action === 'uploadFile' ||
    action === 'uploadFileInit' ||
    action === 'uploadFileChunk' ||
    action === 'uploadDirectInit' ||
    action === 'uploadDirectFinish' ||
    action === 'uploadResult' ||
    action === 'driveStorageUsage' ||
    action === 'trashDriveFile'
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

  // Password reset never accepts legacy webhook secret.
  if (action === 'resetUserPassword') {
    return {
      ok: false,
      response: jsonResponse_(
        {
          ok: false,
          error: 'Unauthorized',
          detail: 'idToken required for resetUserPassword',
          service: SCRIPT_SERVICE,
          version: SCRIPT_VERSION,
        },
        401,
      ),
    }
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
 * Writes to the monthly tab for çekim tarihi (e.g. Eylül 2026).
 * Preserves fatura, unused col 11, DK, HABER and KAZANÇ cells on update
 * (DK/HABER/KAZANÇ are written by the daily reporter report — status upserts
 * must not wipe them). If the row lives on another month tab, it is moved.
 */
function handleUpsertJobRow_(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var targetSheet = getOrCreateLogSheetForBody_(body)
  var rowValues = buildJobRowValues_(body)
  var loc = findRowLocation_(ss, body)

  if (loc && loc.row > 1) {
    var sourceSheet = loc.sheet
    var existingRow = loc.row
    var faturaVal = sourceSheet.getRange(existingRow, COL.FATURA).getValue()
    rowValues[COL.FATURA - 1] = faturaVal
    var unused11Val = sourceSheet.getRange(existingRow, COL.UNUSED_11).getValue()
    rowValues[COL.UNUSED_11 - 1] = unused11Val
    var dkCol = findHeaderColumn_(sourceSheet, 'DK', COL.DK)
    var haberCol = findHeaderColumn_(sourceSheet, 'HABER', COL.HABER)
    var kazancCol = findKazancColumn_(sourceSheet)
    rowValues[COL.DK - 1] = sourceSheet.getRange(existingRow, dkCol).getValue()
    rowValues[COL.HABER - 1] = sourceSheet.getRange(existingRow, haberCol).getValue()
    rowValues[COL.KAZANC - 1] = sourceSheet.getRange(existingRow, kazancCol).getValue()

    if (sourceSheet.getSheetId() !== targetSheet.getSheetId()) {
      // Shoot month changed — move row to the target month tab (append then delete).
      targetSheet.appendRow(rowValues)
      var movedRow = targetSheet.getLastRow()
      writeJobIdToPrimary_(targetSheet, movedRow, body)
      writeTarihCell_(targetSheet, movedRow, body.tarih || body.plannedTarih || '')
      writeOptionalInstagramColumn_(targetSheet, movedRow, body)
      sourceSheet.deleteRow(existingRow)
      return jsonResponse_({
        ok: true,
        moved: true,
        inserted: true,
        row: movedRow,
        sheet: targetSheet.getName(),
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      })
    }

    // Same month tab — in-place update (ops cols 1–12 only).
    sheetApplyOpsRowUpdate_(targetSheet, existingRow, rowValues, body)
    return jsonResponse_({
      ok: true,
      updated: true,
      row: existingRow,
      sheet: targetSheet.getName(),
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    })
  }

  // Çekildi must patch the Konfirme row — never append a duplicate Excel record.
  if (String(rowValues[COL.SON_DURUM - 1] || '').trim() === 'Çekildi') {
    return jsonResponse_({
      ok: false,
      error: 'Row not found (match JOB ID or FİRMA ADI + TARİH)',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    }, 404)
  }

  targetSheet.appendRow(rowValues)
  var insertedRow = targetSheet.getLastRow()
  writeJobIdToPrimary_(targetSheet, insertedRow, body)
  writeTarihCell_(targetSheet, insertedRow, body.tarih || body.plannedTarih || '')
  writeOptionalInstagramColumn_(targetSheet, insertedRow, body)
  return jsonResponse_({
    ok: true,
    inserted: true,
    row: insertedRow,
    sheet: targetSheet.getName(),
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

/** In-place ops update on an existing row (same sheet). */
function sheetApplyOpsRowUpdate_(sheet, existingRow, rowValues, body) {
  sheet.getRange(existingRow, 1, 1, OPS_COL_COUNT).setValues([rowValues])
  writeJobIdToPrimary_(sheet, existingRow, body)
  writeTarihCell_(sheet, existingRow, body.tarih || body.plannedTarih || '')
  writeOptionalInstagramColumn_(sheet, existingRow, body)
}

/**
 * If the sheet has an INSTAGRAM header (any column), fill it from body.instagram.
 * Never creates/reorders columns — missing header = no-op.
 */
function writeOptionalInstagramColumn_(sheet, row, body) {
  if (!Object.prototype.hasOwnProperty.call(body, 'instagram')) return
  var col = findHeaderColumn_(sheet, 'INSTAGRAM', 0)
  if (!col || col < 1) return
  sheet.getRange(row, col).setValue(String(body.instagram || ''))
}

function handleUpdateSonDurum_(body) {
  var sonDurum = String(body.sonDurum || '').trim()
  if (!sonDurum) {
    return jsonResponse_({ ok: false, error: 'Missing sonDurum' }, 400)
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var loc = findRowLocation_(ss, body)
  if (!loc || loc.row < 2) {
    return jsonResponse_({
      ok: false,
      error: 'Row not found (match JOB ID or FİRMA ADI + TARİH)',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    }, 404)
  }

  var sheet = loc.sheet
  prepareLogSheet_(sheet)
  var existingRow = loc.row
  var sonDurumCol = findHeaderColumn_(sheet, 'SON DURUM', COL.SON_DURUM)
  sheet.getRange(existingRow, sonDurumCol).setValue(sonDurum)
  writeJobIdIfPresent_(sheet, existingRow, body)

  return jsonResponse_({
    ok: true,
    updated: true,
    row: existingRow,
    sheet: sheet.getName(),
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

/**
 * Patch DK + HABER + KAZANÇ (and optional SON DURUM) for daily reporter report.
 * Always updates an existing row — never appends.
 * Match: JOB ID across month tabs, then best firma/phone/tarih on target/legacy.
 * Optional body.sonDurum (e.g. "Çekildi") is written in the same request so a
 * later status-only patch cannot race-clear money columns.
 */
function handleUpdateDkHaber_(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var loc = findRowLocation_(ss, body)
  if (!loc || loc.row < 2) {
    return jsonResponse_({
      ok: false,
      error: 'Row not found (match JOB ID or FİRMA ADI + TARİH)',
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    }, 404)
  }

  var sheet = loc.sheet
  prepareLogSheet_(sheet)
  var existingRow = loc.row

  var dkCol = findHeaderColumn_(sheet, 'DK', COL.DK)
  var haberCol = findHeaderColumn_(sheet, 'HABER', COL.HABER)
  var kazancCol = findKazancColumn_(sheet)
  sheet.getRange(existingRow, dkCol).setValue(String(body.dk != null ? body.dk : ''))
  sheet.getRange(existingRow, haberCol).setValue(String(body.haber != null ? body.haber : ''))
  if (Object.prototype.hasOwnProperty.call(body, 'kazanc')) {
    sheet.getRange(existingRow, kazancCol).setValue(String(body.kazanc != null ? body.kazanc : ''))
  }

  var sonDurum = String(body.sonDurum || '').trim()
  if (sonDurum) {
    var sonDurumCol = findHeaderColumn_(sheet, 'SON DURUM', COL.SON_DURUM)
    sheet.getRange(existingRow, sonDurumCol).setValue(sonDurum)
  }

  writeJobIdIfPresent_(sheet, existingRow, body)
  var plannedDay = String(body.plannedTarih || body.cekTarih || '').trim()
  if (plannedDay) {
    writeTarihCell_(sheet, existingRow, plannedDay)
  } else {
    normalizeTarihCell_(sheet, existingRow)
  }

  return jsonResponse_({
    ok: true,
    updated: true,
    row: existingRow,
    sheet: sheet.getName(),
    kazancCol: kazancCol,
    wroteKazanc: Object.prototype.hasOwnProperty.call(body, 'kazanc'),
    wroteSonDurum: Boolean(sonDurum),
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

/**
 * Remove the Excel row for a Firestore job (revert to pending / reject).
 * JOB ID only — never fuzzy-match, never delete another job's row.
 * Missing row is success (idempotent). Searches month tabs + legacy IslemLogu.
 */
function handleDeleteJobRow_(body) {
  var jobId = resolveJobId_(body)
  if (!jobId) {
    return jsonResponse_({ ok: false, error: 'Missing jobId' }, 400)
  }

  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var loc = findRowByJobIdAcrossSheets_(ss, body)
  if (!loc || loc.row < 2) {
    return jsonResponse_({
      ok: true,
      deleted: false,
      service: SCRIPT_SERVICE,
      version: SCRIPT_VERSION,
    })
  }

  loc.sheet.deleteRow(loc.row)
  return jsonResponse_({
    ok: true,
    deleted: true,
    row: loc.row,
    sheet: loc.sheet.getName(),
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
  // Ops template cols 1–12 only. JOB ID is written separately to column V.
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

/**
 * Primary JOB ID write column (V / header). After ensureJobIdHeader_, M1 is no
 * longer labeled JOB ID so the first header match is V.
 */
function findJobIdColumn_(sheet) {
  return findHeaderColumn_(sheet, 'JOB ID', COL.JOB_ID)
}

/** Pre-v35 JOB ID column (M) — read-only for matching. */
function findLegacyJobIdColumn_() {
  return COL.JOB_ID_LEGACY
}

/** Resolve Firestore job id from body (jobId preferred; isId legacy alias). */
function resolveJobId_(body) {
  return String(body.jobId || body.isId || '').trim()
}

/**
 * Write JOB ID to primary column V only (never clears legacy M).
 * If body omits jobId, backfill V from existing V or legacy M when empty.
 */
function writeJobIdToPrimary_(sheet, row, body) {
  if (row < 2) return
  var primaryCol = findJobIdColumn_(sheet)
  var jobId = resolveJobId_(body)
  if (jobId) {
    sheet.getRange(row, primaryCol).setValue(jobId)
    return
  }
  var existing = String(sheet.getRange(row, primaryCol).getValue() || '').trim()
  if (existing) return
  var legacy = String(
    sheet.getRange(row, findLegacyJobIdColumn_()).getValue() || '',
  ).trim()
  if (legacy) {
    sheet.getRange(row, primaryCol).setValue(legacy)
  }
}

/**
 * Prefer JOB ID; then best existing firma/phone/tarih row among *legacy*
 * rows (empty JOB ID). Never overwrite a row that already has a different JOB ID.
 * Keep cascade in sync with `pickSheetRow` in src/features/jobs/utils/sheetRowMatch.ts.
 * Çekildi / DK patches must never append a row — only update.
 */
function findRow_(sheet, body) {
  var byJobId = findRowByJobId_(sheet, body)
  if (byJobId > 1) return byJobId

  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return -1

  var jobId = resolveJobId_(body)
  var firmaCol = findHeaderColumn_(sheet, 'FİRMA ADI', COL.FIRMA_ADI)
  var tarihCol = findHeaderColumn_(sheet, 'TARİH', COL.TARIH)
  var telCol = findHeaderColumn_(sheet, 'TEL NO', COL.TEL_NO)
  var sonDurumCol = findHeaderColumn_(sheet, 'SON DURUM', COL.SON_DURUM)
  var sahibiCol = findHeaderColumn_(sheet, 'FİRMA SAHİBİ', COL.FIRMA_SAHIBI)
  var jobIdCol = findJobIdColumn_(sheet)
  var legacyJobIdCol = findLegacyJobIdColumn_()
  var numRows = lastRow - 1
  var firmas = sheet.getRange(2, firmaCol, numRows, 1).getValues()
  var tarihs = sheet.getRange(2, tarihCol, numRows, 1).getValues()
  var tels = sheet.getRange(2, telCol, numRows, 1).getValues()
  var sonDurums = sheet.getRange(2, sonDurumCol, numRows, 1).getValues()
  var sahibis = sheet.getRange(2, sahibiCol, numRows, 1).getValues()
  var jobIds = sheet.getRange(2, jobIdCol, numRows, 1).getValues()
  var legacyJobIds =
    legacyJobIdCol !== jobIdCol
      ? sheet.getRange(2, legacyJobIdCol, numRows, 1).getValues()
      : jobIds
  var sheetTz = sheetTimeZone_(sheet)

  var dayKeys = collectTarihDayKeys_(body)
  var queryFirma = String(body.firmaAdi || body.firma || '')
  var firmaCompact = compactFirmaKey_(queryFirma)
  var phoneKey = phoneDigitsKey_(body.telNo || body.telefon || '')
  var sahibiKey = normalizeFirmaKey_(body.firmaSahibi || body.yetkili || '')

  var bestRow = -1
  var bestScore = 0
  for (var i = 0; i < firmas.length; i++) {
    var row = i + 2
    // jobId present but not in sheet: only legacy rows with empty JOB ID (V and M).
    // Never overwrite a row owned by a different Firestore job.
    var occupiedPrimary = String(jobIds[i][0] || '').trim()
    var occupiedLegacy = String(legacyJobIds[i][0] || '').trim()
    if (jobId && (occupiedPrimary || occupiedLegacy)) continue
    var sheetFirma = String(firmas[i][0] || '')
    var fCompact = compactFirmaKey_(sheetFirma)
    var compactHit = Boolean(firmaCompact && fCompact === firmaCompact)
    var containsHit = !compactHit && queryFirma && firmaContainsMatch_(queryFirma, sheetFirma)
    var fuzzyHit = !compactHit && !containsHit && queryFirma && firmaFuzzyMatch_(queryFirma, sheetFirma)
    var phone = phoneDigitsKey_(tels[i][0])
    var phoneHit = Boolean(phoneKey && phone && phone === phoneKey)
    var sahibiHit = Boolean(
      sahibiKey && normalizeFirmaKey_(sahibis[i][0]) === sahibiKey,
    )
    if (!compactHit && !containsHit && !fuzzyHit && !phoneHit && !sahibiHit) continue

    var score = 0
    if (compactHit) score += 400
    else if (containsHit) score += 300
    else if (fuzzyHit) score += 250
    if (phoneHit) score += 80
    if (sahibiHit) score += 40
    if (isOpenSonDurum_(sonDurums[i][0])) score += 30

    var dist = cellDayDistance_(tarihs[i][0], dayKeys, sheetTz)
    if (dist === 0) score += 500
    else if (dist === 1) score += 350
    else if (dist >= 0 && dist < 60) score += Math.max(0, 200 - dist)

    if (score > bestScore || (score === bestScore && score > 0 && row > bestRow)) {
      bestScore = score
      bestRow = row
    }
  }
  return bestRow > 1 ? bestRow : -1
}

function collectTarihDayKeys_(body) {
  var keys = {}
  var candidates = [body.tarih, body.plannedTarih, body.cekTarih, body.acquiredTarih]
  for (var i = 0; i < candidates.length; i++) {
    var k = tarihDayKey_(candidates[i])
    if (k) keys[k] = true
  }
  return keys
}

function sheetTimeZone_(sheet) {
  try {
    return sheet.getParent().getSpreadsheetTimeZone() || 'Europe/Istanbul'
  } catch (e) {
    return 'Europe/Istanbul'
  }
}

function cellDayDistance_(value, dayKeys, sheetTz) {
  var cellKeys = cellDayKeys_(value, sheetTz)
  var targets = []
  for (var k in dayKeys) {
    if (dayKeys[k]) targets.push(k)
  }
  if (!cellKeys.length || !targets.length) return -1
  var best = 9999
  for (var i = 0; i < cellKeys.length; i++) {
    var n = isoToUtcDays_(cellKeys[i])
    if (n < 0) continue
    for (var t = 0; t < targets.length; t++) {
      var tn = isoToUtcDays_(targets[t])
      if (tn < 0) continue
      var d = Math.abs(n - tn)
      if (d < best) best = d
    }
  }
  return best === 9999 ? -1 : best
}

function isoToUtcDays_(iso) {
  var m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return -1
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86400000
}

function cellDayKeys_(value, sheetTz) {
  var keys = []
  var seen = {}
  function add(key) {
    if (key && !seen[key]) {
      seen[key] = true
      keys.push(key)
    }
  }
  var asDate = coerceSheetDate_(value)
  if (asDate) {
    add(Utilities.formatDate(asDate, 'Europe/Istanbul', 'yyyy-MM-dd'))
    add(Utilities.formatDate(asDate, 'UTC', 'yyyy-MM-dd'))
    add(Utilities.formatDate(asDate, sheetTz || 'Europe/Istanbul', 'yyyy-MM-dd'))
  }
  add(tarihDayKey_(formatSheetTarihCell_(value)))
  return keys
}

function coerceSheetDate_(value) {
  if (value && Object.prototype.toString.call(value) === '[object Date]') {
    if (!isNaN(value.getTime())) return value
    return null
  }
  if (typeof value === 'number' && isFinite(value) && value > 20000 && value < 80000) {
    return new Date(Math.round((value - 25569) * 86400 * 1000))
  }
  return null
}

function normalizeFirmaKey_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('tr-TR')
}

function foldTrAscii_(value) {
  return String(value || '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
}

function compactFirmaKey_(value) {
  return foldTrAscii_(normalizeFirmaKey_(value))
    .replace(/[.'’`]/g, '')
    .replace(/\b(ltd|sti|as|inc|co)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function firmaContainsMatch_(a, b) {
  var ca = compactFirmaKey_(a)
  var cb = compactFirmaKey_(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  if (ca.length < 5 || cb.length < 5) return false
  return ca.indexOf(cb) !== -1 || cb.indexOf(ca) !== -1
}

function levenshtein_(a, b) {
  if (a === b) return 0
  var m = a.length
  var n = b.length
  if (!m) return n
  if (!n) return m
  var prev = []
  var cur = []
  var j
  for (j = 0; j <= n; j++) prev[j] = j
  for (var i = 1; i <= m; i++) {
    cur[0] = i
    for (j = 1; j <= n; j++) {
      var cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    for (j = 0; j <= n; j++) prev[j] = cur[j]
  }
  return prev[n]
}

function firmaFuzzyMatch_(a, b) {
  var ca = compactFirmaKey_(a)
  var cb = compactFirmaKey_(b)
  if (!ca || !cb) return false
  if (ca === cb) return true
  var maxLen = Math.max(ca.length, cb.length)
  if (maxLen < 5) return false
  var dist = levenshtein_(ca, cb)
  return dist <= (maxLen >= 10 ? 2 : 1)
}

function pad2_(n) {
  n = String(n || '')
  return n.length === 1 ? '0' + n : n
}

function tarihDayKey_(value) {
  var raw = String(value || '').trim()
  if (!raw) return ''
  var iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return iso[1] + '-' + iso[2] + '-' + iso[3]
  var dmy = raw.match(/(\d{1,2})[./-](\d{1,2})[./-](\d{4})/)
  if (dmy) return dmy[3] + '-' + pad2_(dmy[2]) + '-' + pad2_(dmy[1])
  return ''
}

function phoneDigitsKey_(value) {
  var digits = String(value || '').replace(/\D/g, '')
  if (digits.indexOf('90') === 0 && digits.length >= 12) digits = digits.slice(2)
  if (digits.charAt(0) === '0') digits = digits.slice(1)
  return digits.length >= 10 ? digits : ''
}

function isOpenSonDurum_(value) {
  var s = String(value || '').trim().toLocaleLowerCase('tr-TR')
  return !s || s === 'konfirme' || s === 'onay bekliyor'
}

function formatSheetTarihCell_(value) {
  var asDate = coerceSheetDate_(value)
  if (asDate) {
    return Utilities.formatDate(asDate, 'Europe/Istanbul', 'dd.MM.yyyy')
  }
  return String(value || '').trim()
}

/**
 * Write TARİH as a real Date at noon Istanbul, format dd.MM.yyyy.
 * Strips times so "12.08.2026 18:00" cannot overflow into FİRMA ADI.
 */
function writeTarihCell_(sheet, row, value) {
  if (row < 2) return
  var col = findHeaderColumn_(sheet, 'TARİH', COL.TARIH)
  var cell = sheet.getRange(row, col)
  cell.setNumberFormat('dd.MM.yyyy')
  var parsed = sheetDateFromDayString_(value)
  if (parsed) cell.setValue(parsed)
}

function normalizeTarihCell_(sheet, row) {
  if (row < 2) return
  var col = findHeaderColumn_(sheet, 'TARİH', COL.TARIH)
  var current = formatSheetTarihCell_(sheet.getRange(row, col).getValue())
  if (tarihDayKey_(current)) writeTarihCell_(sheet, row, current)
}

function sheetDateFromDayString_(value) {
  var key = tarihDayKey_(value)
  if (!key) return null
  var parts = key.split('-')
  // 09:00 UTC = 12:00 Europe/Istanbul — stays on the same calendar day.
  return new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 9, 0, 0))
}

/** Match last row with same JOB ID (primary V, then legacy M). */
function findRowByJobId_(sheet, body) {
  var jobId = resolveJobId_(body)
  if (!jobId) return -1

  var lastRow = sheet.getLastRow()
  if (lastRow < 2) return -1

  var numRows = lastRow - 1
  var primaryCol = findJobIdColumn_(sheet)
  var found = scanJobIdColumn_(sheet, primaryCol, numRows, jobId)
  if (found > 1) return found

  var legacyCol = findLegacyJobIdColumn_()
  if (legacyCol !== primaryCol) {
    found = scanJobIdColumn_(sheet, legacyCol, numRows, jobId)
  }
  return found
}

function scanJobIdColumn_(sheet, col, numRows, jobId) {
  if (!col || col < 1 || numRows < 1) return -1
  var values = sheet.getRange(2, col, numRows, 1).getValues()
  var found = -1
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === jobId) {
      found = i + 2
    }
  }
  return found
}

/** Backfill JOB ID into primary V when matching a legacy row. */
function writeJobIdIfPresent_(sheet, row, body) {
  writeJobIdToPrimary_(sheet, row, body)
}

function handleUpload_(body) {
  if (!body.base64 || !body.fileName) {
    cacheUploadResult_(body.uploadToken, { ok: false, error: 'Missing file' })
    return jsonResponse_({ ok: false, error: 'Missing file' }, 400)
  }

  try {
    var folderKey = body.folder || 'misc'
    var subName = FOLDER_NAMES[folderKey] || 'Diğer'
    var folder = getOrCreateUploadFolder_(subName, folderKey)
    // Optional nested path (e.g. "Ali_Veli_2026-05-19" under Kameraman KM Raporları).
    var folderPath = String(body.folderPath || '').trim()
    if (folderPath) {
      var pathParts = folderPath.split('/')
      for (var pi = 0; pi < pathParts.length; pi += 1) {
        var part = String(pathParts[pi] || '')
          .trim()
          .replace(/[\\/]+/g, '')
          .slice(0, 120)
        if (part) {
          folder = getOrCreateFolderByName_(folder, part)
        }
      }
    }
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

/**
 * Start a Drive v3 resumable upload session (large voice / files).
 * Session stored in ScriptProperties (stable for multi-minute uploads).
 */
function handleUploadInit_(body) {
  var uploadToken = String(body.uploadToken || '').trim()
  if (!uploadToken || uploadToken.length > 80) {
    return jsonResponse_({ ok: false, error: 'Missing uploadToken' }, 400)
  }
  var totalBytes = Number(body.totalBytes || 0)
  if (!(totalBytes > 0) || totalBytes > 80 * 1024 * 1024 || totalBytes !== Math.floor(totalBytes)) {
    return jsonResponse_({ ok: false, error: 'Invalid size' }, 400)
  }
  if (!body.fileName) {
    return jsonResponse_({ ok: false, error: 'Missing fileName' }, 400)
  }

  try {
    cleanupStaleResumeSessions_()
    var folderKey = body.folder || 'misc'
    var subName = FOLDER_NAMES[folderKey] || 'Diğer'
    var folder = getOrCreateUploadFolder_(subName, folderKey)
    var folderPath = String(body.folderPath || '').trim()
    if (folderPath) {
      var pathParts = folderPath.split('/')
      for (var pi = 0; pi < pathParts.length; pi += 1) {
        var part = String(pathParts[pi] || '')
          .trim()
          .replace(/[\\/]+/g, '')
          .slice(0, 120)
        if (part) {
          folder = getOrCreateFolderByName_(folder, part)
        }
      }
    }

    var mimeType = String(body.mimeType || 'application/octet-stream').slice(0, 120)
    var fileName = String(body.fileName).slice(0, 180)
    var metadata = {
      name: fileName,
      parents: [folder.getId()],
    }
    var oauth = ScriptApp.getOAuthToken()
    var resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          Authorization: 'Bearer ' + oauth,
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(totalBytes),
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
      },
    )
    var code = resp.getResponseCode()
    if (code < 200 || code >= 300) {
      return jsonResponse_(
        {
          ok: false,
          error: 'Drive resumable session failed',
          detail: String(resp.getContentText() || '').substring(0, 280),
        },
        502,
      )
    }
    var headers = resp.getAllHeaders()
    var location =
      headers.Location ||
      headers.location ||
      headers['Location'] ||
      headers['location']
    if (!location) {
      return jsonResponse_({ ok: false, error: 'No resumable location' }, 502)
    }

    putResumeSession_(uploadToken, {
      location: String(location),
      total: totalBytes,
      next: 0,
      mimeType: mimeType,
      createdAt: Date.now(),
    })
    return jsonResponse_({ ok: true, resumed: true, totalBytes: totalBytes })
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Upload init failed'
    return jsonResponse_({ ok: false, error: message }, 500)
  }
}

/**
 * PUT one content range into an existing Drive resumable session.
 */
function handleUploadChunk_(body) {
  var uploadToken = String(body.uploadToken || '').trim()
  if (!uploadToken) {
    return jsonResponse_({ ok: false, error: 'Missing uploadToken' }, 400)
  }
  if (!body.base64) {
    return jsonResponse_({ ok: false, error: 'Missing chunk' }, 400)
  }

  var session = getResumeSession_(uploadToken)
  if (!session) {
    return jsonResponse_(
      { ok: false, error: 'Upload session expired. Retry.' },
      400,
    )
  }

  var start = Number(body.byteStart)
  var end = Number(body.byteEnd)
  var total = Number(body.totalBytes || session.total || 0)
  if (
    !isFinite(start) ||
    !isFinite(end) ||
    start < 0 ||
    end < start ||
    total <= 0
  ) {
    return jsonResponse_({ ok: false, error: 'Invalid byte range' }, 400)
  }
  if (start !== Number(session.next || 0)) {
    return jsonResponse_(
      {
        ok: false,
        error: 'Chunk order mismatch',
        expected: session.next,
      },
      400,
    )
  }

  try {
    var bytes = Utilities.base64Decode(body.base64)
    var expectedLen = end - start + 1
    if (bytes.length !== expectedLen) {
      return jsonResponse_(
        {
          ok: false,
          error: 'Chunk size mismatch',
          detail: 'got ' + bytes.length + ' expected ' + expectedLen,
        },
        400,
      )
    }

    var mimeType =
      String(body.mimeType || session.mimeType || 'application/octet-stream').slice(
        0,
        120,
      )
    // UrlFetchApp forbids setting Content-Length (computes it from payload).
    // Content-Range is required for Drive resumable; Authorization optional once
    // the session Location was minted with ScriptApp token.
    var chunkBlob = Utilities.newBlob(bytes, mimeType)
    var oauth = ScriptApp.getOAuthToken()
    var resp = UrlFetchApp.fetch(String(session.location), {
      method: 'put',
      contentType: mimeType,
      headers: {
        Authorization: 'Bearer ' + oauth,
        'Content-Range': 'bytes ' + start + '-' + end + '/' + total,
      },
      payload: chunkBlob.getBytes(),
      muteHttpExceptions: true,
    })
    var code = resp.getResponseCode()
    var text = String(resp.getContentText() || '')

    // Intermediate: 308 Resume Incomplete
    if (code === 308) {
      session.next = end + 1
      // Prefer Drive's reported Range end if present
      try {
        var respHeaders = resp.getAllHeaders()
        var rangeHdr =
          respHeaders.Range ||
          respHeaders.range ||
          respHeaders['Range'] ||
          respHeaders['range'] ||
          ''
        // e.g. "bytes=0-12345"
        var m = String(rangeHdr).match(/bytes=\d+-(\d+)/)
        if (m && m[1]) {
          session.next = Number(m[1]) + 1
        }
      } catch (rangeErr) {}
      putResumeSession_(uploadToken, session)
      return jsonResponse_({
        ok: true,
        pending: true,
        next: session.next,
      })
    }

    if (code >= 200 && code < 300) {
      var file = null
      try {
        file = JSON.parse(text)
      } catch (jErr) {
        file = null
      }
      var fileId = file && file.id ? String(file.id) : ''
      if (!fileId) {
        return jsonResponse_(
          {
            ok: false,
            error: 'Drive upload finished without file id',
            detail: text.substring(0, 280),
          },
          502,
        )
      }
      try {
        DriveApp.getFileById(fileId).setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW,
        )
      } catch (shareErr) {
        // Sharing is best-effort; link may still work for signed-in users.
      }
      var webView = ''
      try {
        webView = DriveApp.getFileById(fileId).getUrl()
      } catch (uErr) {
        webView = 'https://drive.google.com/file/d/' + fileId + '/view'
      }
      var result = {
        ok: true,
        done: true,
        fileId: fileId,
        url: 'https://drive.google.com/uc?export=view&id=' + fileId,
        webViewLink: webView,
      }
      cacheUploadResult_(uploadToken, result)
      removeResumeSession_(uploadToken)
      return jsonResponse_(result)
    }

    return jsonResponse_(
      {
        ok: false,
        error: 'Chunk failed HTTP ' + code,
        detail: text.substring(0, 280),
      },
      502,
    )
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Chunk upload failed'
    return jsonResponse_({ ok: false, error: message }, 500)
  }
}

/**
 * v28 — Direct browser → Drive upload.
 * Opens a Drive v3 resumable session ON BEHALF OF the browser: the client's
 * Origin is forwarded so Drive's session URL answers the browser's CORS
 * preflight + PUT. The session URL is returned to the client, which PUTs the
 * raw binary straight to googleapis.com (no base64, no webhook chunk hops,
 * no Apps Script 6-minute execution limit on the transfer itself).
 */
function handleUploadDirectInit_(body) {
  var totalBytes = Number(body.totalBytes || 0)
  if (
    !(totalBytes > 0) ||
    totalBytes > 80 * 1024 * 1024 ||
    totalBytes !== Math.floor(totalBytes)
  ) {
    return jsonResponse_({ ok: false, error: 'Invalid size' }, 400)
  }
  if (!body.fileName) {
    return jsonResponse_({ ok: false, error: 'Missing fileName' }, 400)
  }
  var origin = String(body.origin || '').trim()
  if (
    !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(origin) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)
  ) {
    return jsonResponse_({ ok: false, error: 'Invalid origin' }, 400)
  }

  try {
    var folderKey = body.folder || 'misc'
    var subName = FOLDER_NAMES[folderKey] || 'Diğer'
    var folder = getOrCreateUploadFolder_(subName, folderKey)
    var folderPath = String(body.folderPath || '').trim()
    if (folderPath) {
      var pathParts = folderPath.split('/')
      for (var pi = 0; pi < pathParts.length; pi += 1) {
        var part = String(pathParts[pi] || '')
          .trim()
          .replace(/[\\/]+/g, '')
          .slice(0, 120)
        if (part) {
          folder = getOrCreateFolderByName_(folder, part)
        }
      }
    }

    var mimeType = String(body.mimeType || 'application/octet-stream').slice(0, 120)
    var fileName = String(body.fileName).slice(0, 180)
    var metadata = {
      name: fileName,
      parents: [folder.getId()],
    }
    var oauth = ScriptApp.getOAuthToken()
    var resp = UrlFetchApp.fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true',
      {
        method: 'post',
        contentType: 'application/json; charset=UTF-8',
        headers: {
          Authorization: 'Bearer ' + oauth,
          Origin: origin,
          'X-Upload-Content-Type': mimeType,
          'X-Upload-Content-Length': String(totalBytes),
        },
        payload: JSON.stringify(metadata),
        muteHttpExceptions: true,
      },
    )
    var code = resp.getResponseCode()
    if (code < 200 || code >= 300) {
      return jsonResponse_(
        {
          ok: false,
          error: 'Drive direct session failed',
          detail: String(resp.getContentText() || '').substring(0, 280),
        },
        502,
      )
    }
    var headers = resp.getAllHeaders()
    var location =
      headers.Location ||
      headers.location ||
      headers['Location'] ||
      headers['location']
    if (!location) {
      return jsonResponse_({ ok: false, error: 'No resumable location' }, 502)
    }
    return jsonResponse_({
      ok: true,
      direct: true,
      sessionUrl: String(location),
      totalBytes: totalBytes,
    })
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Direct init failed'
    return jsonResponse_({ ok: false, error: message }, 500)
  }
}

/**
 * v28 — After the browser finished its direct PUT, set link sharing and
 * return the canonical URLs. Only files under the upload root are accepted.
 */
function handleUploadDirectFinish_(body) {
  var fileId = String(body.fileId || '').trim()
  if (!fileId || fileId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return jsonResponse_({ ok: false, error: 'Invalid fileId' }, 400)
  }
  try {
    var file = DriveApp.getFileById(fileId)
    if (!isFileUnderUploadRoot_(file)) {
      return jsonResponse_({ ok: false, error: 'File outside upload root' }, 403)
    }
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW)
    } catch (shareErr) {
      // Best-effort; link may still work for signed-in users.
    }
    var webView = ''
    try {
      webView = file.getUrl()
    } catch (uErr) {
      webView = 'https://drive.google.com/file/d/' + fileId + '/view'
    }
    return jsonResponse_({
      ok: true,
      done: true,
      fileId: fileId,
      url: 'https://drive.google.com/uc?export=view&id=' + fileId,
      webViewLink: webView,
    })
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Direct finish failed'
    return jsonResponse_({ ok: false, error: message }, 500)
  }
}

/** Walk parent chain (max 8 levels) — file must live under the upload root. */
function isFileUnderUploadRoot_(file) {
  var rootName =
    PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER') ||
    DEFAULT_DRIVE_ROOT
  try {
    var parents = file.getParents()
    var frontier = []
    while (parents.hasNext()) frontier.push(parents.next())
    for (var depth = 0; depth < 8 && frontier.length > 0; depth += 1) {
      var nextFrontier = []
      for (var i = 0; i < frontier.length; i += 1) {
        if (frontier[i].getName() === rootName) return true
        var up = frontier[i].getParents()
        while (up.hasNext()) nextFrontier.push(up.next())
      }
      frontier = nextFrontier
    }
  } catch (walkErr) {
    return false
  }
  return false
}

var RESUME_PROP_PREFIX_ = 'uresume:'
var RESUME_MAX_AGE_MS_ = 6 * 60 * 60 * 1000

function putResumeSession_(uploadToken, session) {
  if (!session.createdAt) session.createdAt = Date.now()
  var payload = JSON.stringify(session)
  PropertiesService.getScriptProperties().setProperty(
    RESUME_PROP_PREFIX_ + uploadToken,
    payload,
  )
  try {
    // Cache mirror for lower-latency hits when eviction is not an issue.
    CacheService.getScriptCache().put(
      RESUME_PROP_PREFIX_ + uploadToken,
      payload,
      21600,
    )
  } catch (cacheErr) {}
}

function getResumeSession_(uploadToken) {
  var key = RESUME_PROP_PREFIX_ + uploadToken
  var raw = null
  try {
    raw = PropertiesService.getScriptProperties().getProperty(key)
  } catch (propErr) {}
  if (!raw) {
    try {
      raw = CacheService.getScriptCache().get(key)
    } catch (cacheErr) {}
  }
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (parseErr) {
    removeResumeSession_(uploadToken)
    return null
  }
}

function removeResumeSession_(uploadToken) {
  var key = RESUME_PROP_PREFIX_ + uploadToken
  try {
    PropertiesService.getScriptProperties().deleteProperty(key)
  } catch (e1) {}
  try {
    CacheService.getScriptCache().remove(key)
  } catch (e2) {}
}

/** Drop abandoned multi-chunk sessions so Properties quota stays healthy. */
function cleanupStaleResumeSessions_() {
  try {
    var props = PropertiesService.getScriptProperties()
    var all = props.getProperties()
    var now = Date.now()
    var keys = Object.keys(all)
    for (var i = 0; i < keys.length; i += 1) {
      var k = keys[i]
      if (k.indexOf(RESUME_PROP_PREFIX_) !== 0) continue
      try {
        var s = JSON.parse(all[k])
        var created = Number(s.createdAt || 0)
        if (!created || now - created > RESUME_MAX_AGE_MS_) {
          props.deleteProperty(k)
        }
      } catch (e) {
        props.deleteProperty(k)
      }
    }
  } catch (cleanupErr) {}
}

/**
 * Soft-delete a Drive file by id (setTrashed). Used when replacing kadran photos.
 * Only roles with Drive upload may call.
 */
function handleTrashDriveFile_(body) {
  var fileId = String(body.fileId || '').trim()
  if (!fileId || fileId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return jsonResponse_({ ok: false, error: 'Invalid fileId' }, 400)
  }
  try {
    var file = DriveApp.getFileById(fileId)
    if (file.isTrashed()) {
      return jsonResponse_({ ok: true, fileId: fileId, alreadyTrashed: true })
    }
    file.setTrashed(true)
    return jsonResponse_({ ok: true, fileId: fileId })
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Trash failed'
    return jsonResponse_({ ok: false, error: message }, 500)
  }
}

/**
 * v31 — Return a BrainUploads file as base64 so the SPA can play audio.
 * Browser fetch of drive.usercontent is 403/CORS from Vercel.
 * Kameraman is denied in roleAllowedForAction_.
 */
var GET_DRIVE_FILE_MAX_BYTES = 8 * 1024 * 1024

function handleGetDriveFile_(body) {
  var fileId = String(body.fileId || '').trim()
  if (!fileId || fileId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return jsonResponse_({ ok: false, error: 'Invalid fileId' }, 400)
  }
  try {
    var file = DriveApp.getFileById(fileId)
    if (!isFileUnderUploadRoot_(file)) {
      return jsonResponse_({ ok: false, error: 'File outside upload root' }, 403)
    }
    if (file.isTrashed()) {
      return jsonResponse_({ ok: false, error: 'File trashed' }, 404)
    }
    var size = Number(file.getSize())
    if (!(size > 0)) {
      return jsonResponse_({ ok: false, error: 'Empty file' }, 400)
    }
    if (size > GET_DRIVE_FILE_MAX_BYTES) {
      return jsonResponse_({ ok: false, error: 'too large', usePreview: true }, 413)
    }
    var blob = file.getBlob()
    var mime = String(blob.getContentType() || 'audio/mp4').slice(0, 100)
    var bytes = blob.getBytes()
    return jsonResponse_({
      ok: true,
      fileId: fileId,
      mimeType: mime,
      size: bytes.length,
      base64: Utilities.base64Encode(bytes),
    })
  } catch (err) {
    var message = err && err.message ? String(err.message) : 'Read failed'
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
 * Trash everything under BrainUploads (İş görüşmesi raporu / Z raporu / …).
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

function getOrCreateUploadFolder_(subName, folderKey) {
  var rootName =
    PropertiesService.getScriptProperties().getProperty('DRIVE_ROOT_FOLDER') ||
    DEFAULT_DRIVE_ROOT
  var root = getOrCreateFolderByName_(DriveApp.getRootFolder(), rootName)
  renameLegacyUploadFolder_(root, folderKey, subName)
  return getOrCreateFolderByName_(root, subName)
}

function getOrCreateFolderByName_(parent, name) {
  var it = parent.getFoldersByName(name)
  if (it.hasNext()) return it.next()
  return parent.createFolder(name)
}

/** Rename first matching legacy English folder to the Turkish display name. */
function renameLegacyUploadFolder_(root, folderKey, newName) {
  if (!folderKey || !FOLDER_LEGACY_NAMES[folderKey]) return
  var current = root.getFoldersByName(newName)
  if (current.hasNext()) return
  var legacy = FOLDER_LEGACY_NAMES[folderKey]
  for (var i = 0; i < legacy.length; i += 1) {
    var it = root.getFoldersByName(legacy[i])
    if (it.hasNext()) {
      it.next().setName(newName)
      return
    }
  }
}

/**
 * Çekim tarihi from payload (Excel TARİH / plannedExecutionDate).
 */
function shootTarihFromBody_(body) {
  // Prefer çekim günü (`plannedTarih` / `cekTarih`) over iş alım (`tarih` when
  // clients still send acquired there). Wrong month tab → DK/HABER miss.
  return String(
    (body && (body.plannedTarih || body.cekTarih || body.tarih)) || '',
  ).trim()
}

/** Today as yyyy-MM-dd in Europe/Istanbul. */
function todayIstanbulDayKey_() {
  return Utilities.formatDate(new Date(), 'Europe/Istanbul', 'yyyy-MM-dd')
}

/**
 * "Eylül 2026" from dd.MM.yyyy / ISO day. Empty if unparseable.
 */
function monthSheetNameFromTarih_(tarih) {
  var key = tarihDayKey_(tarih)
  if (!key) return ''
  var parts = key.split('-')
  var year = Number(parts[0])
  var month = Number(parts[1])
  if (!year || month < 1 || month > 12) return ''
  return TR_MONTH_NAMES[month - 1] + ' ' + year
}

/**
 * Month tab name shifted by monthOffset from a day key / tarih string.
 * Falls back to today Istanbul when base is empty.
 */
function monthSheetNameFromOffset_(baseTarih, monthOffset) {
  var key = tarihDayKey_(baseTarih) || todayIstanbulDayKey_()
  var parts = key.split('-')
  var y = Number(parts[0])
  var m = Number(parts[1]) - 1 + Number(monthOffset || 0)
  while (m < 0) {
    m += 12
    y -= 1
  }
  while (m > 11) {
    m -= 12
    y += 1
  }
  return TR_MONTH_NAMES[m] + ' ' + y
}

function prepareLogSheet_(sheet) {
  if (!sheet) return null
  ensureHeaderRow_(sheet)
  ensureJobIdHeader_(sheet)
  return sheet
}

function legacyLogSheetName_() {
  return (
    PropertiesService.getScriptProperties().getProperty('SHEET_NAME') ||
    DEFAULT_SHEET_NAME
  )
}

function getLegacyLogSheet_(ss, createIfMissing) {
  var name = legacyLogSheetName_()
  var sheet = ss.getSheetByName(name)
  if (!sheet && createIfMissing) {
    sheet = ss.insertSheet(name)
  }
  return prepareLogSheet_(sheet)
}

function getOrCreateMonthSheetByName_(ss, name) {
  if (!name) return null
  var sheet = ss.getSheetByName(name)
  if (!sheet) {
    sheet = ss.insertSheet(name)
  }
  return prepareLogSheet_(sheet)
}

/**
 * Target month tab for çekim tarihi (creates if missing).
 * Fallback: today's Istanbul month when tarih missing.
 */
function getOrCreateLogSheetForBody_(body) {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var name =
    monthSheetNameFromTarih_(shootTarihFromBody_(body)) ||
    monthSheetNameFromTarih_(todayIstanbulDayKey_())
  return getOrCreateMonthSheetByName_(ss, name)
}

/** @deprecated Prefer getOrCreateLogSheetForBody_ — kept for rare callers. */
function getOrCreateLogSheet_() {
  return getOrCreateLogSheetForBody_({})
}

/**
 * JOB ID search: target month, ±2 neighboring months, then legacy IslemLogu.
 * Does not create missing month tabs.
 * When body has no tarih, still searches the current Istanbul month (offset 0).
 * @returns {{sheet: GoogleAppsScript.Spreadsheet.Sheet, row: number}|null}
 */
function findRowByJobIdAcrossSheets_(ss, body) {
  var jobId = resolveJobId_(body)
  if (!jobId) return null

  var shoot = shootTarihFromBody_(body)
  var base = shoot || todayIstanbulDayKey_()
  var names = []
  function pushName(n) {
    if (n && names.indexOf(n) < 0) names.push(n)
  }
  // Target from çekim tarihi when present; always include base month (offset 0)
  // so deleteJobRow without tarih still finds "Eylül 2026" in September.
  pushName(monthSheetNameFromTarih_(shoot))
  pushName(monthSheetNameFromOffset_(base, 0))
  for (var off = 1; off <= 2; off++) {
    pushName(monthSheetNameFromOffset_(base, -off))
    pushName(monthSheetNameFromOffset_(base, off))
  }
  pushName(legacyLogSheetName_())

  for (var i = 0; i < names.length; i++) {
    var sheet = ss.getSheetByName(names[i])
    if (!sheet) continue
    var row = findRowByJobId_(sheet, body)
    if (row > 1) return { sheet: sheet, row: row }
  }
  return null
}

/**
 * Resolve existing row: JOB ID across month tabs, else fuzzy on target month
 * + legacy IslemLogu (does not create tabs).
 */
function findRowLocation_(ss, body) {
  var byId = findRowByJobIdAcrossSheets_(ss, body)
  if (byId) return byId

  var candidates = []
  var targetName = monthSheetNameFromTarih_(shootTarihFromBody_(body))
  if (targetName) {
    var target = ss.getSheetByName(targetName)
    if (target) candidates.push(target)
  }
  var legacy = ss.getSheetByName(legacyLogSheetName_())
  if (legacy) {
    var already = false
    for (var c = 0; c < candidates.length; c++) {
      if (candidates[c].getSheetId() === legacy.getSheetId()) already = true
    }
    if (!already) candidates.push(legacy)
  }

  for (var i = 0; i < candidates.length; i++) {
    var sheet = candidates[i]
    prepareLogSheet_(sheet)
    var row = findRow_(sheet, body)
    if (row > 1) return { sheet: sheet, row: row }
  }
  return null
}

/**
 * Only write full headers if the sheet is empty.
 * Never overwrite an existing header row (protects the ops Excel layout).
 * Existing sheets: ensureJobIdHeader_ fills V1 (does not touch A–L).
 */
function ensureHeaderRow_(sheet) {
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS)
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold')
  }
}

/**
 * Ensure V1 = "JOB ID". Clear M1 when it is exactly "JOB ID" so header lookup
 * prefers V (legacy M cell values on data rows are left intact).
 */
function ensureJobIdHeader_(sheet) {
  var legacyHeader = sheet.getRange(1, COL.JOB_ID_LEGACY)
  if (String(legacyHeader.getValue() || '').trim() === 'JOB ID') {
    legacyHeader.setValue('')
  }
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
 * 2. body.roles: string[] → resolve active Firestore users per role →
 *    include_aliases.external_id (preferred; tag filters only as SA fallback)
 * 3. body.audience === 'all' or omitted → all ROLES_PUSH tags (OR)
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

  // Keep in sync with ROLES_PUSH (includes kameraman).
  var ALL_PUSH_ROLES = Object.keys(ROLES_PUSH)

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
  var targetingMode = 'external_ids'
  var resolvedRoles = null

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
    resolvedRoles = roles

    // Prefer uid resolution for explicit role lists (and for full-audience lists)
    // so stale OneSignal role tags cannot leak İK/management-only pushes to MPU.
    var useAudienceAll =
      !(Array.isArray(body.roles) && body.roles.length > 0) &&
      (body.audience === 'all' || body.roles == null)

    if (!useAudienceAll && roles.length > 0) {
      var resolvedUids = fetchActiveUidsForRoles_(roles)
      if (resolvedUids === null) {
        // SA / Firestore unavailable — last resort tag filter
        targetingMode = 'role_tags_fallback'
        payload.filters = buildRoleOrFilters_(roles)
        if (excludeIds.length > 0) {
          payload.exclude_aliases = { external_id: excludeIds }
        }
      } else {
        var targetIds = resolvedUids.filter(function (id) {
          return excludeIds.indexOf(id) === -1
        })
        if (targetIds.length === 0) {
          return jsonResponse_({
            ok: true,
            skipped: true,
            reason: 'no_active_users_for_roles',
            roles: roles,
            service: SCRIPT_SERVICE,
            version: SCRIPT_VERSION,
          })
        }
        targetingMode = 'role_uids'
        // OneSignal include_aliases.external_id max practical batch
        payload.include_aliases = {
          external_id: targetIds.slice(0, 200),
        }
      }
    } else {
      targetingMode = 'role_tags_all'
      payload.filters = buildRoleOrFilters_(roles)
      if (excludeIds.length > 0) {
        payload.exclude_aliases = { external_id: excludeIds }
      }
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
        targetingMode: targetingMode,
        roles: resolvedRoles,
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      502,
    )
  }

  return jsonResponse_({
    ok: true,
    onesignal: parsed,
    targetingMode: targetingMode,
    roles: resolvedRoles,
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
  // Prefer explicit role list over audience=all (client may send both).
  if (Array.isArray(rolesRaw) && rolesRaw.length > 0) {
    var out = []
    var seen = {}
    for (var i = 0; i < rolesRaw.length; i++) {
      var role = String(rolesRaw[i] || '').trim()
      if (!role || !allowed[role] || seen[role]) continue
      seen[role] = true
      out.push(role)
    }
    if (out.length > 0) return out
  }
  if (audience === 'all' || rolesRaw == null) {
    return allRoles.slice()
  }
  return allRoles.slice()
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

/**
 * Active Firestore users (`isActive == true`, not soft-deleted) whose `role`
 * is one of `roles`. Returns string[] of Firebase uids, or null if Admin SA
 * / Firestore is unavailable (caller may fall back to tag filters).
 */
function fetchActiveUidsForRoles_(roles) {
  if (!roles || !roles.length) return []

  var accessToken
  try {
    accessToken = getFirebaseAdminAccessToken_()
  } catch (tokenErr) {
    return null
  }

  var seen = {}
  var out = []

  for (var r = 0; r < roles.length; r++) {
    var role = String(roles[r] || '').trim()
    if (!role) continue

    var queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'role' },
            op: 'EQUAL',
            value: { stringValue: role },
          },
        },
        limit: 200,
      },
    }

    var url =
      'https://firestore.googleapis.com/v1/projects/' +
      encodeURIComponent(FIREBASE_PROJECT_ID) +
      '/databases/(default)/documents:runQuery'

    var resp
    try {
      resp = UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + accessToken },
        payload: JSON.stringify(queryBody),
        muteHttpExceptions: true,
      })
    } catch (fetchErr) {
      return null
    }

    var code = resp.getResponseCode()
    if (code < 200 || code >= 300) {
      return null
    }

    var rows
    try {
      rows = JSON.parse(resp.getContentText())
    } catch (parseErr) {
      return null
    }
    if (!(rows instanceof Array)) continue

    for (var i = 0; i < rows.length; i++) {
      var row = rows[i] || {}
      var doc = row.document
      if (!doc || !doc.name) continue
      var fields = doc.fields || {}
      // Soft-deleted / inactive accounts must not receive staff pushes.
      if (fields.deletedAt && fields.deletedAt.timestampValue) continue
      if (fields.isActive && fields.isActive.booleanValue === false) continue
      var name = String(doc.name)
      var parts = name.split('/')
      var uid = parts.length ? parts[parts.length - 1] : ''
      if (!uid || seen[uid]) continue
      seen[uid] = true
      out.push(uid)
      if (out.length >= 200) return out
    }
  }

  return out
}

/**
 * İK / yönetim / koordinatör: generate temporary password and set it on Auth.
 * Requires Script property FIREBASE_SERVICE_ACCOUNT_JSON (full SA JSON string).
 * Returns the password once in the JSON response (never stored in Sheets/Drive).
 */
function handleResetUserPassword_(body, actor) {
  var targetUid = String((body && body.targetUid) || '').trim()
  if (!targetUid) {
    return jsonResponse_({ ok: false, error: 'targetUid required' }, 400)
  }
  if (!actor || !actor.uid) {
    return jsonResponse_({ ok: false, error: 'Unauthorized' }, 401)
  }
  if (actor.uid === targetUid) {
    return jsonResponse_(
      { ok: false, error: 'Cannot reset your own password via this action' },
      400,
    )
  }

  var accessToken
  try {
    accessToken = getFirebaseAdminAccessToken_()
  } catch (saErr) {
    return jsonResponse_(
      {
        ok: false,
        error: 'FIREBASE_SERVICE_ACCOUNT_JSON not configured',
        detail: saErr && saErr.message ? String(saErr.message) : 'SA error',
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      503,
    )
  }

  var actorRole = String((actor && actor.role) || '')
  if (!actorRole) {
    actorRole = fetchFirestoreUserRole_(accessToken, actor.uid) || ''
  }
  if (
    actorRole !== 'management' &&
    actorRole !== 'coordinator' &&
    actorRole !== 'human_resources'
  ) {
    return jsonResponse_({ ok: false, error: 'Forbidden' }, 403)
  }

  var target = lookupAuthUserByUid_(accessToken, targetUid)
  if (!target.ok) {
    return jsonResponse_(
      {
        ok: false,
        error: target.error || 'User not found',
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      target.status || 404,
    )
  }

  var targetRole = String(target.role || '')
  if (!canManageTargetRoleForPasswordReset_(actorRole, targetRole)) {
    return jsonResponse_(
      {
        ok: false,
        error: 'Forbidden',
        detail: 'Cannot reset password for this role',
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      403,
    )
  }

  var temporaryPassword = generateTemporaryPassword_()
  var updated = updateAuthUserPassword_(accessToken, targetUid, temporaryPassword)
  if (!updated.ok) {
    return jsonResponse_(
      {
        ok: false,
        error: updated.error || 'Password update failed',
        service: SCRIPT_SERVICE,
        version: SCRIPT_VERSION,
      },
      500,
    )
  }

  // Best-effort audit fields on users/{uid} (Admin REST bypasses rules).
  try {
    patchUserPasswordResetAudit_(accessToken, targetUid, actor.uid)
  } catch (auditErr) {
    // Password already updated — do not fail the response.
  }

  return jsonResponse_({
    ok: true,
    targetUid: targetUid,
    email: target.email || '',
    temporaryPassword: temporaryPassword,
    service: SCRIPT_SERVICE,
    version: SCRIPT_VERSION,
  })
}

function canManageTargetRoleForPasswordReset_(actorRole, targetRole) {
  if (actorRole === 'management') {
    return (
      targetRole === 'media_planning' ||
      targetRole === 'reporter' ||
      targetRole === 'human_resources' ||
      targetRole === 'coordinator' ||
      targetRole === 'management'
    )
  }
  if (actorRole === 'coordinator' || actorRole === 'human_resources') {
    return (
      targetRole === 'media_planning' ||
      targetRole === 'reporter' ||
      targetRole === 'human_resources'
    )
  }
  return false
}

/** 10-char unambiguous temp password (min Auth length 8). */
function generateTemporaryPassword_() {
  var alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  var out = ''
  for (var i = 0; i < 10; i++) {
    var idx = Math.floor(Math.random() * alphabet.length)
    out += alphabet.charAt(idx)
  }
  return out
}

function base64UrlEncodeString_(value) {
  return String(Utilities.base64EncodeWebSafe(value)).replace(/=+$/, '')
}

function base64UrlEncodeBytes_(bytes) {
  return String(Utilities.base64EncodeWebSafe(bytes)).replace(/=+$/, '')
}

/**
 * OAuth access token for Firebase Auth Admin + Firestore from SA JSON.
 * Script property: FIREBASE_SERVICE_ACCOUNT_JSON
 */
function getFirebaseAdminAccessToken_() {
  var raw = PropertiesService.getScriptProperties().getProperty(
    'FIREBASE_SERVICE_ACCOUNT_JSON',
  )
  if (!raw || !String(raw).trim()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON missing')
  }
  var sa
  try {
    sa = JSON.parse(String(raw))
  } catch (parseErr) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON invalid JSON')
  }
  if (!sa.client_email || !sa.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON missing client_email/private_key')
  }

  var now = Math.floor(Date.now() / 1000)
  var header = base64UrlEncodeString_(
    JSON.stringify({ alg: 'RS256', typ: 'JWT' }),
  )
  var claimSet = base64UrlEncodeString_(
    JSON.stringify({
      iss: sa.client_email,
      scope:
        'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/cloud-platform',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    }),
  )
  var unsigned = header + '.' + claimSet
  var signature = Utilities.computeRsaSha256Signature(unsigned, sa.private_key)
  var jwt = unsigned + '.' + base64UrlEncodeBytes_(signature)

  var tokenResp = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    },
    muteHttpExceptions: true,
  })
  var code = tokenResp.getResponseCode()
  var text = tokenResp.getContentText()
  if (code < 200 || code >= 300) {
    throw new Error('SA token exchange failed (' + code + ')')
  }
  var data = JSON.parse(text)
  if (!data.access_token) {
    throw new Error('SA token exchange missing access_token')
  }
  return String(data.access_token)
}

function lookupAuthUserByUid_(accessToken, uid) {
  var resp = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/projects/' +
      encodeURIComponent(FIREBASE_PROJECT_ID) +
      '/accounts:lookup',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify({ localId: [uid] }),
      muteHttpExceptions: true,
    },
  )
  var code = resp.getResponseCode()
  var text = resp.getContentText()
  if (code < 200 || code >= 300) {
    return { ok: false, error: 'Auth lookup failed', status: 502 }
  }
  var data
  try {
    data = JSON.parse(text)
  } catch (e) {
    return { ok: false, error: 'Auth lookup invalid response', status: 502 }
  }
  var users = data.users || []
  if (!users.length) {
    return { ok: false, error: 'User not found', status: 404 }
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
  // Prefer Auth claim; fall back to Firestore profile role when claims missing.
  var role = claims.role ? String(claims.role) : ''
  if (!role) {
    role = fetchFirestoreUserRole_(accessToken, uid) || ''
  }
  return {
    ok: true,
    uid: user.localId || uid,
    email: user.email || '',
    role: role,
    disabled: Boolean(user.disabled),
  }
}

function fetchFirestoreUserRole_(accessToken, uid) {
  var url =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(FIREBASE_PROJECT_ID) +
    '/databases/(default)/documents/users/' +
    encodeURIComponent(uid)
  var resp = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + accessToken },
    muteHttpExceptions: true,
  })
  if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) {
    return ''
  }
  try {
    var doc = JSON.parse(resp.getContentText())
    var fields = doc.fields || {}
    if (fields.role && fields.role.stringValue) {
      return String(fields.role.stringValue)
    }
  } catch (e) {}
  return ''
}

function updateAuthUserPassword_(accessToken, uid, password) {
  var resp = UrlFetchApp.fetch(
    'https://identitytoolkit.googleapis.com/v1/projects/' +
      encodeURIComponent(FIREBASE_PROJECT_ID) +
      '/accounts:update',
    {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + accessToken },
      payload: JSON.stringify({
        localId: uid,
        password: password,
        // Invalidate existing refresh tokens so old sessions cannot stay signed in.
        validSince: String(Math.floor(Date.now() / 1000)),
      }),
      muteHttpExceptions: true,
    },
  )
  var code = resp.getResponseCode()
  if (code < 200 || code >= 300) {
    var detail = resp.getContentText()
    return {
      ok: false,
      error: 'Auth password update failed (' + code + '): ' + detail,
    }
  }
  return { ok: true }
}

function patchUserPasswordResetAudit_(accessToken, uid, actorUid) {
  var url =
    'https://firestore.googleapis.com/v1/projects/' +
    encodeURIComponent(FIREBASE_PROJECT_ID) +
    '/databases/(default)/documents/users/' +
    encodeURIComponent(uid) +
    '?updateMask.fieldPaths=passwordResetAt' +
    '&updateMask.fieldPaths=passwordResetByUid' +
    '&updateMask.fieldPaths=updatedAt'
  var now = new Date().toISOString()
  UrlFetchApp.fetch(url, {
    method: 'patch',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify({
      fields: {
        passwordResetAt: { timestampValue: now },
        passwordResetByUid: { stringValue: String(actorUid || '') },
        updatedAt: { timestampValue: now },
      },
    }),
    muteHttpExceptions: true,
  })
}

function jsonResponse_(obj, status) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  )
}
