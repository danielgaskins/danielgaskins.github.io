var CONFIG = Object.freeze({
  calendarId: "primary",
  ownerName: "Daniel Gaskins",
  ownerNotificationEmail: "hello@danielgaskins.com",
  publicMeetUrl: "https://danielgaskins.com/meet.html",
  timeZone: "America/Los_Angeles",
  durationMinutes: 30,
  slotGridMinutes: 30,
  bufferMinutes: 15,
  minimumNoticeHours: 24,
  horizonDays: 21,
  maximumSlotsReturned: 120,
  maximumBookingsPerDay: 20,
  maximumBookingsPerEmailPerDay: 3,
  workingHours: {
    1: [570, 1020], // Monday, 9:30–17:00
    2: [570, 1020],
    3: [570, 1020],
    4: [570, 1020],
    5: [570, 900]   // Friday, 9:30–15:00
  },
  allowedParentOrigins: [
    "https://danielgaskins.com",
    "https://www.danielgaskins.com"
  ]
});

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action || "availability";
  var nonce = MeetCore.cleanText(params.nonce, 100);
  try {
    if (action === "health") return bridge_({ channel: "daniel-meet", action: "health", ok: true, nonce: nonce }, params.parentOrigin);
    if (action !== "availability") throw publicError_("UNKNOWN_ACTION", "That calendar action is not supported.");
    return bridge_({ channel: "daniel-meet", action: "availability", ok: true, nonce: nonce, slots: getAvailableSlots_(new Date()) }, params.parentOrigin);
  } catch (error) {
    console.error("Availability error", error && error.stack ? error.stack : error);
    return bridge_({ channel: "daniel-meet", action: action, ok: false, nonce: nonce, code: error.publicCode || "CALENDAR_ERROR", message: error.publicMessage || "The calendar is temporarily unavailable." }, params.parentOrigin);
  }
}

function doPost(e) {
  var params = (e && e.parameter) || {};
  var action = MeetCore.cleanText(params.action, 30);
  var nonce = MeetCore.cleanText(params.nonce, 100);
  try {
    var result;
    if (action === "book") result = bookMeeting_(params);
    else if (action === "cancel") result = cancelMeeting_(params);
    else throw publicError_("UNKNOWN_ACTION", "That calendar action is not supported.");
    result.channel = "daniel-meet";
    result.action = action;
    result.ok = true;
    result.nonce = nonce;
    return bridge_(result, params.parentOrigin);
  } catch (error) {
    console.error("Calendar action error", error && error.stack ? error.stack : error);
    return bridge_({ channel: "daniel-meet", action: action, ok: false, nonce: nonce, code: error.publicCode || "BOOKING_ERROR", message: error.publicMessage || "The calendar could not be updated." }, params.parentOrigin);
  }
}

