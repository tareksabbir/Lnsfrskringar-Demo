#!/usr/bin/env python3
"""
Push the updated OT_NotificationDefault display template manually, bypassing
`yarn cms:push` — the CLI's esbuild dependency has no linux-arm64 binary
installed here (the mounted node_modules was built on the dev's Mac).

`displayTemplate({...})` (in @optimizely/cms-sdk) is a pure passthrough —
it just tags the object with `__type: 'displayTemplate'`, which the CLI then
strips before sending it to POST /v1/manifest (see cms-cli's `cleanType` in
service/utils.js). So this manifest below is byte-for-byte what `yarn cms:push`
would have generated from cms/display-templates/OT_NotificationDefault.ts —
transcribed by hand instead of compiled, because esbuild couldn't run here,
not because the manifest shape is any different.

Run:  python3 scripts/push_notification_layout.py [--dry-run]
"""

import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request


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


CMS = "https://api.cms.optimizely.com"

ICON_CHOICES_WITH_NONE = {
    "none": {"displayName": "None (Default)", "sortOrder": 5},
    "activity": {"displayName": "Activity", "sortOrder": 10},
    "arrowRight": {"displayName": "Arrow Right", "sortOrder": 20},
    "arrowUpRight": {"displayName": "Arrow Up-Right", "sortOrder": 30},
    "award": {"displayName": "Award", "sortOrder": 40},
    "barChart": {"displayName": "Bar Chart", "sortOrder": 50},
    "calendar": {"displayName": "Calendar", "sortOrder": 60},
    "checkCircle": {"displayName": "Check Circle", "sortOrder": 70},
    "chevronRight": {"displayName": "Chevron Right", "sortOrder": 80},
    "clock": {"displayName": "Clock", "sortOrder": 90},
    "code": {"displayName": "Code", "sortOrder": 100},
    "cpu": {"displayName": "CPU", "sortOrder": 110},
    "database": {"displayName": "Database", "sortOrder": 120},
    "dollarSign": {"displayName": "Dollar Sign", "sortOrder": 130},
    "download": {"displayName": "Download", "sortOrder": 140},
    "externalLink": {"displayName": "External Link", "sortOrder": 150},
    "eye": {"displayName": "Eye", "sortOrder": 160},
    "gauge": {"displayName": "Gauge", "sortOrder": 170},
    "globe": {"displayName": "Globe", "sortOrder": 180},
    "headphones": {"displayName": "Headphones", "sortOrder": 190},
    "heart": {"displayName": "Heart", "sortOrder": 200},
    "infinity": {"displayName": "Infinity", "sortOrder": 210},
    "layers": {"displayName": "Layers", "sortOrder": 220},
    "lightbulb": {"displayName": "Lightbulb", "sortOrder": 230},
    "lock": {"displayName": "Lock", "sortOrder": 240},
    "mail": {"displayName": "Mail", "sortOrder": 250},
    "mapPin": {"displayName": "Map Pin", "sortOrder": 260},
    "messageSquare": {"displayName": "Message Square", "sortOrder": 270},
    "monitor": {"displayName": "Monitor", "sortOrder": 280},
    "package": {"displayName": "Package", "sortOrder": 290},
    "percent": {"displayName": "Percent", "sortOrder": 300},
    "play": {"displayName": "Play", "sortOrder": 310},
    "plus": {"displayName": "Plus", "sortOrder": 320},
    "rocket": {"displayName": "Rocket", "sortOrder": 330},
    "send": {"displayName": "Send", "sortOrder": 340},
    "server": {"displayName": "Server", "sortOrder": 350},
    "settings": {"displayName": "Settings", "sortOrder": 360},
    "shield": {"displayName": "Shield", "sortOrder": 370},
    "sparkles": {"displayName": "Sparkles", "sortOrder": 380},
    "star": {"displayName": "Star", "sortOrder": 390},
    "target": {"displayName": "Target", "sortOrder": 400},
    "thumbsUp": {"displayName": "Thumbs Up", "sortOrder": 410},
    "timer": {"displayName": "Timer", "sortOrder": 420},
    "trendingUp": {"displayName": "Trending Up", "sortOrder": 430},
    "trophy": {"displayName": "Trophy", "sortOrder": 440},
    "userCheck": {"displayName": "User Check", "sortOrder": 450},
    "users": {"displayName": "Users", "sortOrder": 460},
    "wrench": {"displayName": "Wrench", "sortOrder": 470},
    "zap": {"displayName": "Zap", "sortOrder": 480},
}

