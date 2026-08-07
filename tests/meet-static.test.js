const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("meet.html", "utf8");
const css = fs.readFileSync("meet.css", "utf8");

test("page has a unique title, description, canonical URL, and mobile viewport", () => {
  assert.match(html, /<title>Meet Daniel Gaskins<\/title>/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="canonical" href="https:\/\/danielgaskins\.com\/meet\.html"/);
  assert.match(html, /name="viewport"/);
});

test("all HTML ids are unique and every label target exists", () => {
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const match of html.matchAll(/<label[^>]+for="([^"]+)"/g)) assert.ok(ids.includes(match[1]), `missing input #${match[1]}`);
});

test("form has explicit validation, spam, response, and calendar fields", () => {
  for (const marker of ["data-request-id", "data-nonce", "data-parent-origin", "data-response-frame", 'name="website"', 'name="timezone"']) assert.ok(html.includes(marker), marker);
  assert.match(html, /Download \.ics for Apple or Outlook/);
});

test("responsive and reduced-motion styles are present", () => {
  assert.match(css, /@media \(max-width: 960px\)/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /prefers-reduced-motion/);
});
