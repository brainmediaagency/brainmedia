# B’rain Workspace

B’rain Media Group şirket içi operasyon sistemi.

Medya planlama, muhabir (günlük rapor / kasa / Z rapor), koordinatör–yönetim onayları, insan kaynakları, bildirimler, Google Sheets/Drive entegrasyonu ve hesap yönetimi tek uygulamada.

## Ürün özeti

| | |
|--|--|
| Ürün | **B’rain Workspace** (`src/config/brand.ts`) |
| Dil | Türkçe arayüz |
| Hosting | **Vercel** (GitHub → otomatik deploy) · Firebase Hosting opsiyonel |
| Plan | Firebase **Spark** yeterli (Cloud Functions zorunlu değil) |
| Yetki | Firestore `users/{uid}` profili + Security Rules (Spark uyumlu) |

## Modüller

- **Medya planlama** — mesai, iş girişi, karne, konfirme
- **Muhabir** — günlük rapor / kasa, Z rapor, çekim durumu
- **Koordinatör / Yönetim** — onay kuyrukları, bölge, ses kaydı, Excel sekmesi, hesaplar
- **İnsan kaynakları** — raporlar, işe alım notları, hesaplar
- **Bildirimler** — uygulama içi kutu + OneSignal web push
- **Hesap** — üst çubuktan şifre değiştirme (e-posta sıfırlama yok)

## Teknoloji

- React 19 + TypeScript (strict) + Vite
- Firebase Auth, Cloud Firestore, App Check, Hosting
- Tailwind CSS v4 · React Hook Form + Zod · Vitest
- Google Sheets / Drive / OneSignal → Apps Script webhook (`scripts/sheets-webhook/`)

## Kurulum

```bash
cp .env.example .env
cp .firebaserc.example .firebaserc
# .env ve .firebaserc değerlerini doldurun

npm install
npm run dev
```

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `VITE_FIREBASE_API_KEY` | Web API key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging sender id |
| `VITE_FIREBASE_APP_ID` | Web app id |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | reCAPTCHA v3 site key (opsiyonel / aşamalı) |
| `VITE_ONESIGNAL_APP_ID` | OneSignal App ID (REST key yalnızca Apps Script’te) |
| `VITE_SHEETS_WEBHOOK_URL` | Apps Script Web App `/exec` URL |
| `VITE_GOOGLE_SHEETS_ID` | Excel sekmesi spreadsheet id |
| `VITE_GOOGLE_SHEETS_EMBED_URL` | Embed URL (opsiyonel; ID yoksa) |
| `VITE_USE_FIREBASE_EMULATORS` | `true` → Auth/Firestore emulator (local) |
| `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` | Local App Check debug |
| `GOOGLE_APPLICATION_CREDENTIALS` | Admin scriptleri için service account yolu |

`.env` dosyasını commit etmeyin. Vite `VITE_*` değerlerini **build anında** gömer; Vercel/Firebase’de değişince yeniden deploy gerekir.

### Vercel + GitHub

1. Repo: `brainmediaagency` org altında (Vercel Git entegrasyonu bağlı).
2. Vercel → Project → **Settings → Environment Variables** — `.env.example` içindeki tüm `VITE_*` anahtarlarını Production (+ Preview) olarak ekleyin.
3. Framework: Vite · Build: `npm run build` · Output: `dist` (`vercel.json`).
4. Deploy sonrası Firebase Console → Authentication → **Authorized domains** içine Vercel domain’ini ekleyin (`*.vercel.app` ve custom domain).
5. `main` (veya production branch) push → production; PR → preview.

Webhook kimliği: Firebase **idToken** (istemcide webhook secret yok).

## Şifre politikası (önemli)

Hesaplar `ad@brain.com` gibi **iç e-posta** ile açılır; gerçek posta kutusu yoktur.

| Durum | Ne yapılır |
|-------|------------|
| Kullanıcı giriş yapabiliyor | Üst çubuk → **Şifre** → mevcut + yeni şifre |
| Şifre unutuldu | Yönetim / İK → Firebase Console’dan geçici şifre → kullanıcı giriş edip hemen değiştirir |

E-posta ile “şifremi unuttum” **kullanılmaz**.

## Firebase kurulum

