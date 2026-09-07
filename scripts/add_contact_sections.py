#!/usr/bin/env python3
"""
Add a hero/intro section and a trust/reassurance section BEFORE the existing
form section, and a closing/thank-you section AFTER it, on the "Contact Us"
experience (routeSegment: contact-us).

The form section itself (a reference to the OptiFormsContainerData block, key
150076c57533497c8a82adf77750177e) is fetched from the live published version
and re-posted byte-for-byte — this script never touches it. Everything else
follows the same node shape as scripts/rebuild_lf_home_vb.py (section -> row
-> column -> component), which is what makes the result selectable/editable
in Visual Builder's Outline.

The new text blocks are OT_PrimaryTextBlock (headline + richText body) —
already rendered by every route via the OptimizelyComponent registry, and
already covered by the hand-written query in lib/experienceComposition.ts
(see its COMPONENT_FRAGMENT), so no code changes are needed for these new
sections to show up on /contact-us.

Run:  python3 scripts/add_contact_sections.py [--dry-run]
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
        sys.exit(f"Missing {n}. Set it in .env.local at the repo root.")
    return v


CMS = "https://api.cms.optimizely.com"
CONTACT_KEY = "62d5fce37f4e4a3c9291823c733bbe62"
UA = "lf-contact-sections/1.0"


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


# ── Node builders (same shapes as scripts/rebuild_lf_home_vb.py) ────────────

def component(content_type, template, settings, properties):
    return {"nodeType": "component",
            "displaySettings": {"displayTemplate": template, "settings": settings},
            "component": {"contentType": content_type, "properties": properties}}


def column(children, span="col12"):
    return {"nodeType": "column",
            "displaySettings": {"displayTemplate": "OT_LandingColumn",
                                 "settings": {"gridSpan": span, "contentSpacing": "small",
                                              "verticalPadding": "none"}},
            "nodes": children}


def row(columns, gap="medium", vpad="small", anim="none"):
    return {"nodeType": "row",
            "displaySettings": {"displayTemplate": "OT_LandingRow",
                                 "settings": {"showAsRowFrom": "lg", "contentSpacing": gap,
                                              "verticalPadding": vpad,
                                              "entranceAnimation": anim}},
            "nodes": columns}


def section(rows, name, bg="canvas", spacing="medium", width="default"):
    return {"nodeType": "section", "layoutType": "grid", "displayName": name,
            "displaySettings": {"displayTemplate": "OT_LandingSection",
                                 "settings": {"gridWidth": width, "verticalSpacing": spacing,
                                              "backgroundColor": bg, "sectionOverlap": "none",
                                              "entranceAnimation": "none"}},
            "component": {"contentType": "BlankSection", "properties": {}},
            "nodes": rows}


def text_block(headline=None, body_html=None, heading_level="h2", size="headline",
                color="none", alignment="left", eyebrow=None):
    props = {}
    if eyebrow:
        props["eyebrow"] = {"value": eyebrow}
    if headline:
        props["headline"] = {"value": headline}
    props["headingLevel"] = {"value": heading_level}
    if body_html:
        props["body"] = {"value": {"html": body_html}}
    return component("OT_PrimaryTextBlock", "OT_PrimaryTextDefault",
                      {"alignment": alignment, "color": color, "size": size,
                       "spacing": "default", "entranceAnimation": "none"},
                      props)


def build_new_sections():
    hero = section(
        [row([column([text_block(
            headline="Contact us",
            body_html="<p>Questions about your insurance, a claim, or your account? "
                      "Send us a message below and we&rsquo;ll get back to you as soon as "
                      "we can.</p>",
            heading_level="h1", size="display")], span="col12")],
             vpad="none")],
        "Contact hero", bg="canvas", spacing="medium", width="default")

    trust = section(
        [row([column([text_block(
            body_html="<p>We usually reply within one business day. Prefer to talk to "
                      "someone directly? Call us Monday&ndash;Friday, 8:00&ndash;17:00.</p>",
            size="label")], span="col12")],
             vpad="none")],
        "Response times", bg="surface", spacing="small", width="default")

    closing = section(
        [row([column([text_block(
            headline="Thank you for reaching out",
            body_html="<p>We&rsquo;ve received messages like yours before and always aim "
                      "to help quickly. Looking for something else in the meantime? Check "
                      "our other contact options and office locations.</p>",
            heading_level="h2", size="title")], span="col12")],
             vpad="none")],
        "After you submit", bg="canvas", spacing="medium", width="default")

    return hero, trust, closing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    tok = cms_token()
    H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

    s, _, vs = _req(f"{CMS}/v1/content/{CONTACT_KEY}/versions", None, "GET", {"Authorization": f"Bearer {tok}"})
    if s != 200:
        sys.exit(f"versions fetch failed: {s} {vs}")
    published = [v for v in vs["items"] if v["status"] == "published"]
    if not published:
        sys.exit("no published version found")
    cur = published[0]

    form_nodes = cur["composition"]["nodes"]
    if len(form_nodes) != 1 or form_nodes[0]["nodeType"] != "section":
        print("WARNING: composition doesn't look like just the form section — check before publishing.")
        print(json.dumps(form_nodes, indent=2)[:2000])

    hero, trust, closing = build_new_sections()
    new_nodes = [hero, trust, *form_nodes, closing]

    comp = {"nodeType": "experience", "layoutType": "outline", "nodes": new_nodes}

    print(f"New composition: {len(new_nodes)} top-level sections, "
          f"{len(json.dumps(comp)):,} bytes")
    for n in new_nodes:
        ref = (n.get("component") or {}).get("reference")
        print(f"  - {n.get('displayName') or '(unnamed)'}" + (f"  [reference: {ref}]" if ref else ""))

    if args.dry_run:
        print("\n(dry run — nothing written)")
        return

    payload = json.dumps({
        "displayName": cur["displayName"],
        "locale": cur.get("locale", "en"),
        "routeSegment": cur.get("routeSegment"),
        "composition": comp,
    }).encode()

    s, h, b = _req(f"{CMS}/v1/content/{CONTACT_KEY}/versions", payload, "POST", H)
    if s != 201:
        print(f"\ncreate version failed {s}")
        print(json.dumps(b, indent=2)[:3000] if isinstance(b, (dict, list)) else b)
        sys.exit(1)
    nv = h.get("location", "").rstrip("/").split("/")[-1]
    s, _, b = _req(f"{CMS}/v1/content/{CONTACT_KEY}/versions/{nv}:publish", b"{}", "POST", H)
    if s not in (200, 204):
        print(f"\npublish failed {s} {b}")
        sys.exit(1)
    print(f"\nPUBLISHED v{nv}")
    print("Graph indexing lags a few minutes — the live page / Visual Builder may 404 or show "
          "stale content until it catches up.")


if __name__ == "__main__":
    main()
