# Calendar service for `/meet.html`

This Google Apps Script web app reads Daniel's calendar, creates a Google Meet
event, sends the guest a standard calendar invitation, and provides a private
cancellation link. Google, Apple Calendar, and Outlook all understand the
iCalendar invitation. The page also offers a standalone `.ics` download.

## Deploy once

1. Go to [script.google.com](https://script.google.com) using the Google account
   whose primary calendar should receive bookings, and create a new project.
2. Add `Core.gs` and `Code.gs`. In **Project Settings**, enable display of the
   `appsscript.json` manifest and replace it with the file in this directory.
3. Confirm the project timezone is **America/Los_Angeles**. Adjust
   `CONFIG.workingHours` in `Code.gs` if desired. Values are minutes after
   midnight in Daniel's timezone.
4. Select **Deploy → New deployment → Web app**. Run the app as **Me** and allow
   access to **Anyone**. Authorize Calendar and email access.
5. Copy the URL ending in `/exec` into `meet-config.js` as `endpoint`.
6. Open `/meet.html`, make one real test booking, confirm both inboxes received
   the invitation, verify the Meet link, then cancel from the private link.

Deploy a new version after backend changes. Existing `/exec` URLs continue to
point at the active deployment.

## Default policy

- 30-minute meetings on a 30-minute grid.
- Monday–Thursday, 9:30 a.m.–5:00 p.m. Pacific.
- Friday, 9:30 a.m.–3:00 p.m. Pacific.
- 24 hours' notice, 15-minute calendar buffers, and a 21-day horizon.
- At most 3 bookings per email address and 20 total bookings per UTC day.
- Busy event details never leave Apps Script. The public page receives only
  available UTC timestamps.

## Security and reliability

- A script-wide lock wraps the final availability check and event creation.
- A client request ID makes repeated form submissions idempotent.
- Event titles and conference types are fixed; visitor text is bounded and
  treated as data.
- A honeypot and per-address/global limits reduce automated abuse.
- Cancellation tokens are random, stored only as SHA-256 hashes, and single-use.
- Google Calendar sends invitations with `sendUpdates: all`; a notification
  email to `hello@danielgaskins.com` is best-effort and never rolls back a
  successfully created event.
