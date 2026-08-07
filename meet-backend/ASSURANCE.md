# `/meet.html` assurance record

Assurance run: August 7, 2026

## Automated coverage

Run from the site repository:

```bash
node --test tests/meet-core.test.js tests/meet-backend.test.js tests/meet-static.test.js
node tests/meet-e2e.mjs
```

Current result: **15 unit/integration/static checks passed** and the complete
mocked browser flow passed without console errors.

The production Apps Script deployment was updated to **Version 2** on August 7,
2026. A read-only live browser smoke test reached the deployed service and
rendered **9 bookable days** from Daniel's real calendar. The response exposed
only available UTC timestamps; it did not expose event details or create an
event.

The suite covers:

- Text sanitization, length limits, email validation, honeypot behavior, and
  script-breakout escaping.
- Notice and horizon bounds, 30-minute grid enforcement, event overlaps, and
  15-minute buffers.
- Working-hours slot generation in `America/Los_Angeles`.
- Calendar event creation, Google Meet URL extraction, owner notification, and
  request idempotency.
- Per-email rate limiting and single-use hashed cancellation tokens.
- Booking, confirmation, Google Calendar, `.ics`, and cancellation browser
  states against a mock service.
- Accessible names for interactive elements and duplicate ID/label checks.
- Horizontal-overflow checks at 390×844, 768×1024, 1440×1000, and 1920×1080.
- Reduced-motion support and structural JavaScript, CSS, JSON, and HTML checks.

Screenshots from the browser pass are stored locally in `.visual-review/` and
are intentionally not part of the deployed site.

## Threat and failure review

| Risk | Control |
| --- | --- |
| Two people choose the same stale slot | Script-wide lock plus a fresh calendar check before insert |
| Browser retries a successful request | Stable request ID and stored idempotent result |
| Visitor text becomes markup or event configuration | Fixed event/conference fields, bounded text, contextual HTML escaping |
| Public endpoint is used to send invitation spam | Honeypot, 3/email/day and 20/global/day limits |
| Cancellation URL is guessed or reused | 256-bit random token, SHA-256 at rest, deletion after use |
| Calendar details leak through availability | Backend returns only available UTC timestamps |
| Owner notification fails after calendar creation | Notification is best-effort; the real event and guest invite remain valid |
| Timezone or daylight-saving shift | Slot filtering occurs from UTC instants formatted in the owner timezone |
| Third-party calendar client | Google invitation uses iCalendar; page also produces an RFC 5545-style `.ics` file |

## Remaining live transaction test

The deployed availability check proves that the web app can read the authorized
calendar. It cannot prove that Google can create the event or that an external
mail provider delivered a message. Complete this final transaction test before
describing invitation delivery as fully verified:

1. Book one future slot using a non-owner email address.
2. Confirm exactly one event appears on Daniel's Google Calendar.
3. Confirm the guest receives an invitation and its Google Meet link opens.
4. Download the `.ics` file and import it into Apple Calendar or Outlook.
5. Use the cancellation URL from the event description.
6. Confirm the event is removed and the guest receives the cancellation update.
7. Submit the same completed request a second time in a controlled test and
   confirm no second event is created.

Do not describe external email delivery as assured until steps 1–6 pass against
the live deployment.
