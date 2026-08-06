# Geliştirici QA paketi (kullanıcı görmez)

Bu klasör **yalnızca lokal / CI** için kapsamlı regresyon testleridir.

## Ne çalışır

| Dosya | Kapsam |
|-------|--------|
| `push-targeting.matrix.test.ts` | Bildirim push rolleri, İK→MPU sızıntısı, kameraman allowlist, audience=all |
| `notify-callsite-guards.test.ts` | Kaynak taraması: `notifyManagement` sızıntısız `pushRoles`, Code.gs v23 |
| `role-access.matrix.test.ts` | Rol × rota × nav (Kasa sekmesi yalnız muhabir) |
| `end-user.journeys.test.ts` | MPU / yönetim / muhabir / kameraman ürün kuralları (offline) |
| `ui.ux.smoke.test.tsx` | TabNav a11y, Button loading, ProtectedRoute, `?tab=` deep-link |
| `suite-self-check.test.ts` | Paket kendini doğrular; deploy etmez |

## Güvenlik (canlıya iz yok)

- Firebase **production’a yazmaz** (Firestore mock / rules ayrı emulator)
- OneSignal / Sheets webhook **çağrılmaz**
- Drive / ses / CV / rapor **oluşturulmaz**
- `public/` veya hosting’e **dosya bırakılmaz**
- Test belgesi yalnızca `tests/qa/` altında kalır

## Komutlar

Komutları **tek tek** çalıştırın. Satır sonuna `# yorum` eklemeyin;
zsh, parantez + `~` içeren yorumları bozabilir (`unknown file attribute`).

```bash
npm run test:qa
```

```bash
npm test
```

```bash
npm run test:full
```

```bash
npm run test:rules:emu
```

Rules emulator: yerel Firestore + **JDK 21+** (`firebase-tools` şartı).
Production’a yazmaz.

## Yeni bildirim / rol kuralı eklerken

1. `contracts/notifyContracts.ts` güncelle  
2. Call site’da `pushRoles` ver  
3. `npm run test:qa`  
4. Apps Script push allowlist’i (`Code.gs` `ROLES_PUSH`) ile uyum kontrol et
