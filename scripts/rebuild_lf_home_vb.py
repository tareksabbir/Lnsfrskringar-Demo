#!/usr/bin/env python3
"""
Rebuild the LF Stockholm home experience in the shape Visual Builder expects, so
every section AND every block is selectable in the Outline and clicking either in
the preview highlights it.

WHY THE SHAPE MATTERS
  Visual Builder's Outline is a list of SECTIONS (per the Visual Builder docs),
  and elements live inside them. The legal nesting is:

      experience (layoutType: outline)
        section  (layoutType: grid, component = BlankSection)
          row
            column
              component   <- the block

  The previous build put hero, the feature grids and the standalone headings as
  FLAT component nodes directly under the experience. The CMS accepts that and
  the page renders, but those nodes are not section children, so VB has nothing
  to list or map overlays onto — the page appeared, nothing was selectable.

WHY THE FEATURE GRIDS ARE GONE
  Only `elementEnabled` blocks may sit inside a column. Probed against the live
  instance, OT_FeatureGridBlock (sectionEnabled ONLY) is rejected in every
  position:
      section node component  -> "The component type is not based on section base type."
      inside a column         -> "Only element enabled components are allowed within an section."
  So it has no valid home in a properly nested composition here. The tile rows it
  used to draw (product tiles, Popularly, Quick links) are now OT_CardBlock —
  elementEnabled, and visually the same compact icon/label/arrow tile.

Run:  python3 scripts/rebuild_lf_home_vb.py [--dry-run]
"""

import argparse
import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

# ── Credentials ──────────────────────────────────────────────────────────────
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
    if not v: sys.exit(f"Missing {n}. Set it in .env.local at the repo root.")
    return v

CMS = "https://api.cms.optimizely.com"
CMP = "https://api.cmp.optimizely.com"
CMP_TOKEN_URL = "https://accounts.cmp.optimizely.com/o/oauth2/v1/token"
HOME_KEY = "4edde6481e2442c4b18b40a5936b790d"
UA = "lf-vb-rebuild/1.0"


def _req(url, data=None, method="GET", headers=None):
    h = {"User-Agent": UA, "Accept": "*/*"}; h.update(headers or {})
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(r, timeout=120) as x:
            b = x.read()
            return x.status, {k.lower(): v for k, v in x.getheaders()}, (json.loads(b) if b else None)
    except urllib.error.HTTPError as e:
        b = e.read()
        try: p = json.loads(b)
        except Exception: p = b.decode(errors="replace")
        return e.code, {k.lower(): v for k, v in e.headers.items()}, p


