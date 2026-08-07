import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import fs from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const root = new URL("../", import.meta.url).pathname;
const server = spawn("python3", ["-m", "http.server", "8878", "--bind", "127.0.0.1"], { cwd: root, stdio: "ignore" });
const profile = fs.mkdtempSync("/tmp/daniel-meet-live-");
const chrome = spawn("google-chrome", ["--headless=new", "--no-sandbox", "--disable-gpu", "--remote-debugging-port=9334", `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });

try {
  await waitFor("http://127.0.0.1:9334/json/version");
  const tab = await requestJson("http://127.0.0.1:9334/json/new?about:blank", "PUT");
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let nextId = 0;
  const pending = new Map();
  const severe = [];
  const network = [];
  ws.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); }
    else if (message.method === "Runtime.exceptionThrown" || (message.method === "Log.entryAdded" && message.params.entry.level === "error")) severe.push(message);
    else if (["Network.requestWillBeSent", "Network.responseReceived", "Network.loadingFailed"].includes(message.method)) {
      const url = message.params.request?.url || message.params.response?.url || "";
      if (url.includes("script.google.com/macros")) network.push({ method: message.method, url, status: message.params.response?.status, error: message.params.errorText });
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result || {}));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result.value;
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:8878/meet.html" });
  const started = Date.now();
  while (Date.now() - started < 30000) {
    if (await evaluate("document.querySelectorAll('.day-button').length > 0 || (!document.querySelector('[data-error]').hidden && document.querySelector('[data-loading]').hidden)")) break;
    await delay(200);
  }
  const result = await evaluate(`({days:document.querySelectorAll('.day-button').length,times:[...document.querySelectorAll('.day-button__count')].map(x=>x.textContent),errorHidden:document.querySelector('[data-error]').hidden,error:document.querySelector('[data-error-message]').textContent,loadingHidden:document.querySelector('[data-loading]').hidden,frameSrc:document.querySelector('[data-response-frame]').src,frameOuter:document.querySelector('[data-response-frame]').outerHTML,frameConnected:document.querySelector('[data-response-frame]').isConnected})`);
  if (!result.days) {
    const frames = await send("Page.getFrameTree");
    console.error("Live availability diagnostic:", JSON.stringify(result), JSON.stringify(severe), JSON.stringify(network), JSON.stringify(frames.frameTree));
  }
  assert.ok(result.days > 0, "live endpoint returned no bookable days");
  assert.equal(result.errorHidden, true);
  assert.equal(result.loadingHidden, true);
  assert.deepEqual(severe, []);
  console.log(`Live availability smoke passed: ${result.days} days rendered.`);
  ws.close();
} finally {
  chrome.kill("SIGTERM");
  server.kill("SIGTERM");
}

async function waitFor(url) {
  for (let i = 0; i < 80; i++) {
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
