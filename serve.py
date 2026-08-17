#!/usr/bin/env python3
"""
Serve this folder to the shop's network — the optional way in.

Normally you do not need this: the shop's own system serves the same page at
http://<shop-pc>:8000/add, which is one address, no second thing to start, and
already open in the firewall.

This exists for the case where you want the page on a different machine from the
till — a spare laptop, or a PC in the stockroom — or you are working on the files
in this folder and want to see the change immediately.

    python serve.py

Plain http, deliberately. A page served over https cannot call the shop's
backend at all: browsers forbid a secure page from reaching a plain address on a
local network, and they block it silently, so the form would look fine and never
save. http talking to http is the arrangement that works.

Windows will ask to allow Python through the firewall the first time. Say yes for
private networks, or no phone will be able to reach it.
"""
import http.server
import socket
import socketserver
import os
import sys

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
HERE = os.path.dirname(os.path.abspath(__file__))


def lan_ip() -> str:
    """This machine's address on the shop's network.

    Asking the OS for "the address a packet to the internet would leave from"
    is the only reliable way: a PC has several addresses (loopback, maybe a
    virtual adapter, maybe a second NIC) and hostname lookup often returns
    127.0.0.1 on Windows. No packet is actually sent — a UDP socket that is
    only connected sends nothing.
    """
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=HERE, **kw)

    def end_headers(self):
        # While editing these files, a cached app.js is a change that appears not
        # to have happened.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stdout.write("  %s\n" % (fmt % args))


class Server(socketserver.ThreadingTCPServer):
    # Several phones at once, and a socket that can be rebound straight after
    # Ctrl+C instead of sitting in TIME_WAIT for a minute.
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    ip = lan_ip()
    print()
    print("  Add Products — serving this folder on the network")
    print()
    print(f"  On this PC          http://127.0.0.1:{PORT}/")
    print(f"  From a phone        http://{ip}:{PORT}/")
    print()
    print("  If the shop's system is on a DIFFERENT PC, add its address:")
    print(f"  http://{ip}:{PORT}/?api=http://<shop-pc-ip>:8000")
    print()
    print("  Everyone must be on the same Wi-Fi. Ctrl+C to stop.")
    print()
    try:
        Server(("0.0.0.0", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Stopped.\n")
    except OSError as e:
        print(f"\n  Could not start on port {PORT}: {e}")
        print(f"  Something else is using it. Try: python serve.py {PORT + 1}\n")
        sys.exit(1)
