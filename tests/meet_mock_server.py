#!/usr/bin/env python3
import html
import json
import os
from datetime import datetime, timedelta, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def bridge(payload, target):
    safe = json.dumps(payload).replace("<", "\\u003c")
    return ("<!doctype html><meta charset=utf-8>"
            f"<script>top.postMessage({safe},{json.dumps(target)});</script>").encode()


class Handler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        relative = super().translate_path(path)
        return os.path.join(ROOT, os.path.relpath(relative, os.getcwd()))

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/mock-api":
            query = parse_qs(parsed.query)
            nonce = query.get("nonce", [""])[0]
            target = query.get("parentOrigin", ["http://127.0.0.1:8877"])[0]
            base = datetime.now(timezone.utc).replace(hour=17, minute=0, second=0, microsecond=0) + timedelta(days=2)
            days = []
            while len(days) < 5:
                if base.weekday() < 5:
                    days.append(base)
                base += timedelta(days=1)
            slots = [(day + timedelta(minutes=30 * index)).isoformat().replace("+00:00", "Z")
                     for day in days for index in range(4)]
            body = bridge({"channel": "daniel-meet", "action": "availability", "ok": True, "nonce": nonce, "slots": slots}, target)
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path != "/mock-api":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length", "0"))
        form = parse_qs(self.rfile.read(length).decode())
        action = form.get("action", [""])[0]
        nonce = form.get("nonce", [""])[0]
        target = form.get("parentOrigin", ["http://127.0.0.1:8877"])[0]
        if action == "book":
            start = datetime.fromisoformat(form["start"][0].replace("Z", "+00:00"))
            payload = {
                "channel": "daniel-meet", "action": "book", "ok": True, "nonce": nonce,
                "eventId": "mock-event", "start": start.isoformat().replace("+00:00", "Z"),
                "end": (start + timedelta(minutes=30)).isoformat().replace("+00:00", "Z"),
                "meetUrl": "https://meet.google.com/abc-defg-hij",
                "calendarUrl": "https://calendar.google.com/calendar/event?eid=mock"
            }
        elif action == "cancel":
            payload = {"channel": "daniel-meet", "action": "cancel", "ok": True, "nonce": nonce, "eventId": "mock-event"}
        else:
            payload = {"channel": "daniel-meet", "action": action, "ok": False, "nonce": nonce, "message": "Unknown action"}
        body = bridge(payload, target)
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_args):
        pass


if __name__ == "__main__":
    os.chdir(ROOT)
    ThreadingHTTPServer(("127.0.0.1", 8877), Handler).serve_forever()
