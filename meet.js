(function () {
  "use strict";

  var config = window.MEET_CONFIG || {};
  var qs = new URLSearchParams(window.location.search);
  var localOverride = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ? qs.get("api") : "";
  var endpoint = localOverride || config.endpoint || "";
  var durationMinutes = Number(config.durationMinutes) || 30;
  var state = { slots: [], groups: [], selectedDay: null, selectedStart: null, result: null, nonce: makeId(), requestId: makeId() };

  var el = {
    loading: document.querySelector("[data-loading]"),
    error: document.querySelector("[data-error]"),
    errorMessage: document.querySelector("[data-error-message]"),
    retry: document.querySelector("[data-retry]"),
    dayPanel: document.querySelector("[data-day-panel]"),
    timePanel: document.querySelector("[data-time-panel]"),
    form: document.querySelector("[data-form]"),
    confirmation: document.querySelector("[data-confirmation]"),
    cancellation: document.querySelector("[data-cancellation]"),
    cancelForm: document.querySelector("[data-cancel-form]"),
    days: document.querySelector("[data-days]"),
    times: document.querySelector("[data-times]"),
    empty: document.querySelector("[data-empty]"),
    timezone: document.querySelector("[data-timezone]"),
    selectedDay: document.querySelector("[data-selected-day]"),
    summary: document.querySelector("[data-booking-summary]"),
    stepLabel: document.querySelector("[data-step-label]"),
    stepTitle: document.querySelector("[data-step-title]"),
    dots: Array.from(document.querySelectorAll(".step-dots i")),
    start: document.querySelector("[data-start]"),
    formTimezone: document.querySelector("[data-form-timezone]"),
    nonce: document.querySelector("[data-nonce]"),
    requestId: document.querySelector("[data-request-id]"),
    parentOrigin: document.querySelector("[data-parent-origin]"),
    submit: document.querySelector("[data-submit]"),
    submitLabel: document.querySelector("[data-submit-label]"),
    topic: document.querySelector("#topic"),
    count: document.querySelector("[data-count]"),
    responseFrame: document.querySelector("[data-response-frame]"),
    googleLink: document.querySelector("[data-google-link]"),
    confirmationCopy: document.querySelector("[data-confirmation-copy]"),
    confirmationEmail: document.querySelector("[data-confirmation-email]")
  };

  document.querySelector("[data-year]").textContent = new Date().getFullYear();
  populateTimezones();
  bindEvents();

  var cancelToken = qs.get("cancel");
  if (cancelToken) showCancellation(cancelToken);
  else loadAvailability();

  function bindEvents() {
    el.retry.addEventListener("click", loadAvailability);
    el.timezone.addEventListener("change", renderDays);
    document.querySelector("[data-back-day]").addEventListener("click", function () { setStep(1); });
    document.querySelector("[data-back-time]").addEventListener("click", function () { setStep(2); });
    el.topic.addEventListener("input", function () { el.count.textContent = el.topic.value.length; });
    el.form.addEventListener("submit", submitBooking);
    el.cancelForm.addEventListener("submit", submitCancellation);
    document.querySelector("[data-download-ics]").addEventListener("click", downloadIcs);
    window.addEventListener("message", handleBridgeMessage);
  }

  function loadAvailability() {
    hideError();
    el.loading.hidden = false;
    el.dayPanel.hidden = true;
    if (!endpoint) {
      el.loading.hidden = true;
      showError("Online scheduling is being connected. Please email Daniel and he will find a time with you.");
      return;
    }
    state.nonce = makeId();
    var url = new URL(endpoint, window.location.href);
    url.searchParams.set("action", "availability");
    url.searchParams.set("nonce", state.nonce);
    url.searchParams.set("parentOrigin", parentOrigin());
    el.responseFrame.src = url.toString();
    window.setTimeout(function () {
      if (!el.loading.hidden) {
        el.loading.hidden = true;
        showError("Daniel’s calendar took too long to respond. Please try again or send an email.");
      }
    }, 15000);
  }

  function handleBridgeMessage(event) {
    if (!isTrustedBridgeOrigin(event.origin) || !event.data || event.data.channel !== "daniel-meet") return;
    var data = event.data;
    if (data.nonce !== state.nonce && data.nonce !== document.querySelector("[data-cancel-nonce]").value) return;

    if (data.action === "availability") {
      el.loading.hidden = true;
      if (!data.ok) return showError(data.message || "The calendar could not be loaded.");
      state.slots = (data.slots || []).filter(validFutureIso).map(function (slot) { return new Date(slot); });
      setStep(1);
      return;
    }

    if (data.action === "book") {
      setSubmitting(false);
      if (!data.ok) {
        if (data.code === "SLOT_UNAVAILABLE") {
          showError("Someone just booked that time. Choose another open time.");
          loadAvailability();
        } else showError(data.message || "The meeting could not be booked.");
        return;
      }
      state.result = data;
      showConfirmation(data);
      return;
    }

    if (data.action === "cancel") {
      document.querySelector("[data-cancel-submit]").disabled = false;
      if (!data.ok) return showError(data.message || "The meeting could not be cancelled.");
      el.cancellation.innerHTML = '<span class="confirmation__mark" aria-hidden="true">✓</span><p class="step-label">Meeting cancelled</p><h2>Your calendar is clear.</h2><p>Daniel and the other guests have been notified.</p><a class="primary-link" href="./meet.html">Choose a new time</a>';
    }
  }

  function isTrustedBridgeOrigin(origin) {
    if (origin === window.location.origin) return true;
    try {
      var host = new URL(origin).hostname;
      return host === "script.google.com" || host.endsWith(".googleusercontent.com");
    } catch (_) { return false; }
  }

  function populateTimezones() {
    var detected = safeTimeZone();
    var zones = [detected, "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "Europe/London", "Europe/Berlin", "Asia/Kolkata", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney"];
    Array.from(new Set(zones)).forEach(function (zone) {
      var option = document.createElement("option");
      option.value = zone;
      option.textContent = zone.replace(/_/g, " ") + (zone === detected ? " (your time)" : "");
      el.timezone.appendChild(option);
    });
    el.timezone.value = detected;
  }

  function renderDays() {
    var zone = el.timezone.value;
    var byDay = new Map();
    state.slots.forEach(function (date) {
      var key = dateKey(date, zone);
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(date);
    });
    state.groups = Array.from(byDay.entries()).map(function (entry) { return { key: entry[0], slots: entry[1] }; });
    el.days.replaceChildren();
    el.empty.hidden = state.groups.length !== 0;

    state.groups.forEach(function (group) {
      var date = group.slots[0];
      var button = document.createElement("button");
      button.type = "button";
      button.className = "day-button";
      button.setAttribute("role", "listitem");
      button.innerHTML = '<span class="day-button__weekday">' + format(date, zone, { weekday: "short" }) + '</span><span class="day-button__date">' + format(date, zone, { month: "long", day: "numeric" }) + '</span><span class="day-button__count">' + group.slots.length + ' time' + (group.slots.length === 1 ? "" : "s") + ' →</span>';
      button.addEventListener("click", function () {
        state.selectedDay = group;
        renderTimes();
        setStep(2);
      });
      el.days.appendChild(button);
    });
  }

  function renderTimes() {
    var zone = el.timezone.value;
    el.selectedDay.textContent = format(state.selectedDay.slots[0], zone, { weekday: "long", month: "long", day: "numeric" });
    el.times.replaceChildren();
    state.selectedDay.slots.forEach(function (date) {
      var button = document.createElement("button");
      button.type = "button";
      button.className = "time-button";
      button.textContent = format(date, zone, { hour: "numeric", minute: "2-digit" });
      button.setAttribute("aria-label", button.textContent + " on " + el.selectedDay.textContent);
      button.addEventListener("click", function () {
        state.selectedStart = date;
        prepareForm();
        setStep(3);
      });
      el.times.appendChild(button);
    });
  }

  function prepareForm() {
    var zone = el.timezone.value;
    var end = new Date(state.selectedStart.getTime() + durationMinutes * 60000);
    el.summary.innerHTML = '<strong>' + format(state.selectedStart, zone, { weekday: "long", month: "long", day: "numeric" }) + '</strong><span>' + format(state.selectedStart, zone, { hour: "numeric", minute: "2-digit" }) + '–' + format(end, zone, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }) + '</span>';
    el.start.value = state.selectedStart.toISOString();
    el.formTimezone.value = zone;
    el.nonce.value = state.nonce;
    el.requestId.value = state.requestId;
    el.parentOrigin.value = parentOrigin();
    el.form.setAttribute("action", endpoint);
  }

  function setStep(step) {
    hideError();
    [el.dayPanel, el.timePanel, el.form, el.confirmation, el.cancellation].forEach(function (node) { node.hidden = true; });
    el.loading.hidden = true;
    var titles = ["Choose a day", "Choose a time", "A few details"];
    el.stepLabel.textContent = "Step " + step + " of 3";
    el.stepTitle.textContent = titles[step - 1];
    el.dots.forEach(function (dot, index) { dot.classList.toggle("is-active", index < step); });
    if (step === 1) { el.dayPanel.hidden = false; renderDays(); }
    if (step === 2) el.timePanel.hidden = false;
    if (step === 3) { el.form.hidden = false; window.setTimeout(function () { document.querySelector("#name").focus(); }, 0); }
  }

  function submitBooking(event) {
    event.preventDefault();
    if (!validateForm()) return;
    hideError();
    setSubmitting(true);
    state.requestId = state.requestId || makeId();
    el.requestId.value = state.requestId;
    el.form.submit();
    window.setTimeout(function () {
      if (el.submit.disabled) {
        setSubmitting(false);
        showError("The booking service took too long to respond. Check your inbox before trying again.");
      }
    }, 20000);
  }

  function validateForm() {
    var values = { name: el.form.name.value.trim(), email: el.form.email.value.trim(), topic: el.form.topic.value.trim() };
    var errors = {};
    if (values.name.length < 2) errors.name = "Please enter your name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email address.";
    if (values.topic.length < 5) errors.topic = "Add a short note so Daniel can prepare.";
    ["name", "email", "topic"].forEach(function (key) {
      var input = el.form.elements[key];
      var message = errors[key] || "";
      input.setAttribute("aria-invalid", message ? "true" : "false");
      document.querySelector('[data-field-error="' + key + '"]').textContent = message;
    });
    if (Object.keys(errors).length) {
      el.form.elements[Object.keys(errors)[0]].focus();
      return false;
    }
    return true;
  }

  function setSubmitting(isSubmitting) {
    el.submit.disabled = isSubmitting;
    el.submitLabel.textContent = isSubmitting ? "Booking…" : "Book the conversation";
  }

  function showConfirmation(data) {
    [el.form, el.dayPanel, el.timePanel, document.querySelector(".scheduler__topline")].forEach(function (node) { node.hidden = true; });
    el.confirmation.hidden = false;
    var start = new Date(data.start);
    var zone = el.timezone.value;
    el.confirmationCopy.textContent = format(start, zone, { weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }) + ".";
    el.confirmationEmail.textContent = el.form.email.value.trim();
    if (data.calendarUrl) { el.googleLink.href = data.calendarUrl; el.googleLink.hidden = false; }
    el.confirmation.querySelector("h2").focus && el.confirmation.querySelector("h2").focus();
  }

  function showCancellation(token) {
    el.loading.hidden = true;
    document.querySelector(".scheduler__topline").hidden = true;
    el.cancellation.hidden = false;
    document.querySelector("[data-cancel-token]").value = token;
    document.querySelector("[data-cancel-nonce]").value = state.nonce;
    document.querySelector("[data-cancel-origin]").value = parentOrigin();
    el.cancelForm.setAttribute("action", endpoint);
    if (!endpoint) showError("Cancellation is temporarily unavailable. Email Daniel and he will take care of it.");
  }

  function submitCancellation(event) {
    event.preventDefault();
    if (!endpoint) return;
    if (!window.confirm("Cancel this meeting for everyone?")) return;
    document.querySelector("[data-cancel-submit]").disabled = true;
    el.cancelForm.submit();
  }

  function downloadIcs() {
    if (!state.result) return;
    var blob = new Blob([buildIcs(state.result)], { type: "text/calendar;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "conversation-with-daniel-gaskins.ics";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(function () { URL.revokeObjectURL(link.href); }, 1000);
  }

  function buildIcs(data) {
    var lines = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Daniel Gaskins//Meet//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
      "BEGIN:VEVENT", "UID:" + escapeIcs(data.eventId || state.requestId) + "@danielgaskins.com",
      "DTSTAMP:" + icsDate(new Date()), "DTSTART:" + icsDate(new Date(data.start)), "DTEND:" + icsDate(new Date(data.end)),
      "SUMMARY:Conversation with Daniel Gaskins", "DESCRIPTION:" + escapeIcs("Calendar invitation sent separately." + (data.meetUrl ? " Join: " + data.meetUrl : "")),
      data.meetUrl ? "URL:" + escapeIcs(data.meetUrl) : "", "END:VEVENT", "END:VCALENDAR"
    ].filter(Boolean);
    return lines.map(foldIcs).join("\r\n") + "\r\n";
  }

  function foldIcs(line) {
    var out = [];
    while (new TextEncoder().encode(line).length > 73) {
      var index = Math.min(73, line.length);
      while (new TextEncoder().encode(line.slice(0, index)).length > 73) index--;
      out.push(line.slice(0, index));
      line = " " + line.slice(index);
    }
    out.push(line);
    return out.join("\r\n");
  }

  function escapeIcs(value) { return String(value).replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;"); }
  function icsDate(date) { return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
  function format(date, zone, options) { return new Intl.DateTimeFormat(undefined, Object.assign({ timeZone: zone }, options)).format(date); }
  function dateKey(date, zone) {
    var parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
    var get = function (type) { return parts.find(function (part) { return part.type === type; }).value; };
    return get("year") + "-" + get("month") + "-" + get("day");
  }
  function safeTimeZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles"; } catch (_) { return "America/Los_Angeles"; } }
  function validFutureIso(value) { var date = new Date(value); return !Number.isNaN(date.getTime()) && date.getTime() > Date.now(); }
  function makeId() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2); }
  function parentOrigin() { return /^https?:$/.test(window.location.protocol) ? window.location.origin : "https://danielgaskins.com"; }
  function hideError() { el.error.hidden = true; }
  function showError(message) { el.errorMessage.textContent = message; el.error.hidden = false; }
})();