function getAvailableSlots_(now) {
  var lowerBound = new Date(now.getTime() + CONFIG.minimumNoticeHours * 3600000);
  var upperBound = new Date(now.getTime() + CONFIG.horizonDays * 86400000);
  var busy = getBusyState_(lowerBound, upperBound);
  var stepMs = CONFIG.slotGridMinutes * 60000;
  var durationMs = CONFIG.durationMinutes * 60000;
  var bufferMs = CONFIG.bufferMinutes * 60000;
  var cursor = new Date(Math.ceil(lowerBound.getTime() / stepMs) * stepMs);
  var slots = [];

  while (cursor.getTime() + durationMs <= upperBound.getTime() && slots.length < CONFIG.maximumSlotsReturned) {
    var local = localParts_(cursor);
    var hours = CONFIG.workingHours[local.weekday];
    var minuteOfDay = local.hour * 60 + local.minute;
    var endMinute = minuteOfDay + CONFIG.durationMinutes;
    var allDayBusy = busy.allDay.some(function (range) { return local.date >= range.start && local.date < range.end; });
    var timedBusy = busy.timed.some(function (range) { return MeetCore.overlaps(cursor.getTime(), cursor.getTime() + durationMs, range.start, range.end, bufferMs); });
    if (hours && minuteOfDay >= hours[0] && endMinute <= hours[1] && !allDayBusy && !timedBusy) slots.push(cursor.toISOString());
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return slots;
}

function getBusyState_(start, end) {
  var timed = [];
  var allDay = [];
  var pageToken;
  do {
    var response = Calendar.Events.list(CONFIG.calendarId, {
      timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: true,
      orderBy: "startTime", maxResults: 2500, pageToken: pageToken
    });
    (response.items || []).forEach(function (event) {
      if (event.status === "cancelled" || event.transparency === "transparent") return;
      if (event.start && event.start.date && event.end && event.end.date) allDay.push({ start: event.start.date, end: event.end.date });
      else if (event.start && event.start.dateTime && event.end && event.end.dateTime) timed.push({ start: new Date(event.start.dateTime).getTime(), end: new Date(event.end.dateTime).getTime() });
    });
    pageToken = response.nextPageToken;
  } while (pageToken);
  return { timed: timed, allDay: allDay };
}

function bookMeeting_(input) {
  var now = new Date();
  var booking = MeetCore.validateBooking(input, now.getTime(), CONFIG);
  if (booking.errors.length) throw publicError_("INVALID_REQUEST", booking.errors[0]);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw publicError_("BUSY", "The calendar is busy. Please wait a moment and try again.");
  try {
    var properties = PropertiesService.getScriptProperties();
    var idempotencyKey = "request:" + hash_(booking.requestId);
    var existing = properties.getProperty(idempotencyKey);
    if (existing) return JSON.parse(existing);
    enforceRateLimits_(booking.email, now, properties);

    var start = booking.start;
    var end = new Date(start.getTime() + CONFIG.durationMinutes * 60000);
    if (getAvailableSlots_(new Date(start.getTime() - CONFIG.minimumNoticeHours * 3600000 - 120000)).indexOf(start.toISOString()) === -1) {
      throw publicError_("SLOT_UNAVAILABLE", "That time is no longer available.");
    }

    var cancelToken = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
    var cancelUrl = CONFIG.publicMeetUrl + "?cancel=" + encodeURIComponent(cancelToken);
    var description = [
      "Booked through danielgaskins.com.", "", "Topic:", booking.topic,
      booking.company ? "\nCompany:\n" + booking.company : "",
      "", "Need to cancel? " + cancelUrl
    ].filter(Boolean).join("\n");
    var eventResource = {
      summary: "Conversation with " + booking.name,
      description: description,
      start: { dateTime: start.toISOString(), timeZone: CONFIG.timeZone },
      end: { dateTime: end.toISOString(), timeZone: CONFIG.timeZone },
      attendees: [{ email: booking.email, displayName: booking.name }],
      guestsCanInviteOthers: false,
      guestsCanModify: false,
      guestsCanSeeOtherGuests: false,
      extendedProperties: { private: { bookingRequestId: booking.requestId, bookedVia: "danielgaskins.com" } },
      conferenceData: { createRequest: { requestId: "meet-" + booking.requestId.replace(/[^A-Za-z0-9]/g, "").slice(0, 40), conferenceSolutionKey: { type: "hangoutsMeet" } } }
    };

    var event = Calendar.Events.insert(eventResource, CONFIG.calendarId, { conferenceDataVersion: 1, sendUpdates: "all" });
    if (!event || !event.id) throw new Error("Calendar returned no event ID.");
    var meetUrl = getMeetUrl_(event);
    var result = {
      eventId: event.id, start: start.toISOString(), end: end.toISOString(),
      meetUrl: meetUrl, calendarUrl: event.htmlLink || "", cancelUrl: cancelUrl
    };
    properties.setProperty("cancel:" + hash_(cancelToken), JSON.stringify({ eventId: event.id, created: now.toISOString() }));
    properties.setProperty(idempotencyKey, JSON.stringify(result));
    incrementRateLimits_(booking.email, now, properties);
    notifyOwner_(booking, result);
    return result;
  } finally {
    lock.releaseLock();
  }
}

function cancelMeeting_(input) {
  var token = MeetCore.cleanText(input.token, 160);
  if (!/^[A-Fa-f0-9]{64}$/.test(token)) throw publicError_("INVALID_TOKEN", "That cancellation link is invalid.");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) throw publicError_("BUSY", "The calendar is busy. Please wait a moment and try again.");
  try {
    var properties = PropertiesService.getScriptProperties();
    var key = "cancel:" + hash_(token);
    var record = properties.getProperty(key);
    if (!record) throw publicError_("INVALID_TOKEN", "That cancellation link has expired or was already used.");
    var data = JSON.parse(record);
    Calendar.Events.remove(CONFIG.calendarId, data.eventId, { sendUpdates: "all" });
    properties.deleteProperty(key);
    return { eventId: data.eventId };
  } finally {
    lock.releaseLock();
  }
}

