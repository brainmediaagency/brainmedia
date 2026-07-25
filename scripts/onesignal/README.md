# OneSignal Web Push (Spark-friendly — no Firebase Blaze)

B’RAIN uses **OneSignal** for OS push when the site is closed, plus the existing Firestore inbox when open.

Sending uses the existing **Apps Script webhook** (`pushNotify`) so the OneSignal REST API key never ships in the browser. The webhook authenticates with a **Firebase ID token** (v12+); no client webhook secret.

Audience (Apps Script **v14+**):

| Mode | How | Use |
|------|-----|-----|
| **All roles** (default) | OR filters: `management` \| `coordinator` \| `media_planning` \| `reporter` \| `human_resources` | `notifyManagement` / `notifyBroadcast` / `audience: 'all'` |
| **By roles** | Optional `roles: string[]` | Subset of the five tags |
| **By user** | `externalIds: string[]` (= Firebase uid / OneSignal `external_id`) | `notifyUser` (MPU job status) |

Broadcast events and management notifies reach every subscribed role. Per-user MPU job status writes `userNotifications/{uid}/items` **and** pushes to that uid via `externalIds`.

## 1. Create OneSignal app

1. Sign up at https://onesignal.com  
2. **New app/website** → Web  
3. Site URL: `https://brain-c5fcb.web.app` (and `http://localhost:5173` for local if needed)  
4. Choose **Custom Code** (or Typical Site — Custom Code matches this repo)  
5. Service Worker: path `OneSignalSDKWorker.js` at site root (already in `public/`)  
6. Copy **App ID** and **REST API Key** from **Settings → Keys & IDs**

### iPhone

Safari Web Push requires the site as a **Home Screen PWA** (iOS 16.4+).  
In OneSignal, complete Safari / Apple Web Push setup if prompted (Web ID / certificate).

## 2. App env (client — App ID + webhook URL only)

`.env` (rebuild hosting after change):

```bash
VITE_ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
VITE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/s/XXXX/exec
# Do NOT set VITE_SHEETS_WEBHOOK_SECRET — removed; Apps Script verifies Firebase idToken
```

## 3. Apps Script properties (server)

In the same Apps Script project as the sheets webhook:

| Property | Value |
|----------|--------|
| `FIREBASE_WEB_API_KEY` | Firebase web API key (required for idToken verify) |
| `ONESIGNAL_APP_ID` | same App ID |
| `ONESIGNAL_REST_API_KEY` | REST API Key (secret) |
| `WEBHOOK_SECRET` | optional legacy only (remove after v12 clients ship) |

Then paste updated [`../sheets-webhook/Code.gs`](../sheets-webhook/Code.gs) and:

**Deploy → Manage deployments → Edit → New version → Deploy**

Verify:

```bash
curl -sS -L "$VITE_SHEETS_WEBHOOK_URL"
# features should include "pushNotify" and "firebaseIdTokenAuth", version "v14"
```

## 4. Deploy hosting

```bash
npm run build
firebase deploy --only hosting
```

## 5. Any role — subscribe

1. Sign in with any app role (management, coordinator, media_planning, reporter, human_resources)  
2. Banner’dan **Bildirimleri aç** (iPhone: önce Ana Ekrana Ekle)  
3. OneSignal dashboard → Audience: user with tag `role=<their role>` and external_id = Firebase uid

Hosting alone shows the subscribe button for all roles; **redeploy Apps Script to v15** so `pushNotify` / `onesignalUpsertUsers` stay current.

## 6. Pre-create Audience users (all Firebase accounts)

Users appear under OneSignal → Audience with `external_id` = Firebase uid and tag `role=…` **before** they subscribe. Push still needs device opt-in once.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json
export ONESIGNAL_REST_API_KEY='os_v2_…'   # Settings → Keys & IDs
npm run admin:sync-onesignal
```

Or after deploying Apps Script **v15**: webhook action `onesignalUpsertUsers` (management/coordinator + idToken).

## Flow

```
Event (job / approve / Z / İK / region)
  → Firestore inbox (managementNotifications or broadcastNotifications)
  → webhook action=pushNotify + idToken + audience=all
  → Apps Script → OneSignal (role tags OR across all five roles)
  → phone / desktop even if site closed

MPU job status → userNotifications/{uid}/items
  → webhook pushNotify + externalIds: [uid]
  → OneSignal include_aliases.external_id
```
