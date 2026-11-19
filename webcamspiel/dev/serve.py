"""Local dev server for webcamspiel (stdlib only).

- Binds to 127.0.0.1 so getUserMedia works (localhost counts as a secure context).
- Forces correct MIME types for ES modules and WASM (Windows registry can break .js).
- Disables caching so edits show up on reload.

Usage: python dev/serve.py [port]
HTTPS is intentionally not handled here yet (planned for LAN/phone testing later).
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000


class DevHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".task": "application/octet-stream",
        ".svg": "image/svg+xml",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main():
    handler = functools.partial(DevHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler) as httpd:
        print(f"webcamspiel dev server: http://localhost:{PORT}  (root: {ROOT})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
