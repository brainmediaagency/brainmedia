# Cloud Functions (brain)

## `autoForwardJobsToReporter` (retired)

This scheduler is a **no-op**. Muhabir/kameraman shooting calendars no longer
use a `forwardedToReporter` flag. Same-day confirms appear immediately; later
days unlock at İstanbul 21:00.

`firebase.json` **does not** include a `functions` target. Production visibility
is client-side (`DailyHourCalendar` + `shootingCalendarVisibility`).
