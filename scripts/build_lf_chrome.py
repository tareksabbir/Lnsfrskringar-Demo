#!/usr/bin/env python3
"""
Create the LF Stockholm site chrome — footer block + theme manager (header/site settings).

These are NOT composition nodes. OT_FooterBlock and OT_ThemeManager have no
compositionBehaviors, so they are standalone content items that the frontend reads
directly (Footer.tsx via settings.footerRef, Header.tsx via settings.*).

Array-of-component values use {"properties": {...}} with no contentType.
Pure REST throughout, including publish.
"""
import json
import sys
import urllib.error
import urllib.request

# ── Credentials ──────────────────────────────────────────────────────────────
# Read from .env.local (gitignored) or the environment. Never hardcode secrets
# here: this file lives in the repo and would push them to GitHub.
def _load_env(path=".env.local"):
    import os, pathlib as _p
    here = _p.Path(__file__).resolve().parent
    for base in (here.parent, here, _p.Path.cwd()):
        f = base / path
        if f.is_file():
            for line in f.read_text().splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())
            return
_load_env()

def _need(name):
    import os, sys
    v = os.environ.get(name)
    if not v:
        sys.exit(f"Missing {name}. Set it in .env.local at the repo root, or export it.")
    return v



CLIENT_ID     = _need("OPTIMIZELY_CMS_CLIENT_ID")
CLIENT_SECRET = _need("OPTIMIZELY_CMS_CLIENT_SECRET")
BASE = "https://api.cms.optimizely.com"
ROOT = "43f936c99b234ea397b261c538ad07c9"
HOME_KEY = "4edde6481e2442c4b18b40a5936b790d"
# Set once the footer exists, so re-runs don't create duplicates.
EXISTING_FOOTER_KEY = "c11430b94afb49549ad20a2d70a01742"
FRONTEND = "localhost:3000"
UA = "lf-demo-builder/1.0"


def get_token():
    d = (f"grant_type=client_credentials&client_id={CLIENT_ID}"
         f"&client_secret={CLIENT_SECRET}").encode()
    r = urllib.request.Request(f"{BASE}/oauth/token", data=d, method="POST",
                               headers={"Content-Type": "application/x-www-form-urlencoded",
                                        "User-Agent": UA})
    with urllib.request.urlopen(r) as x:
        return json.load(x)["access_token"]


def call(m, p, tk, body=None, ct="application/json"):
    h = {"Authorization": f"Bearer {tk}", "User-Agent": UA, "Accept": "*/*"}
    d = None
    if body is not None:
        h["Content-Type"] = ct
        d = json.dumps(body).encode()
    r = urllib.request.Request(f"{BASE}{p}", data=d, method=m, headers=h)
    try:
        with urllib.request.urlopen(r) as x:
            raw = x.read()
            return x.status, {k.lower(): v for k, v in x.getheaders()}, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        raw = e.read()
        try:
            b = json.loads(raw)
        except Exception:
            b = raw.decode(errors="replace")
        return e.code, {k.lower(): v for k, v in e.headers.items()}, b


def link(label, url="#"):
    """One OT_FooterLink inside an array-of-component property."""
    return {"properties": {"label": {"value": label}, "url": {"value": url}}}


def col(heading, links):
    """One OT_FooterColumn — heading plus its own nested link array."""
    return {"properties": {
        "heading": {"value": heading},
        "links": {"value": [link(l) for l in links]},
    }}


def nav(text, url="#"):
    """One OT_NavigationItem — menuLink is a `link` type: url + text + title + target."""
    return {"properties": {"menuLink": {"value": {"url": url, "text": text, "title": text}}}}


def create_and_publish(tk, label, payload):
    status, headers, body = call("POST", "/v1/content", tk, payload)
    if status != 201:
        print(f"  FAILED {label}: {status}")
        print("  " + (json.dumps(body, indent=2)[:2500] if isinstance(body, (dict, list)) else str(body)))
        sys.exit(1)
    key = headers.get("location", "").rstrip("/").split("/")[-1]
    ver = headers.get("cms-content-version-location", "").rstrip("/").split("/")[-1]
    s2, _, b2 = call("POST", f"/v1/content/{key}/versions/{ver}:publish", tk, {})
    state = "published" if s2 in (200, 204) else f"PUBLISH FAILED {s2}"
    print(f"  {label:<14} key={key} v={ver}  {state}")
    if s2 not in (200, 204):
        print("  " + (json.dumps(b2)[:800] if isinstance(b2, (dict, list)) else str(b2)))
    return key, ver