function notifyOwner_(booking, result) {
  try {
    var when = Utilities.formatDate(new Date(result.start), CONFIG.timeZone, "EEE, MMM d 'at' h:mm a z");
    var safeName = MeetCore.escapeHtml(booking.name);
    var safeCompany = MeetCore.escapeHtml(booking.company);
    var safeTopic = MeetCore.escapeHtml(booking.topic).replace(/\n/g, "<br>");
    MailApp.sendEmail({
      to: CONFIG.ownerNotificationEmail,
      replyTo: booking.email,
      subject: "New meeting: " + booking.name + " on " + when,
      body: booking.name + (booking.company ? " from " + booking.company : "") + " booked " + when + ".\n\n" + booking.topic + "\n\nCalendar: " + result.calendarUrl,
      htmlBody: "<p><strong>" + safeName + "</strong>" + (safeCompany ? " from " + safeCompany : "") + " booked <strong>" + MeetCore.escapeHtml(when) + "</strong>.</p><p>" + safeTopic + "</p><p><a href=\"" + MeetCore.escapeHtml(result.calendarUrl) + "\">Open the event</a></p>",
      name: "Daniel Gaskins scheduling"
    });
  } catch (error) {
    console.warn("Owner notification failed after event creation", error && error.message ? error.message : error);
  }
}

function enforceRateLimits_(email, now, properties) {
  var date = Utilities.formatDate(now, "UTC", "yyyy-MM-dd");
  var globalCount = Number(properties.getProperty("rate:global:" + date) || 0);
  var emailCount = Number(properties.getProperty("rate:email:" + date + ":" + hash_(email)) || 0);
  if (globalCount >= CONFIG.maximumBookingsPerDay || emailCount >= CONFIG.maximumBookingsPerEmailPerDay) {
    throw publicError_("RATE_LIMITED", "The booking limit has been reached. Please email Daniel to find a time.");
  }
}

function incrementRateLimits_(email, now, properties) {
  var date = Utilities.formatDate(now, "UTC", "yyyy-MM-dd");
  var globalKey = "rate:global:" + date;
  var emailKey = "rate:email:" + date + ":" + hash_(email);
  properties.setProperty(globalKey, String(Number(properties.getProperty(globalKey) || 0) + 1));
  properties.setProperty(emailKey, String(Number(properties.getProperty(emailKey) || 0) + 1));
}

function getMeetUrl_(event) {
  var entries = event.conferenceData && event.conferenceData.entryPoints || [];
  for (var i = 0; i < entries.length; i++) if (entries[i].entryPointType === "video") return entries[i].uri || "";
  return event.hangoutLink || "";
}

function localParts_(date) {
  var parts = Utilities.formatDate(date, CONFIG.timeZone, "u|HH|mm|yyyy-MM-dd").split("|");
  return { weekday: Number(parts[0]), hour: Number(parts[1]), minute: Number(parts[2]), date: parts[3] };
}

function hash_(value) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8);
  return bytes.map(function (byte) { var value = byte < 0 ? byte + 256 : byte; return ("0" + value.toString(16)).slice(-2); }).join("");
}

function publicError_(code, message) {
  var error = new Error(message);
  error.publicCode = code;
  error.publicMessage = message;
  return error;
}

function parentOrigin_(candidate) {
  var value = MeetCore.cleanText(candidate, 200);
  if (CONFIG.allowedParentOrigins.indexOf(value) !== -1) return value;
  if (/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(value)) return value;
  return CONFIG.allowedParentOrigins[0];
}

function bridge_(payload, requestedOrigin) {
  return HtmlService.createHtmlOutput(MeetCore.bridgeHtml(payload, parentOrigin_(requestedOrigin)))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
