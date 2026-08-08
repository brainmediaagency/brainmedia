# Sheets + Drive webhook (free — no Firebase Storage / Blaze)

Same Apps Script Web App handles:

1. **Job status log** → Google Sheet (upsert by **JOB ID** preferred, else **FİRMA ADI + TARİH**)
2. **File upload** → Google Drive folders under `BrainUploads/` (`action: "uploadFile"`)
   - `hiring` → **İş görüşmesi raporu**
   - `z-reports` → **Z raporu**
   - `voice-recordings` → **Ses kayıtları**
   - `hr-reports` → **Günlük İK raporu** (reserved)
   - `kameraman-km` → **Kameraman KM Raporları** (+ nested `folderPath`)
   - Replace photo: `action: "trashDriveFile"` + `fileId` soft-deletes previous Drive file
   - Legacy English names (`Hiring`, `ZReports`, …) are renamed on next upload after **v18** deploy
3. **Drive quota** → account used/limit (`action: "driveStorageUsage"`)
4. **OneSignal push** → all subscribed roles / optional externalIds (`action: "pushNotify"`) — see [`../onesignal/README.md`](../onesignal/README.md)
5. **Large voice** → `uploadFileInit` + `uploadFileChunk` (v24+; **v27** stores sessions in ScriptProperties so multi-minute / ~45 dk speech survives without Blaze/Storage)

## Wipe BrainUploads (admin)

After deploying **v16+** (`wipeBrainUploads` in `doGet` features):

```bash
GOOGLE_APPLICATION_CREDENTIALS=/path/to/sa.json \
  npx tsx scripts/admin/wipe-drive-uploads.ts
```

