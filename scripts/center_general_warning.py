#!/usr/bin/env python3
"""
Set the "General warning" shared block's placement on the home page to the
new 'stacked' layout (icon above text, both centered) — the display-template
setting added in cms/display-templates/OT_NotificationDefault.ts and pushed
via scripts/push_notification_layout.py.

Only that one node's displaySettings.settings.layout is changed; every other
node/property in the home page composition is re-posted byte-for-byte, per
the atomic-rollback rule (`POST /versions` builds the new version from the
payload alone — omitting anything blanks it).

Run:  python3 scripts/center_general_warning.py [--dry-run]
"""

import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

TARGET_NODE_ID = "966db12b-fdbc-49aa-8f2c-edd21c62a4d9"
TARGET_REF_SUFFIX = "09865868bb4a40eda6ad958320f5c644"
HOME_KEY = "4edde6481e2442c4b18b40a5936b790d"
CMS = "https://api.cms.optimizely.com"


def _load_env(path=".env.local"):
    here = pathlib.Path(__file__).resolve().parent
    for base in (here.parent, here, pathlib.Path.cwd()):
        f = base / path
        if f.is_file():
            for line in f.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())
            return


_load_env()


def _need(n):
    v = os.environ.get(n)
    if not v:
        sys.exit(f"Missing {n}")
    return v


def _req(url, data=None, method="GET", headers=None):
    h = {"User-Agent": "lf-center-warning/1.0", "Accept": "*/*"}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=120) as x:
            b = x.read()
            return x.status, {k.lower(): v for k, v in x.getheaders()}, (json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            p = json.loads(b)
        except Exception:
            p = b.decode(errors="replace")
        return e.code, {k.lower(): v for k, v in e.headers.items()}, p


def set_layout(node, changed):
    if isinstance(node, dict):
        comp = node.get("component") or {}
        if node.get("id") == TARGET_NODE_ID or (
            isinstance(comp.get("reference"), str) and comp["reference"].endswith(TARGET_REF_SUFFIX)
        ):
            node.setdefault("displaySettings", {}).setdefault("settings", {})["layout"] = "stacked"
            changed.append(node["id"])
        for v in node.values():
            set_layout(v, changed)
    elif isinstance(node, list):
        for v in node:
            set_layout(v, changed)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    d = (f"grant_type=client_credentials&client_id={_need('OPTIMIZELY_CMS_CLIENT_ID')}"
         f"&client_secret={_need('OPTIMIZELY_CMS_CLIENT_SECRET')}").encode()
    s, _, b = _req(f"{CMS}/oauth/token", d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200:
        sys.exit(f"token failed {s} {b}")
    tok = b["access_token"]
    H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

    s, _, vs = _req(f"{CMS}/v1/content/{HOME_KEY}/versions", None, "GET", {"Authorization": f"Bearer {tok}"})
    if s != 200:
        sys.exit(f"versions fetch failed: {s} {vs}")
    published = [v for v in vs["items"] if v["status"] == "published"]
    if not published:
        sys.exit("no published version found")
    cur = published[0]

    comp = cur["composition"]
    changed = []
    set_layout(comp, changed)
    if not changed:
        sys.exit("Target node not found in the current composition — did the home page change since this script was written?")
    print(f"Set layout='stacked' on node(s): {changed}")

    if args.dry_run:
        print("(dry run — nothing written)")
        return

    payload = json.dumps({
        "displayName": cur["displayName"],
        "locale": cur.get("locale", "en"),
        "routeSegment": cur.get("routeSegment"),
        "composition": comp,
    }).encode()

    s, h, b = _req(f"{CMS}/v1/content/{HOME_KEY}/versions", payload, "POST", H)
    if s != 201:
        print(f"\ncreate version failed {s}")
        print(json.dumps(b, indent=2)[:3000] if isinstance(b, (dict, list)) else b)
        sys.exit(1)
    nv = h.get("location", "").rstrip("/").split("/")[-1]
    s, _, b = _req(f"{CMS}/v1/content/{HOME_KEY}/versions/{nv}:publish", b"{}", "POST", H)
    if s not in (200, 204):
        print(f"\npublish failed {s} {b}")
        sys.exit(1)
    print(f"\nPUBLISHED v{nv}")


if __name__ == "__main__":
    main()