OT_NOTIFICATION_DEFAULT = {
    "key": "OT_NotificationDefault",
    "displayName": "Notification Default",
    "contentType": "OT_NotificationBlock",
    "isDefault": True,
    "settings": {
        "tone": {
            "displayName": "Tone",
            "editor": "select",
            "sortOrder": 10,
            "choices": {
                "site": {"displayName": "Site preset (Default)", "sortOrder": 10},
                "accent": {"displayName": "Accent", "sortOrder": 20},
                "brand": {"displayName": "Brand", "sortOrder": 30},
                "warning": {"displayName": "Warning", "sortOrder": 40},
                "neutral": {"displayName": "Neutral", "sortOrder": 50},
            },
        },
        "frame": {
            "displayName": "Icon frame",
            "editor": "select",
            "sortOrder": 20,
            "choices": {
                "site": {"displayName": "Site preset (Default)", "sortOrder": 10},
                "plate": {"displayName": "Plate — filled, hatched", "sortOrder": 20},
                "ring": {"displayName": "Ring — outlined", "sortOrder": 30},
            },
        },
        "layout": {
            "displayName": "Layout",
            "editor": "select",
            "sortOrder": 25,
            "choices": {
                "band": {"displayName": "Band — icon beside text, left-aligned (Default)", "sortOrder": 10},
                "stacked": {"displayName": "Stacked — icon above text, centered", "sortOrder": 20},
            },
        },
        "density": {
            "displayName": "Density",
            "editor": "select",
            "sortOrder": 30,
            "choices": {
                "default": {"displayName": "Default (Default)", "sortOrder": 10},
                "compact": {"displayName": "Compact", "sortOrder": 20},
            },
        },
        "dismissible": {
            "displayName": "Dismissible",
            "editor": "select",
            "sortOrder": 40,
            "choices": {
                "off": {"displayName": "Off (Default)", "sortOrder": 10},
                "on": {"displayName": "On", "sortOrder": 20},
            },
        },
        "icon": {
            "displayName": "Icon",
            "editor": "select",
            "sortOrder": 50,
            "choices": ICON_CHOICES_WITH_NONE,
        },
        "entranceAnimation": {
            "displayName": "Entrance animation",
            "editor": "select",
            "sortOrder": 60,
            "choices": {
                "none": {"displayName": "None (Default)", "sortOrder": 10},
                "fade": {"displayName": "Fade in", "sortOrder": 20},
                "slide": {"displayName": "Slide up", "sortOrder": 30},
            },
        },
    },
}

MANIFEST = {
    "contentTypes": [],
    "displayTemplates": [OT_NOTIFICATION_DEFAULT],
    "propertyGroups": [],
}


def _req(url, data=None, method="GET", headers=None):
    h = {"User-Agent": "lf-notification-layout-push/1.0", "Accept": "*/*"}
    h.update(headers or {})
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=120) as x:
            b = x.read()
            return x.status, (json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b = e.read()
        try:
            p = json.loads(b)
        except Exception:
            p = b.decode(errors="replace")
        return e.code, p


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    print(json.dumps(MANIFEST, indent=2)[:500] + "\n... (truncated)\n")

    if args.dry_run:
        print("(dry run — nothing sent)")
        return

    d = (f"grant_type=client_credentials&client_id={_need('OPTIMIZELY_CMS_CLIENT_ID')}"
         f"&client_secret={_need('OPTIMIZELY_CMS_CLIENT_SECRET')}").encode()
    s, b = _req(f"{CMS}/oauth/token", d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200:
        sys.exit(f"token failed {s} {b}")
    tok = b["access_token"]

    s, b = _req(
        f"{CMS}/v1/manifest",
        json.dumps(MANIFEST).encode(),
        "POST",
        {
            "Authorization": f"Bearer {tok}",
            "Accept": "application/json",
            "Content-Type": "application/vnd.optimizely.cms.v1.manifest+json",
        },
    )
    print(f"status: {s}")
    print(json.dumps(b, indent=2)[:3000] if isinstance(b, (dict, list)) else b)
    if s not in (200, 201):
        sys.exit(1)


if __name__ == "__main__":
    main()
