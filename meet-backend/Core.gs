var MeetCore = (function () {
  "use strict";

  function cleanText(value, maxLength) {
    return String(value == null ? "" : value)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
      .replace(/\r\n?/g, "\n")
      .trim()
      .slice(0, maxLength);
  }

  function validEmail(value) {
    var email = String(value || "").trim();
    return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function validateBooking(input, nowMs, config) {
    var result = {
      name: cleanText(input.name, 80),
      email: cleanText(input.email, 254).toLowerCase(),
      company: cleanText(input.company, 120),
      topic: cleanText(input.topic, 600),
      website: cleanText(input.website, 200),
      timezone: cleanText(input.timezone, 80),
      requestId: cleanText(input.requestId, 100),
      start: new Date(input.start)
    };
    var errors = [];
    if (result.website) errors.push("Spam check failed.");
    if (result.name.length < 2) errors.push("A name is required.");
    if (!validEmail(result.email)) errors.push("A valid email is required.");
    if (result.topic.length < 5) errors.push("A short meeting note is required.");
    if (!result.requestId || !/^[A-Za-z0-9_-]{8,100}$/.test(result.requestId)) errors.push("The booking request is invalid.");
    if (isNaN(result.start.getTime())) errors.push("The meeting time is invalid.");
    else {
      if (result.start.getTime() < nowMs + config.minimumNoticeHours * 3600000 - 60000) errors.push("That time is too soon.");
      if (result.start.getTime() > nowMs + (config.horizonDays + 1) * 86400000) errors.push("That time is too far away.");
      if (result.start.getUTCSeconds() !== 0 || result.start.getUTCMilliseconds() !== 0 || result.start.getUTCMinutes() % config.slotGridMinutes !== 0) errors.push("The meeting time is off-grid.");
    }
    result.errors = errors;
    return result;
  }

  function overlaps(startMs, endMs, busyStartMs, busyEndMs, bufferMs) {
    return startMs < busyEndMs + bufferMs && endMs > busyStartMs - bufferMs;
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function bridgeHtml(payload, targetOrigin) {
    var json = JSON.stringify(payload).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    var origin = JSON.stringify(targetOrigin || "https://danielgaskins.com");
    return "<!doctype html><meta charset=\"utf-8\"><title>Calendar response</title>" +
      "<script>window.top.postMessage(" + json + "," + origin + ");<\/script>" +
      "<p style=\"font:14px sans-serif\">You can close this window.<\/p>";
  }

  return { cleanText: cleanText, validEmail: validEmail, validateBooking: validateBooking, overlaps: overlaps, escapeHtml: escapeHtml, bridgeHtml: bridgeHtml };
})();
