"""Localhost receiver for images pushed from the Google Flow tab.

The Flow page POSTs each image to http://127.0.0.1:<port>/<video-id>/<scene-id>.jpg and this
writes it to <project>/public/<video-id>/assets/<scene-id>.jpg. Video ids are limited to the
files in <project>/data/videos/, read at startup.

Usage: python3 -I receiver.py <project-dir> [--port 17999]
"""
import argparse
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("project")
ap.add_argument("--port", type=int, default=17999)
args = ap.parse_args()

PROJECT = Path(args.project).resolve()
ALLOWED = {p.stem for p in (PROJECT / "data" / "videos").glob("*.json")}


class Handler(BaseHTTPRequestHandler):
    def cors(self):
        self.send_header("Access-Control-Allow-Origin", "https://flow.google.com")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Private-Network", "true")

    def do_OPTIONS(self):
        self.send_response(204)
        self.cors()
        self.end_headers()

    def do_POST(self):
        m = re.fullmatch(r"/([a-z0-9-]+)/([a-z]\d\d)\.jpg", self.path)
        if not m or m.group(1) not in ALLOWED:
            self.send_response(400)
            self.cors()
            self.end_headers()
            return
        data = self.rfile.read(int(self.headers["Content-Length"]))
        dest = PROJECT / "public" / m.group(1) / "assets" / f"{m.group(2)}.jpg"
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
        self.send_response(200)
        self.cors()
        self.end_headers()
        self.wfile.write(f"saved {m.group(1)}/{dest.name} {len(data)}".encode())

    def log_message(self, *a):
        pass


print(f"receiver on 127.0.0.1:{args.port} -> {PROJECT}/public (videos: {', '.join(sorted(ALLOWED))})", flush=True)
HTTPServer(("127.0.0.1", args.port), Handler).serve_forever()
