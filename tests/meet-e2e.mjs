import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const root = new URL("../", import.meta.url).pathname;
fs.mkdirSync(`${root}/.visual-review`, { recursive: true });
const downloadDir = fs.mkdtempSync("/tmp/daniel-meet-download-");
const server = spawn("python3", ["tests/meet_mock_server.py"], { cwd: root, stdio: "ignore" });
const profile = fs.mkdtempSync("/tmp/daniel-meet-chrome-");
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9333", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

let nextId = 0;
const pending = new Map();
const events = [];

try {
  await waitFor("http://127.0.0.1:9333/json/version");
  const tab = await requestJson("http://127.0.0.1:9333/json/new?http://127.0.0.1:8877/meet.html?api=/mock-api", "PUT");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    else events.push(message);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result || {}));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const poll = async (expression, timeout = 10000) => {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await evaluate(expression)) return;
      await delay(100);
    }
    throw new Error(`Timed out: ${expression}`);
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Accessibility.enable");
  await send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
  await poll("document.querySelectorAll('.day-button').length > 0");
  assert.equal(await evaluate("document.querySelector('[data-error]').hidden"), true);
  assert.ok(await evaluate("document.querySelectorAll('.day-button').length") >= 4);
  const ax = await send("Accessibility.getFullAXTree");
  const interactiveRoles = new Set(["button", "textbox", "combobox", "link"]);
  const unnamed = ax.nodes.filter((node) => !node.ignored && interactiveRoles.has(node.role?.value) && !String(node.name?.value || "").trim());
  assert.deepEqual(unnamed.map((node) => node.role?.value), [], "every interactive control needs an accessible name");

  await evaluate("document.querySelector('.day-button').click()");
  await poll("!document.querySelector('[data-time-panel]').hidden");
  await evaluate("document.querySelector('.time-button').click()");
  await poll("!document.querySelector('[data-form]').hidden");
  await evaluate(`(() => { const set=(s,v)=>{const e=document.querySelector(s); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true}));}; set('#name','Daniel Test'); set('#email','daniel@example.com'); set('#company','Example Co'); set('#topic','Discuss evaluation reliability and deployment.'); })()`);
  await evaluate("document.querySelector('[data-form]').requestSubmit()");
  await poll("!document.querySelector('[data-confirmation]').hidden");
  assert.match(await evaluate("document.querySelector('[data-confirmation-copy]').textContent"), /\d/);
  assert.equal(await evaluate("document.querySelector('[data-confirmation-email]').textContent"), "daniel@example.com");
  assert.match(await evaluate("document.querySelector('[data-google-link]').href"), /^https:\/\/calendar\.google\.com/);
  await evaluate("document.querySelector('[data-download-ics]').click()");
  await pollDownload(downloadDir);
  const ics = fs.readFileSync(`${downloadDir}/conversation-with-daniel-gaskins.ics`, "utf8");
  assert.match(ics, /^BEGIN:VCALENDAR\r?\nVERSION:2\.0/m);
  assert.match(ics, /BEGIN:VEVENT\r?\n/);
  assert.match(ics, /DTSTART:\d{8}T\d{6}Z/);
  assert.match(ics, /URL:https:\/\/meet\.google\.com/);
  assert.ok(ics.split(/\r?\n/).every((line) => Buffer.byteLength(line) <= 75), "ICS lines must be folded to 75 octets or fewer");

  const sizes = [[390, 844, "mobile"], [768, 1024, "tablet"], [1440, 1000, "desktop"], [1920, 1080, "large"]];
  for (const [width, height, name] of sizes) {
    await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 700 });
    await send("Page.navigate", { url: "http://127.0.0.1:8877/meet.html?api=/mock-api" });
    await poll("document.querySelectorAll('.day-button').length > 0");
    const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    fs.writeFileSync(`${root}/.visual-review/meet-${name}.png`, Buffer.from(shot.data, "base64"));
    const dimensions = await evaluate("({w:document.documentElement.scrollWidth,vw:document.documentElement.clientWidth,h:document.documentElement.scrollHeight})");
    assert.ok(dimensions.w <= dimensions.vw, `${name} has horizontal overflow: ${JSON.stringify(dimensions)}`);
  }

  await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await evaluate("document.querySelector('.day-button').click()");
  await evaluate("document.querySelector('.time-button').click()");
  let shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(`${root}/.visual-review/meet-form-mobile.png`, Buffer.from(shot.data, "base64"));
  await evaluate(`(() => { const set=(s,v)=>{const e=document.querySelector(s);e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));};set('#name','Daniel Test');set('#email','daniel@example.com');set('#topic','Discuss agent evaluation.');document.querySelector('[data-form]').requestSubmit();})()`);
  await poll("!document.querySelector('[data-confirmation]').hidden");
  shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  fs.writeFileSync(`${root}/.visual-review/meet-confirmation-mobile.png`, Buffer.from(shot.data, "base64"));

  await send("Page.navigate", { url: "http://127.0.0.1:8877/meet.html?api=/mock-api&cancel=0000000000000000000000000000000000000000000000000000000000000000" });
  await poll("!document.querySelector('[data-cancellation]').hidden");
  assert.match(await evaluate("document.querySelector('[data-cancellation] h2').textContent"), /Plans changed/);

  const severe = events.filter((event) => event.method === "Runtime.exceptionThrown" || (event.method === "Log.entryAdded" && ["error", "warning"].includes(event.params.entry.level)));
  assert.deepEqual(severe, []);
  console.log("E2E booking, cancellation, accessibility, and responsive flows passed; six screenshots written to .visual-review/.");
  ws.close();
} finally {
  chrome.kill("SIGTERM");
  server.kill("SIGTERM");
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try { await requestJson(url); return; } catch { await delay(100); }
  }
  throw new Error(`Service did not start: ${url}`);
}

function requestJson(url, method = "GET") {
  return new Promise((resolve, reject) => {
    const request = http.request(url, { method }, (response) => {
      let body = "";
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => response.statusCode >= 400 ? reject(new Error(body)) : resolve(JSON.parse(body)));
    });
    request.on("error", reject);
    request.end();
  });
}

async function pollDownload(directory) {
  for (let i = 0; i < 100; i++) {
    if (fs.existsSync(`${directory}/conversation-with-daniel-gaskins.ics`)) return;
    await delay(50);
  }
  throw new Error("Calendar file was not downloaded");
}