Trashes all files/folders under `BrainUploads/`. If Advanced Drive service is not enabled in Apps Script, also empty trash once at [drive.google.com](https://drive.google.com) → Trash for quota to drop.

## Fix “Unauthorized” / Drive kotası alınamadı (most common)

Live webhook needs Script Property **`FIREBASE_WEB_API_KEY`**. Without it every Drive/Sheets/push call returns Unauthorized (looks like a role bug; it is not).

1. Open the Apps Script project bound to your webhook Web App  
2. **Project Settings** (gear) → **Script properties** → **Add script property**  
3. Property: `FIREBASE_WEB_API_KEY`  
   Value: same as `VITE_FIREBASE_API_KEY` in `.env` / Netlify env  
4. Save → paste latest [`Code.gs`](./Code.gs) if needed → **Deploy → Manage deployments → Edit → New version → Deploy**  
5. Manager: sign out / sign in, refresh Drive kotası

Verify (should NOT mention missing API key):

```bash
# After property is set, any logged-in management idToken POST to driveStorageUsage succeeds.
curl -sS -L "$VITE_SHEETS_WEBHOOK_URL"
# version should match repo (v15+), features include firebaseIdTokenAuth
```

## Auth (v12+) — Firebase ID token

Mutating POSTs require a valid **Firebase ID token** (`idToken` in JSON/form body).

Apps Script verifies via Identity Toolkit:

`POST https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=FIREBASE_WEB_API_KEY`

with `{ "idToken": "..." }`. The web API key is project-scoped (`brain-c5fcb`) and already public in the client; keep it in Script Properties only (never bake a webhook secret into the SPA).

| Script property | Required | Notes |
|-----------------|----------|--------|
| `FIREBASE_WEB_API_KEY` | **yes** (v12+) | Same value as `VITE_FIREBASE_API_KEY` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | for password reset (v19+) | Full Firebase service account JSON. Used only by `resetUserPassword` |
| `WEBHOOK_SECRET` | optional | **Legacy fallback for one version** — remove after all clients send `idToken` |
| `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` | optional | pushNotify |

### Password reset (İK / yönetim / koordinatör) — v19+

In the app: **Hesaplar → Şifre sıfırla**. Webhook generates a random temporary password, sets it on Firebase Auth, writes audit fields `passwordResetAt` / `passwordResetByUid` on `users/{uid}`, and returns the password once to the admin UI.

1. Deploy latest [`Code.gs`](./Code.gs) → **New version** (`features` must include `resetUserPassword`, version `v19+`)
2. Script property `FIREBASE_SERVICE_ACCOUNT_JSON` = entire service account JSON (same file as `GOOGLE_APPLICATION_CREDENTIALS` for admin scripts). SA needs **Firebase Authentication Admin** + Firestore/Datastore access on `brain-c5fcb`.
3. Actor must be `human_resources`, `coordinator`, or `management` and may only reset roles they can manage (same rules as freeze/create).

`doGet` ping stays **public** (version/features only — no secrets).

### Role gating (when `customAttributes.role` is present)

| Action | Allowed roles |
|--------|----------------|
| Sheet upsert / son durum / dk haber | reporter, media_planning, coordinator, management |
| Drive upload / uploadResult / storage | + human_resources, kameraman (KM kadran) |
| pushNotify | all of the above (callers of notify*; default audience = all five role tags; optional `externalIds`) |
| resetUserPassword | human_resources, coordinator, management (+ manageable target role) |

If custom claims are missing, any verified Firebase user is allowed for mutating actions (Firestore remains authoritative for app RBAC). Sync claims after UI account create:

```bash
npm run admin:sync-claims
```

Legacy `WEBHOOK_SECRET` skips role checks.

## Fixed Excel template (do not reorder cols 1–12 without approval)

Columns (exact order):

| # | Header | App source |
|---|--------|------------|
| 1 | TARİH | `acquiredDate` → `DD.MM.YYYY` |
| 2 | FİRMA ADI | `companyName` |
| 3 | FİRMA SAHİBİ | `contactPersonName` |
| 4 | TEL NO | phone display |
| 5 | ADRES | **province (il) only** |
| 6 | MPU | creating media planner name |
| 7 | DK | empty on insert; daily reporter → shoot minutes |
| 8 | HABER | empty on insert; daily reporter → haber kazancı (TL), yoksa boş |
| 9 | SON DURUM | see table below |
| 10 | KAZANÇ | empty on insert; daily reporter → firma **toplam gelir** (matrah+KDV) |
| 11 | *(unused)* | **app never writes** (legacy “MERVE HANIM” header may remain in live sheets) |
| 12 | *(empty / fatura)* | **manual only** — app never writes |
| 13 | **JOB ID** | Firestore `job.id` (v13+) — stable row identity |

Row identity for updates: **JOB ID** when present; else **FİRMA ADI + TARİH** for legacy rows without col 13 filled.

### Existing workbooks (v13 header)

- `ensureHeaderRow_` still runs **only on empty sheets** (never overwrites A1–L1 ops template).
- On first upsert / status / DK patch, `ensureJobIdHeader_` writes **`JOB ID` into M1 only if M1 is empty**.
- One-time optional: type `JOB ID` in M1 yourself; new rows get col 13 from the client automatically.

## SON DURUM (only these three — written from app)

| App event | SON DURUM |
|-----------|-----------|
| Konfirme | `Konfirme` |
| İptal | `İptal edildi` |
| Çekildi | `Çekildi` |

**Reddet** Excel’e yazılmaz (yalnızca app / Firestore).
**Muhabire ilet** Excel’e yazmaz (SON DURUM değişmez).

## Fresh install (new Google account / Drive)

1. Create a blank Google Sheet; keep the **same column headers** as the ops Excel (or leave the tab empty — script writes headers only if the sheet is empty).
2. **Extensions → Apps Script** → paste [`Code.gs`](./Code.gs) → Save.
3. **Project Settings → Script properties:**
   - `FIREBASE_WEB_API_KEY` = Firebase web API key (from Firebase console / `VITE_FIREBASE_API_KEY`)
   - `ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` (optional, for push)
   - `WEBHOOK_SECRET` only if you need a short legacy bridge (optional; remove soon)
4. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** / **Herkes**
5. Copy the `/exec` URL.
6. In the Brain app `.env` (once):

```bash
VITE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
# Do NOT set VITE_SHEETS_WEBHOOK_SECRET — removed in v12 (Firebase idToken instead)
```

7. Rebuild + deploy hosting (`VITE_*` is baked at build time):

```bash
npm run build
firebase deploy --only hosting
```

### Deploy order (important)

**Redeploy Apps Script to v14** (JOB ID column + all-role / `externalIds` push + `FIREBASE_WEB_API_KEY`) **before or at the same time as hosting** that sends `jobId` on sheet mutations / expects all-role push.

### After Code.gs edits

**Deploy → Manage deployments → Edit → Version: New version → Deploy**  
Same `/exec` URL — no `.env` change needed.

### Quick verify

```bash
URL='https://script.google.com/macros/s/.../exec'
curl -sS -L "$URL"
# Expect: {"ok":true,"service":"brain-sheets-drive-webhook-v14","version":"v14",...}
# features MUST include "updateDkHaber", "pushNotify", "firebaseIdTokenAuth"
# version MUST be v10+ (OPS-04); v14 is current.
```

## Architecture

```
Brain client (signed-in)
  ├─ GET  ping (public)
  ├─ POST upsertJobRow / updateSonDurum / updateDkHaber  { idToken, jobId, … }
  ├─ POST uploadFile / uploadResult / driveStorageUsage   { idToken, … }
  └─ POST pushNotify                                        { idToken, … }
  → Apps Script verifies idToken → Sheet + Drive + OneSignal
```

## Coordinator Excel tab (in-app embed)

The ops sheet can also be shown inside Brain under **Koordinatör → Excel** (and Yönetim → Excel).

That UI is **not** driven by this Apps Script webhook. Set one of:

```bash
VITE_GOOGLE_SHEETS_ID=your-spreadsheet-id
# or full iframe URL:
# VITE_GOOGLE_SHEETS_EMBED_URL=https://docs.google.com/spreadsheets/d/your-spreadsheet-id/edit?usp=sharing&rm=minimal
```

Then rebuild + deploy hosting. Share the Google Sheet with each coordinator’s Google account as **Editor** so they can edit inside the iframe. If third-party cookies block Google login in the iframe, use **Sheets’te aç**.

## Notes

- Script **never overwrites** an existing header row (cols 1–12); M1 may get `JOB ID` only when empty.
- On row update (`upsertJobRow`), the fatura, unused col 11, **DK**, **HABER** and **KAZANÇ** cells are **preserved** — status upserts never wipe the minutes/haber/kazanç written by the daily reporter report.
- `updateDkHaber` payload: `{ idToken, action: 'updateDkHaber', jobId, firmaAdi, tarih, dk, haber, kazanc, sonDurum? }`; `tarih` is the job's `acquiredDate` (`DD.MM.YYYY`). `kazanc` is the per-firma toplam gelir (matrah+KDV), formatted like `12.500 TL`. Optional `sonDurum` (e.g. `Çekildi`) is written in the same request (v10+). Returns 404-style `{ ok:false, error:'Row not found …' }` if no row matches.
- **KAZANÇ empty while DK/HABER fill?** Live webhook is almost certainly stale (`curl` ping shows `v6`/`v9` instead of `v14`). Paste repo `Code.gs` → **Deploy → Manage deployments → Edit → New version → Deploy**, then re-submit the daily report (or re-save).
- After pasting this `Code.gs`, publish via **Deploy → Manage deployments → Edit → New version** (same URL).
- Until `.env` webhook URL is set, Sheets/Drive calls **no-op** (safe while migrating accounts).
