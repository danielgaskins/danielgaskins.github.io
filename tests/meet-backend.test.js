const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const crypto = require("node:crypto");

function makeRuntime() {
  const store = new Map();
  const events = [];
  const removals = [];
  const emails = [];
  const context = {
    console,
    Date,
    JSON,
    Math,
    Object,
    String,
    Number,
    Error,
    encodeURIComponent,
    Calendar: { Events: {
      list() { return { items: events.filter((e) => e.__stored) }; },
      insert(resource) {
        const event = { ...resource, id: `event-${events.length + 1}`, htmlLink: "https://calendar.google.com/event/1", hangoutLink: "https://meet.google.com/abc-defg-hij", conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }] }, __stored: true };
        events.push(event);
        return event;
      },
      remove(_calendarId, eventId) { removals.push(eventId); }
    } },
    Utilities: {
      formatDate(date, timeZone, pattern) {
        if (pattern === "yyyy-MM-dd") return date.toISOString().slice(0, 10);
        if (pattern === "EEE, MMM d 'at' h:mm a z") return "Mon, Aug 10 at 10:00 AM PDT";
        if (pattern === "u|HH|mm|yyyy-MM-dd") {
          const p = new Intl.DateTimeFormat("en-CA", { timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
          const val = (type) => p.find((x) => x.type === type).value;
          const weekdays = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
          return `${weekdays[val("weekday")]}|${val("hour")}|${val("minute")}|${val("year")}-${val("month")}-${val("day")}`;
        }
        throw new Error(`Unsupported date pattern ${pattern}`);
      },
      getUuid: (() => { let i = 0; return () => `${(++i).toString(16).padStart(8, "0")}-0000-0000-0000-000000000000`; })(),
      computeDigest(_algorithm, value) { return [...crypto.createHash("sha256").update(value).digest()].map((x) => x > 127 ? x - 256 : x); },
      DigestAlgorithm: { SHA_256: "SHA_256" }, Charset: { UTF_8: "UTF_8" }
    },
    PropertiesService: { getScriptProperties() { return {
      getProperty(key) { return store.has(key) ? store.get(key) : null; },
      setProperty(key, value) { store.set(key, value); },
      deleteProperty(key) { store.delete(key); }
    }; } },
    LockService: { getScriptLock() { return { tryLock() { return true; }, releaseLock() {} }; } },
    MailApp: { sendEmail(message) { emails.push(message); } },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: "ALLOWALL" }, createHtmlOutput(html) { return { html, setXFrameOptionsMode() { return this; } }; } }
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("meet-backend/Core.gs", "utf8"), context);
  vm.runInContext(fs.readFileSync("meet-backend/Code.gs", "utf8"), context);
  return { context, store, events, removals, emails };
}

test("availability includes working-hour slots but excludes a busy interval and buffers", () => {
  const runtime = makeRuntime();
  runtime.events.push({ __stored: true, status: "confirmed", start: { dateTime: "2026-08-10T18:00:00.000Z" }, end: { dateTime: "2026-08-10T18:30:00.000Z" } });
  const slots = runtime.context.getAvailableSlots_(new Date("2026-08-07T12:00:00.000Z"));
  assert.ok(slots.includes("2026-08-10T16:30:00.000Z")); // 9:30 a.m. Pacific
  assert.equal(slots.includes("2026-08-10T17:30:00.000Z"), false); // 15-minute buffer before 11:00 event
  assert.equal(slots.includes("2026-08-10T18:00:00.000Z"), false);
  assert.equal(slots.includes("2026-08-10T18:30:00.000Z"), false);
});

test("booking creates one event, sends updates, and is idempotent", () => {
  const runtime = makeRuntime();
  const slot = runtime.context.getAvailableSlots_(new Date())[0];
  assert.ok(slot, "test runtime should produce a future working-hours slot");
  const input = { name: "A Person", email: "a@example.com", company: "Acme", topic: "Discuss a production agent", requestId: "request_123456", timezone: "America/Los_Angeles", start: slot };
  const first = runtime.context.bookMeeting_(input);
  const second = runtime.context.bookMeeting_(input);
  assert.equal(first.eventId, second.eventId);
  assert.equal(runtime.events.filter((e) => e.id).length, 1);
  assert.equal(runtime.emails.length, 1);
  assert.match(first.meetUrl, /^https:\/\/meet\.google\.com\//);
});

test("cancellation token is single-use and removes the calendar event", () => {
  const runtime = makeRuntime();
  const slot = runtime.context.getAvailableSlots_(new Date())[0];
  const result = runtime.context.bookMeeting_({ name: "A Person", email: "a@example.com", topic: "Discuss the project", requestId: "request_987654", start: slot });
  const token = new URL(result.cancelUrl).searchParams.get("cancel");
  const cancelled = runtime.context.cancelMeeting_({ token });
  assert.equal(cancelled.eventId, result.eventId);
  assert.deepEqual(runtime.removals, [result.eventId]);
  assert.throws(() => runtime.context.cancelMeeting_({ token }), /expired or was already used/);
});

test("rate limit blocks a fourth booking for one email", () => {
  const runtime = makeRuntime();
  for (let i = 0; i < 3; i++) {
    const slot = runtime.context.getAvailableSlots_(new Date())[i * 2];
    runtime.context.bookMeeting_({ name: "A Person", email: "same@example.com", topic: "Discuss the project", requestId: `request_limit_${i}`, start: slot });
  }
  const fourth = runtime.context.getAvailableSlots_(new Date())[8];
  assert.throws(() => runtime.context.bookMeeting_({ name: "A Person", email: "same@example.com", topic: "Discuss the project", requestId: "request_limit_4", start: fourth }), /booking limit/);
});
