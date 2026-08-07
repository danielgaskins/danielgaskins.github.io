const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = {};
vm.createContext(context);
vm.runInContext(fs.readFileSync("meet-backend/Core.gs", "utf8"), context);
const core = context.MeetCore;
const config = { minimumNoticeHours: 24, horizonDays: 21, slotGridMinutes: 30 };

test("cleans control characters and bounds visitor text", () => {
  assert.equal(core.cleanText("  hi\u0000there  ", 20), "hithere");
  assert.equal(core.cleanText("abcdef", 3), "abc");
});

test("accepts ordinary email addresses and rejects malformed ones", () => {
  assert.equal(core.validEmail("daniel@example.com"), true);
  assert.equal(core.validEmail("not an email"), false);
  assert.equal(core.validEmail("a@b"), false);
});

test("validates a complete on-grid future booking", () => {
  const now = Date.parse("2026-08-07T12:00:00Z");
  const result = core.validateBooking({
    name: " Daniel Gaskins ", email: "DANIEL@example.com", company: "Example",
    topic: "Discuss agent evaluation", requestId: "request_1234",
    timezone: "America/Los_Angeles", start: "2026-08-10T17:00:00.000Z"
  }, now, config);
  assert.deepEqual(Array.from(result.errors), []);
  assert.equal(result.email, "daniel@example.com");
});

test("rejects bots, short notes, off-grid times, and invalid request IDs", () => {
  const now = Date.parse("2026-08-07T12:00:00Z");
  const result = core.validateBooking({
    name: "D", email: "bad", topic: "x", website: "spam.test",
    requestId: "bad", start: "2026-08-10T17:07:00.000Z"
  }, now, config);
  assert.ok(result.errors.length >= 5);
});

test("overlap calculation includes buffers at both edges", () => {
  const minute = 60_000;
  assert.equal(core.overlaps(100 * minute, 130 * minute, 140 * minute, 170 * minute, 15 * minute), true);
  assert.equal(core.overlaps(100 * minute, 130 * minute, 146 * minute, 170 * minute, 15 * minute), false);
});

test("bridge output cannot break out of its script element", () => {
  const html = core.bridgeHtml({ value: "</script><script>alert(1)</script>" }, "https://danielgaskins.com");
  assert.equal(html.includes("</script><script>alert"), false);
  assert.match(html, /\\u003c\/script/);
  assert.match(html, /window\.top\.postMessage/);
  assert.match(html, /https:\/\/danielgaskins\.com/);
});

test("HTML escaping covers all markup delimiters", () => {
  assert.equal(core.escapeHtml(`<img src=x onerror="go()">'&`), "&lt;img src=x onerror=&quot;go()&quot;&gt;&#39;&amp;");
});