1. Firebase projesi (Spark yeterli)
2. Authentication → Email/Password aç
3. Firestore oluştur; `firestore.rules` + `firestore.indexes.json` deploy
4. App Check (reCAPTCHA v3) — önce Monitor, sonra enforce
5. Hosting: `npm run build` → `firebase deploy --only hosting`

```bash
firebase deploy --only firestore:rules,firestore:indexes,hosting
```

**Not:** `functions/` klasörü isteğe bağlı (Blaze). Varsayılan deploy komutlarına Functions **dahil edilmemiştir**. Spark’ta `firebase deploy` (tümü) çalıştırmayın.

Storage: `storage.rules` deny-all; dosyalar Google Drive + Apps Script üzerinden gider.

## Kullanıcı oluşturma

Uygulama içi (yönetim / İK hesap paneli) veya admin script:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/serviceAccount.json

npm run admin:create-user -- \
  --email yonetim@brain.com \
  --password 'GeciciSifre123!' \
  --fullName 'Ad Soyad' \
  --role management
```

Medya planlama için `--shiftMinutes 360` ekleyin.

Rol claim (opsiyonel / legacy):

```bash
npm run admin:set-role -- --uid USER_UID --role management
```

Oturum yetkisi üretimde **Firestore profili** (`users/{uid}`) üzerinden doğrulanır.

## Apps Script (Sheets / Drive / Push)

Ayrıntılar:

- [`scripts/sheets-webhook/README.md`](./scripts/sheets-webhook/README.md) — Excel satırları, Drive, idToken doğrulama
- [`scripts/onesignal/README.md`](./scripts/onesignal/README.md) — push

Script Property: `FIREBASE_WEB_API_KEY` = web API key. OneSignal REST key yalnızca Script Property’de.

## Emulator

```bash
npm run emulators          # Terminal 1
npm run seed:emulator      # Terminal 2
# .env: VITE_USE_FIREBASE_EMULATORS=true
npm run dev                # Terminal 3
```

Seed şifre: `Test1234!` (`media@brain.local`, `reporter@brain.local`, …). Production’a eklemeyin. JDK **21+** gerekir (rules / emulator).

## Test ve build

```bash
npm run test
export JAVA_HOME="/opt/homebrew/opt/openjdk@21"   # macOS örneği
npm run test:rules:emu
npm run build
```

## Netlify

`netlify.toml` + `public/_redirects`. Ortam değişkenlerini Netlify UI’da tanımlayın (`.env.netlify` otomatik yüklenmez). Deploy sonrası cache temizleyerek yeniden publish edin.

## Production kontrol listesi

- [ ] Email/Password Auth açık
- [ ] İlk yönetim kullanıcısı + Firestore profili
- [ ] Rules + indexes + hosting deploy
- [ ] Netlify/Firebase `VITE_*` production değerleri
- [ ] Apps Script deploy + `FIREBASE_WEB_API_KEY` / OneSignal property
- [ ] App Check monitor → enforce
- [ ] Service account repo dışında
- [ ] `npm run test` ve `npm run build` yeşil
- [ ] Medya planlama kullanıcılarında `shiftDurationMinutes`

## Güvenlik özeti

- Firestore default-deny; UI guard yalnızca UX
- Hesap oluşturma istemci + secondary Auth; claim client’tan yazılmaz
- Günlük rapor create: firma `chargeMode` kurallarda doğrulanır
- Hassas anahtarlar (OneSignal REST, Admin SDK) istemciye gitmez
- Offline persistence kapalı; kritik yazmalar çevrimdışı kuyruğa alınmaz

## Sorun giderme

| Belirti | Çözüm |
|---------|--------|
| Giriş reddedildi | Profil `isActive`, `deletedAt`, rol; dondurulmuş hesap |
| Permission denied | Rules deploy; çıkış/giriş ile token yenile |
| Index hatası | `firestore.indexes.json` deploy |
| Webhook / Excel | `VITE_SHEETS_WEBHOOK_URL`, Apps Script sürümü, idToken |
| Push gelmiyor | OneSignal App ID, rol tag’leri, Apps Script REST key |
| Şifre unuttum | Console geçici şifre — e-posta reset yok |

## Lisans

Özel şirket içi yazılım — B’rain Media Group.