# ── Footer — 7 column groups + legal bottom bar, straight from the screenshot ──

FOOTER = {
    "contentType": "OT_FooterBlock",
    "container": ROOT,
    "initialVersion": {
        "displayName": "LF Stockholm Footer",
        "locale": "en",
        "properties": {
            "footerStyle": {"value": "columns"},
            "footerLeftMode": {"value": "light"},
            "footerLogoSize": {"value": "md"},
            "description": {"value": {"html":
                "<p>Länsförsäkringar Stockholm — banking and insurance with all of "
                "Stockholm as its home base.</p>"}},
            "columns": {"value": [
                col("Ensure", ["Home insurance", "Car insurance", "Personal insurance",
                               "Illness and accidents", "All insurances"]),
                col("Borrow", ["Mortgage", "Car loan", "Personal loan", "All loan services"]),
                col("Save & invest", ["Savings accounts", "Funds", "Fund prices",
                                      "Open ISK", "Retirement savings"]),
                col("Account & card", ["Become a bank customer", "Cards & payments", "Swish"]),
                col("About us", ["About LF Stockholm", "The Regional Insurance Group",
                                 "Financial reports", "Sustainability", "Research",
                                 "Press & media", "Work with us", "Availability"]),
                col("Customer service", ["Banking & pensions", "Insurance",
                                         "Injury, loss & illness", "Our offices",
                                         "Frequently asked questions & answers",
                                         "If we don't agree"]),
                col("Please advise", ["Give your opinion about lf.se"]),
            ]},
            "bottomLinks": {"value": [
                link("Cookie settings"), link("Personal information"),
                link("Terms of Use"), link("Residents in the US"),
            ]},
        },
    },
}


def theme_manager(footer_key):
    return {
        "contentType": "OT_ThemeManager",
        "container": ROOT,
        "initialVersion": {
            "displayName": "LF Stockholm Site Settings",
            "locale": "en",
            "properties": {
                "siteName": {"value": "LF Stockholm"},
                "frontEndDomain": {"value": FRONTEND},
                "logoAlt": {"value": "Länsförsäkringar Stockholm"},
                "logoFit": {"value": "full"},
                "defaultMode": {"value": "light"},

                # Utility bar — the dark navy persona strip above the header.
                "utilityNav": {"value": [
                    nav("Private"), nav("Business & Agriculture"),
                ]},

                # Header actions, right of the logo.
                "primaryNavigation": {"value": [
                    nav("County"), nav("Log in"), nav("Menu"),
                ]},

                "ctaLabel": {"value": "Sign up now"},
                "ctaUrl": {"value": "#"},
                "searchScope": {"value": "thisSite"},

                "footerRef": {"value": f"cms://content/{footer_key}"},
                "copyright": {"value": "Länsförsäkringar Stockholm"},

                # LF navy #00427a -> oklch. Mirrors styles/tokens.css so CMS and
                # repo agree; ThemeManager wins at runtime via buildThemeCSS().
                "colorBrand": {"value": "oklch(38% 0.11 252)"},
                "colorBrandHover": {"value": "oklch(27% 0.09 252)"},
                "cornerStyle": {"value": "soft"},
                "navbarStyle": {"value": "top-bar"},

                "defaultSeoDescription": {"value":
                    "Banking and insurance with all of Stockholm as its home base."},
                "organizationDescription": {"value":
                    "Länsförsäkringar Stockholm is a local, customer-owned bank and "
                    "insurance company serving the Stockholm region."},
            },
        },
    }


def main():
    tk = get_token()
    print("Creating site chrome\n")

    if EXISTING_FOOTER_KEY:
        footer_key = EXISTING_FOOTER_KEY
        print(f"  {'FooterBlock':<14} key={footer_key}  reused")
    else:
        footer_key, _ = create_and_publish(tk, "FooterBlock", FOOTER)
    theme_key, _ = create_and_publish(tk, "ThemeManager", theme_manager(footer_key))

    print(f"\n  home experience  {HOME_KEY}")
    print(f"  footer           {footer_key}")
    print(f"  site settings    {theme_key}  (frontEndDomain={FRONTEND})")
    print("\nHeader/footer are read by the frontend from ThemeManager, not from the")
    print("page composition. Graph indexing lags 2-5 min before they appear.")


if __name__ == "__main__":
    main()
