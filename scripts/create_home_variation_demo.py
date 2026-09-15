#!/usr/bin/env python3
"""
Create a DRAFT content variation on the LF Stockholm home experience, changing
only the hero headline — a showcase/demo of Optimizely CMS (SaaS) content
variations (see Optimizely.md, "Content variations").

WHAT THIS DOES
  1. Reads the currently PUBLISHED version of the home experience
     (HOME_KEY, same key rebuild_lf_home_vb.py uses).
  2. Deep-copies its composition and replaces ONLY the hero block's `headline`
     property with a new copy-test string.
  3. POSTs a new version with a `variation` name set, alongside the usual
     displayName/locale/routeSegment/composition fields that
     rebuild_lf_home_vb.py already uses successfully for plain versions.
  4. Does NOT call :publish. The new version is left as an unpublished DRAFT —
     it will not appear on the live site, and Graph will not index it, until
     someone explicitly publishes it. That is deliberate: this script is a
     showcase/demo aid, not a live copy change.

IMPORTANT — UNVERIFIED ASSUMPTION
  Optimizely.md documents that a variation IS a version carrying a value in
  `_metadata.variation`, established by inspecting Graph data on this
  instance. It does NOT document the exact REST property name the Content
  Management API's `POST /v1/content/{key}/versions` body expects to SET that
  value on write — every existing script in this repo (rebuild_lf_home_vb.py,
  create_contact_form.py, ...) only ever creates plain versions/content, never
  a variation.

  This script assumes the body accepts a top-level `"variation": "<name>"`
  field, parallel to `"locale"`. If the CMS instead rejects that field (400,
  unknown property) or silently drops it (201 succeeds but the new version
  reads back with variation=null), the safe fallback is the documented
  editorial path:

      Content tree -> select Home -> Variations -> Add variation
      -> name it -> paste the new headline into the hero block -> Save
      (leave unpublished)

  This script prints the new version number either way so you can open it in
  the CMS UI and confirm under Variations / the Version gadget whether it
  actually landed as a variation.

Run:  python3 scripts/create_home_variation_demo.py --dry-run   (no writes)
      python3 scripts/create_home_variation_demo.py              (writes a draft)

NOTE: this must be run from a machine with real network access to
api.cms.optimizely.com using the credentials in .env.local — it was NOT run
from within this session (outbound requests to that host were blocked by
Cloudflare from this sandbox, error code 1010).
"""

import argparse
import copy
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

HOME_KEY = "4edde6481e2442c4b18b40a5936b790d"
CMS = "https://api.cms.optimizely.com"
UA = "lf-home-variation-demo/1.0"

NEW_HEADLINE = "New? Save 15% on car insurance in your first year online."
VARIATION_NAME = "ShowcaseCopyTest"  # must start with a letter, alphanumeric only


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
        sys.exit(f"Missing {n}. Set it in .env.local at the repo root.")
    return v


def _req(url, data=None, method="GET", headers=None):
    h = {"User-Agent": UA, "Accept": "*/*"}
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


def cms_token():
    d = (f"grant_type=client_credentials&client_id={_need('OPTIMIZELY_CMS_CLIENT_ID')}"
         f"&client_secret={_need('OPTIMIZELY_CMS_CLIENT_SECRET')}").encode()
    s, _, b = _req(f"{CMS}/oauth/token", d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200:
        sys.exit(f"CMS token failed: {s} {b}")
    return b["access_token"]


def replace_hero_headline(node, new_text, found=[False]):
    """Walks the composition tree and rewrites the first OT_HeroBlock's headline."""
    comp = node.get("component")
    if comp and comp.get("contentType") == "OT_HeroBlock":
        props = comp.setdefault("properties", {})
        old = (props.get("headline") or {}).get("value")
        props["headline"] = {"value": new_text}
        found[0] = True
        print(f"  hero headline: {old!r}\n               -> {new_text!r}")
    for child in node.get("nodes") or []:
        replace_hero_headline(child, new_text, found)
    return found[0]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    tok = cms_token()
    H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

    # ── 1. find the current published version ──────────────────────────────
    s, _, vs = _req(f"{CMS}/v1/content/{HOME_KEY}/versions", None, "GET", {"Authorization": f"Bearer {tok}"})
    if s != 200:
        sys.exit(f"list versions failed: {s} {vs}")
    published = [v for v in vs["items"] if v["status"] == "published"]  # /versions is NOT sorted
    if not published:
        sys.exit("no published version found for HOME_KEY")
    cur = published[0]
    ver = cur["version"] if "version" in cur else cur.get("id")
    print(f"current published version: {ver}")

    # ── 2. fetch that version's full body (composition included) ───────────
    s, _, full = _req(f"{CMS}/v1/content/{HOME_KEY}/versions/{ver}", None, "GET",
                       {"Authorization": f"Bearer {tok}"})
    if s != 200:
        sys.exit(f"fetch version {ver} failed: {s} {full}")

    comp = copy.deepcopy(full["composition"])
    print("Rewriting hero headline for variation:")
    if not replace_hero_headline(comp, NEW_HEADLINE):
        sys.exit("no OT_HeroBlock found in composition — nothing to change, aborting")

    body = {
        "displayName": cur.get("displayName") or full.get("displayName"),
        "locale": cur.get("locale", "en"),
        "routeSegment": cur.get("routeSegment") or full.get("routeSegment"),
        "composition": comp,
        # UNVERIFIED — see module docstring. If the CMS rejects this key,
        # remove it and create the variation manually in the CMS UI instead,
        # pasting NEW_HEADLINE into the hero block by hand.
        "variation": VARIATION_NAME,
    }

    print(f"\nvariation name: {VARIATION_NAME}")
    print(f"payload size: {len(json.dumps(body)):,} bytes")

    if args.dry_run:
        print("\n(dry run — nothing written)")
        return

    s, h, b = _req(f"{CMS}/v1/content/{HOME_KEY}/versions", json.dumps(body).encode(), "POST", H)
    if s != 201:
        print(f"\ncreate version failed {s}")
        print(json.dumps(b, indent=2)[:3000] if isinstance(b, (dict, list)) else b)
        print("\nIf the failure mentions the 'variation' field specifically, this REST "
              "shortcut isn't supported the way this script assumed — use the CMS UI's "
              "Variations > Add variation flow instead, then paste in the headline above.")
        sys.exit(1)

    nv = h.get("location", "").rstrip("/").split("/")[-1]
    print(f"\nCreated DRAFT version v{nv} (NOT published).")
    print("Open it in the CMS UI (Content tree -> Home -> Versions) and confirm under "
          "Variations whether it actually landed as a variation named "
          f"'{VARIATION_NAME}', or as a plain new version of the original.")
    print("Left unpublished on purpose — publish only from the CMS UI once verified.")


if __name__ == "__main__":
    main()
