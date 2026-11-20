"""Local dev server for webcamspiel (stdlib only).

- Forces correct MIME types for ES modules and WASM (Windows registry can break .js).
- Disables caching so edits show up on reload.
- HTTP (default): binds to 127.0.0.1; getUserMedia works because localhost is a secure context.
- HTTPS (--https): binds to all interfaces so phones/other PCs in the LAN can play with their
  camera (getUserMedia needs a secure context there). A self-signed certificate for localhost,
  this hostname and all LAN IPs is generated with openssl into dev/certs/ (git-ignored) and
  regenerated when the IPs change. The browser shows a warning once that has to be accepted.

Usage: python dev/serve.py [port] [--https] [--host ADDR]
"""
import argparse
import builtins
import functools
import http.server
import pathlib
import shutil
import socket
import ssl
import subprocess
import sys

print = functools.partial(builtins.print, flush=True)  # show URLs immediately even when piped

ROOT = pathlib.Path(__file__).resolve().parent.parent
CERT_DIR = ROOT / "dev" / "certs"
CERT = CERT_DIR / "dev-cert.pem"
KEY = CERT_DIR / "dev-key.pem"
SAN_FILE = CERT_DIR / "san.txt"

OPENSSL_FALLBACKS = [
    r"C:\Program Files\Git\usr\bin\openssl.exe",
    r"C:\Program Files\Git\mingw64\bin\openssl.exe",
]


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


def lan_ips():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except OSError:
        pass
    try:  # IP of the default route (no packet is sent for UDP connect)
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            ips.add(s.getsockname()[0])
    except OSError:
        pass
    return sorted(ip for ip in ips if not ip.startswith("127."))


def find_openssl():
    found = shutil.which("openssl")
    if found:
        return found
    for path in OPENSSL_FALLBACKS:
        if pathlib.Path(path).exists():
            return path
    return None


def ensure_cert(ips):
    host = socket.gethostname()
    san = ",".join(["DNS:localhost", f"DNS:{host}", "IP:127.0.0.1"] + [f"IP:{ip}" for ip in ips])
    if CERT.exists() and KEY.exists() and SAN_FILE.exists() and SAN_FILE.read_text() == san:
        return
    openssl = find_openssl()
    if not openssl:
        sys.exit("HTTPS braucht openssl (z. B. aus Git for Windows) – nicht gefunden.")
    CERT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Erzeuge selbstsigniertes Zertifikat für: {san}")
    subprocess.run([
        openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-sha256", "-days", "825",
        "-keyout", str(KEY), "-out", str(CERT),
        "-subj", "/CN=webcamspiel-dev", "-addext", f"subjectAltName={san}",
    ], check=True, capture_output=True)
    SAN_FILE.write_text(san)


def main():
    parser = argparse.ArgumentParser(description="webcamspiel dev server")
    parser.add_argument("port", nargs="?", type=int, default=8000)
    parser.add_argument("--https", action="store_true", help="HTTPS im LAN (selbstsigniertes Zertifikat)")
    parser.add_argument("--host", help="Bind-Adresse (Standard: 127.0.0.1, mit --https 0.0.0.0)")
    args = parser.parse_args()
    host = args.host or ("0.0.0.0" if args.https else "127.0.0.1")

    handler = functools.partial(DevHandler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer((host, args.port), handler) as httpd:
        if args.https:
            ips = lan_ips()
            ensure_cert(ips)
            ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            ctx.load_cert_chain(CERT, KEY)
            httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
            print(f"webcamspiel dev server (HTTPS): https://localhost:{args.port}")
            for ip in ips:
                print(f"  im LAN:  https://{ip}:{args.port}")
            print("  Zertifikat ist selbstsigniert: Browser-Warnung einmal bestätigen.")
            print("  Windows-Firewall muss Python im privaten Netz erlauben.")
        else:
            print(f"webcamspiel dev server: http://localhost:{args.port}  (root: {ROOT})")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nstopped")


if __name__ == "__main__":
    main()