def cms_token():
    d = (f"grant_type=client_credentials&client_id={_need('OPTIMIZELY_CMS_CLIENT_ID')}"
         f"&client_secret={_need('OPTIMIZELY_CMS_CLIENT_SECRET')}").encode()
    s, _, b = _req(f"{CMS}/oauth/token", d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200: sys.exit(f"CMS token failed: {s} {b}")
    return b["access_token"]


def dam_asset_by_title(fragment, exclude=("logo",)):
    """
    Find a DAM asset whose title contains `fragment` (case-insensitive).

    `exclude` guards against loose matches. Searching "stockholm" happily matched
    "LF Stockholm Logo" and put the logo in the illustration slot — the CMS then
    rejected the whole composition with an unresolved-reference error that looked
    like a sync problem rather than a wrong key.
    """
    d = (f"grant_type=client_credentials&client_id={_need('CMP_CLIENT_ID')}"
         f"&client_secret={_need('CMP_CLIENT_SECRET')}").encode()
    s, _, b = _req(CMP_TOKEN_URL, d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200: return None
    s, _, b = _req(f"{CMP}/v3/assets", headers={"Authorization": f"Bearer {b['access_token']}"})
    if s != 200: return None
    for a in b.get("data", []):
        title = (a.get("title") or "").lower()
        if fragment.lower() in title and not any(x in title for x in exclude):
            return a["id"]
    return None


def dam_photos():
    d = (f"grant_type=client_credentials&client_id={_need('CMP_CLIENT_ID')}"
         f"&client_secret={_need('CMP_CLIENT_SECRET')}").encode()
    s, _, b = _req(CMP_TOKEN_URL, d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200: sys.exit(f"CMP token failed: {s}")
    s, _, b = _req(f"{CMP}/v3/assets", headers={"Authorization": f"Bearer {b['access_token']}"})
    if s != 200: sys.exit(f"DAM list failed: {s}")
    out = []
    for a in b.get("data", []):
        mime = a.get("mime_type") or ""
        if mime.startswith("image/") and mime != "image/svg+xml" and "logo" not in (a.get("title") or "").lower():
            out.append({"key": a["id"], "title": a.get("title") or ""})
    return out


# ── Node builders ────────────────────────────────────────────────────────────

def component(content_type, template, settings, properties):
    return {"nodeType": "component",
            "displaySettings": {"displayTemplate": template, "settings": settings},
            "component": {"contentType": content_type, "properties": properties}}


def column(children, span="auto"):
    return {"nodeType": "column",
            "displaySettings": {"displayTemplate": "OT_LandingColumn",
                                "settings": {"gridSpan": span, "contentSpacing": "small",
                                             "verticalPadding": "none"}},
            "nodes": children}


def row(columns, gap="medium", vpad="small", anim="slide"):
    """
    `vpad` is the gap BETWEEN rows in a section. "small" is the default because
    "none" left two tile rows touching and made them read as overlapping.

    Pass vpad="none" for a single-row section whose block draws its own coloured
    band edge to edge — the hero. There the row padding is not a gap between
    anything, it just pushes the headline down and leaves a strip of bare tint
    above it, which reads as the section being misaligned with the header.
    """
    return {"nodeType": "row",
            "displaySettings": {"displayTemplate": "OT_LandingRow",
                                # stack until desktop — 3-4 cards side by side on a
                                # phone is unreadable.
                                # The stagger lives on the ROW, not the section:
                                # [data-stagger] animates a node's CHILDREN, and a
                                # row's children are its columns. Put it on the
                                # section and the whole slab moves as one lump,
                                # which is the opposite of choreographed.
                                "settings": {"showAsRowFrom": "lg", "contentSpacing": gap,
                                             "verticalPadding": vpad,
                                             "entranceAnimation": anim}},
            "nodes": columns}


def section(rows, name, bg="canvas", spacing="medium", width="default"):
    """
    layoutType AND a _section-based component are both mandatory on a section.

    `displayName` is what Visual Builder's Outline shows. Omit it and every row
    in the outline reads "Blank Section" (the underlying content type), which is
    useless once there is more than one section.

    Sections stay at entranceAnimation "none" on purpose. Animating both the
    section and its rows double-animates every element — the section fades its
    children (the rows) while each row is already sliding its own columns, and
    the two compose into a slower, muddier move than either alone.
    """
    return {"nodeType": "section", "layoutType": "grid", "displayName": name,
            "displaySettings": {"displayTemplate": "OT_LandingSection",
                                "settings": {"gridWidth": width, "verticalSpacing": spacing,
                                             "backgroundColor": bg, "sectionOverlap": "none",
                                             "entranceAnimation": "none"}},
            "component": {"contentType": "BlankSection", "properties": {}},
            "nodes": rows}


def heading(text, color="none"):
    return component("OT_PrimaryTextBlock", "OT_PrimaryTextDefault",
                     {"alignment": "left", "color": color, "size": "headline",
                      "entranceAnimation": "none"},
                     {"headline": {"value": text}})


def card(heading_txt, desc=None, cta=None, image=None, image_style=None,
         density="default", image_side="left", tile="none", icon="none",
         border="subtle"):
    """
    Flat LF treatment: white fill, hairline border, no lift, no glow.

    tile="stacked" -> icon above a centred label (the 8 product tiles)
    tile="inline"  -> icon, label, arrow right (Popularly / Quick links / Contact)
    Both are display-template settings, so they cost no content-type change.

    border="none" for the editorial cards that carry their own image — the photo
    already gives them an edge, so a hairline on top of it reads as a box drawn
    round a picture. The hover treatment stays: with no resting border there is
    nothing to recolour, but the ring is a box-shadow, so it still appears on
    hover and still costs no layout.
    """
    props = {"Heading": {"value": heading_txt}}
    if desc: props["Description"] = {"value": {"html": f"<p>{desc}</p>"}}
    if cta:
        props["ctaLabel"] = {"value": cta}
        props["ctaUrl"] = {"value": "#"}
    if image_style: props["imageStyle"] = {"value": image_style}
    if image:
        # A DAM asset is referenced exactly like CMS media. The graph:// form is
        # rejected; only cms://content/<key> parses.
        props["image"] = {"value": f"cms://content/{image['key']}"}
        props["imageAlt"] = {"value": image["title"]}
    return component("OT_CardBlock", "OT_CardDefault",
                     {"tile": tile, "icon": icon,
                      "fill": "light", "border": border, "imageSide": image_side,
                      "hover": "border", "density": density,
                      "noise": "false", "accentLine": "none"}, props)


def image_block(key, alt, bg="canvas"):
    """Full-width decorative image. No heading/body, so ImageBlock stays 1-column."""
    # Property is `alt`, not `imageAlt`; the display-template keys are bgColor /
    # ratio (not color / aspectRatio). Both were wrong first time and the CMS
    # rejects unknown property names outright.
    return component("OT_ImageBlock", "OT_ImageDefault",
                     {"bgColor": bg, "ratio": "natural", "overlay": "false",
                      "frame": "none", "shadow": "none", "lightbox": "false",
                      "animate": "false", "entranceAnimation": "none"},
                     {"image": {"value": f"cms://content/{key}"},
                      "alt": {"value": alt}})


def hero(image=None):
    props = {"direction": {"value": "editorialSplit"},
             "headline": {"value": "10% discount on car insurance for the first year "
                                   "for new customers online"},
             "primaryCtaLabel": {"value": "Sign up now"},
             "primaryCtaUrl": {"value": "#"}}
    if image:
        props["visual"] = {"value": f"cms://content/{image['key']}"}
        props["visualAlt"] = {"value": image["title"]}
    return component("OT_HeroBlock", "OT_HeroDefault",
                     {"layout": "imageRight", "color": "tint", "animation": "none"}, props)


def tiles(items, per_row, span, tile="inline"):
    """
    Rows of equal columns of link tiles. `items` is a list of (label, icon).
    """
    rows = []
    for i in range(0, len(items), per_row):
        chunk = items[i:i + per_row]
        rows.append(row([
            column([card(label, cta="View", density="compact", tile=tile, icon=icon)], span=span)
            for label, icon in chunk
        ]))
    return rows


def build(photos):
    p = lambda i: photos[i % len(photos)] if photos else None

    # ── the band structure straight from the reference design ────────────────
    #   hero            pale blue
    #   product tiles   white
    #   one continuous grey band: inspection -> Right now -> Popularly -> banking -> Quick links
    #   contact         white
    nodes = []

    # hero — full-bleed tint band, content inset by the shared container
    # width="full": the pale-blue band spans the viewport. HeroBlock insets its own
    # two panels with .ot-container, so the text still lines up with every section
    # below. With the default width the band was boxed to 90rem + px-lg.
    # vpad="none": the hero is the first thing under the header, so any row
    # padding here is empty tint between the two — not a gap between rows.
    nodes.append(section([row([column([hero(p(0))], span="col12")], vpad="none", anim="fade")],
                         "Hero", bg="canvas", spacing="none", width="full"))

    # 8 product tiles, 4 per row
    nodes.append(section(
        tiles([("Home insurance", "shield"), ("Car insurance", "package"),
               ("Illness and accidents", "heart"), ("Child insurance", "users"),
               ("Mortgage", "dollarSign"), ("Become a bank customer", "checkCircle"),
               ("Pension", "trendingUp"), ("Report damage", "wrench")],
              per_row=4, span="col3", tile="stacked"),
        "Product tiles", bg="canvas"))

    # inspection panel — image beside text
    nodes.append(section([row([column([card(
        "Inspection is included in our home insurance",
        desc="To ensure that your home is in good condition both today and for a long time "
             "to come, a damage prevention inspection worth up to SEK 10,000 is included "
             "when you take out our villa or detached home insurance with us.",
        cta="More about inspection", image=p(1), image_style="side",
        density="spacious", image_side="left")], span="col12")])],
        "Inspection", bg="surface"))

    # Right now — heading + 6 cards, 3 per row
    right_now = [
        ("Credit cards with cashback and benefits",
         "Credit card with cashback on online purchases, purchase insurance and extra "
         "travel protection when you pay at least 75% of the trip with the card."),
        ("Talk about mortgages with our private advisors",
         "Get in touch to talk about mortgages. We also provide advice on savings and pensions."),
        ("Car insurance with broad coverage",
         "Stone chip repair is included in both our half and full insurance - you do not "
         "pay any deductible for stone chip repair."),
        ("Prepare your home for extreme weather",
         "Extreme weather events such as heat waves, torrential rain and storms increase "
         "the risk of damage. Here are our best tips."),
        ("Our local community involvement",
         "As a local and customer-owned company, we want to invest in a safer Stockholm."),
        ("Unit-linked insurance company of the year 2025",
         "Named Unit Trust Insurance Company of the Year in Soderberg & Partner's 2025 report."),
    ]
    rn_rows = [row([column([heading("Right now", color="none")], span="col12")])]
    for i in range(0, 6, 3):
        rn_rows.append(row([
            column([card(h, desc=d, cta="Read more", image=p(2 + i + j), image_style="top",
                         border="none")],
                   span="col4")
            for j, (h, d) in enumerate(right_now[i:i + 3])
        ]))
    nodes.append(section(rn_rows, "Right now", bg="surface"))

    # Popularly — heading + 6 compact tiles
    pop_rows = [row([column([heading("Popularly", color="none")], span="col12")])]
    pop_rows += tiles([("Borrow", "dollarSign"), ("Monthly savings", "trendingUp"),
                       ("Move pension", "arrowUpRight"), ("Vehicle insurance", "package"),
                       ("Personal insurance", "shield"), ("Tips & guides", "lightbulb")],
                      per_row=3, span="col4")
    nodes.append(section(pop_rows, "Popularly", bg="surface"))

    # banking banner — text left, image right
    nodes.append(section([row([column([card(
        "Banking and insurance - with all of Stockholm as its home base",
        desc="Lansforsakringar Stockholm is the only banking and insurance company that has "
             "its entire mission in the Stockholm region. This means that we know the city, "
             "the suburbs and the archipelago - and can support you with local knowledge.",
        cta="Benefits of being our customer", image=p(3), image_style="side",
        density="spacious", image_side="right", border="none")], span="col12")])],
        "Banking and insurance", bg="surface"))

    # Quick links — heading + 3 tiles
    ql_rows = [row([column([heading("Quick links", color="none")], span="col12")])]
    ql_rows += tiles([("The app", "monitor"), ("My pages", "userCheck"),
                      ("BankID", "lock")], per_row=3, span="col4")
    nodes.append(section(ql_rows, "Quick links", bg="surface"))

    # Contact us — heading + 4 tiles, 2 per row, on white
    c_rows = [row([column([heading("Contact us", color="none")], span="col12")])]
    c_rows += tiles([("Insurance matters", "none"), ("Banking and pension matters", "none"),
                     ("Claims", "none"), ("Our offices", "none")], per_row=2, span="col6")
    nodes.append(section(c_rows, "Contact us", bg="canvas"))

    # Stockholm skyline, flush between Contact us and the footer.
    #
    # No CMS-media fallback: every asset now lives in DAM, and the old CMS copy
    # has been deleted. Failing loudly here beats publishing a composition with
    # an unresolved reference, which the CMS rejects with a message that points
    # at the property rather than at the missing asset.
    illustration = dam_asset_by_title("skyline")
    if not illustration:
        sys.exit("No DAM asset matching 'skyline' — cannot place the illustration.")
    nodes.append(section(
        [row([column([image_block(illustration,
                                  "Illustration of the Stockholm skyline")], span="col12")],
             anim="fade")],
        "Stockholm illustration", bg="canvas", spacing="small", width="full"))

    return {"nodeType": "experience", "layoutType": "outline", "nodes": nodes}


def describe(comp):
    def walk(n, ind=1):
        for x in n.get("nodes") or []:
            ct = (x.get("component") or {}).get("contentType", "")
            props = (x.get("component") or {}).get("properties") or {}
            lbl = ""
            for k in ("headline", "heading", "Heading"):
                v = props.get(k)
                if isinstance(v, dict) and v.get("value"):
                    lbl = str(v["value"])[:44]; break
            bg = ((x.get("displaySettings") or {}).get("settings") or {}).get("backgroundColor", "")
            name = x.get("displayName") or ""
            print("  " * ind + f"{x['nodeType']:<10} {ct.replace('OT_',''):<18} {bg:<8} {name or lbl}")
            walk(x, ind + 1)
    walk(comp)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    photos = dam_photos()
    print(f"DAM photos: {len(photos)}")
    comp = build(photos)

    sections = sum(1 for n in comp["nodes"] if n["nodeType"] == "section")
    def count(n, t):
        c = 1 if n.get("nodeType") == t else 0
        for x in n.get("nodes") or []: c += count(x, t)
        return c
    print(f"sections: {sections}  blocks: {count(comp,'component')}  "
          f"size: {len(json.dumps(comp)):,} bytes\n")
    describe(comp)

    if args.dry_run:
        print("\n(dry run — nothing written)")
        return

    tok = cms_token()
    H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    s, _, vs = _req(f"{CMS}/v1/content/{HOME_KEY}/versions", None, "GET", {"Authorization": f"Bearer {tok}"})
    # NOTE: /versions is NOT sorted — never take items[-1]. Filter on status.
    cur = [v for v in vs["items"] if v["status"] == "published"][0]

    s, h, b = _req(f"{CMS}/v1/content/{HOME_KEY}/versions",
                   json.dumps({"displayName": cur["displayName"], "locale": cur.get("locale", "en"),
                               "routeSegment": cur.get("routeSegment"), "composition": comp}).encode(),
                   "POST", H)
    if s != 201:
        print(f"\ncreate version failed {s}")
        print(json.dumps(b, indent=2)[:3000] if isinstance(b, (dict, list)) else b)
        sys.exit(1)
    nv = h.get("location", "").rstrip("/").split("/")[-1]
    s, _, b = _req(f"{CMS}/v1/content/{HOME_KEY}/versions/{nv}:publish", b"{}", "POST", H)
    if s not in (200, 204):
        print(f"\npublish failed {s} {b}"); sys.exit(1)
    print(f"\nPUBLISHED v{nv}")
    print("Graph indexing lags a few minutes — Visual Builder 404s until it catches up.")


if __name__ == "__main__":
    main()
