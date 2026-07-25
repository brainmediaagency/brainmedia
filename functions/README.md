# Cloud Functions (brain)

## `autoForwardJobsToReporter`

- Schedule: every 15 minutes, `Europe/Istanbul`
- Active window: **09:00–21:00** (hour 21 excluded)
- Action: `jobs` with `status == approved` and `forwardedToReporter == false` → set forwarded flags (`Otomatik iletim`)

### Spark / no Blaze

Scheduled Cloud Functions need **Blaze**. This project stays on Spark — do **not** rely on deploying this function.

`firebase.json` **does not** include a `functions` target, so accidental `firebase deploy` will not try to upload Functions.

**Client fallback (production path):** `AutoForwardJobsGuard` runs when management/coordinator is logged in during the window.

### Optional Blaze deploy (not used)

Add a `functions` block back to `firebase.json` (see git history), then:

```bash
cd functions && npm install && npm run build
cd .. && npx firebase deploy --only functions
```