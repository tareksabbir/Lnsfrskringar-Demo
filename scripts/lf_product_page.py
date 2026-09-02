#!/usr/bin/env python3
"""
Build a LF product detail page as a Visual-Builder-editable experience.

Products live under a "Product" folder in the content tree, one experience each:

    Root
      Product/                 OT_FolderPage      routeSegment "product"
        Home insurance/        BlankExperience    routeSegment "home-insurance"
        ...one per product

The composition uses the same nesting as the home page, for the same reason —
Visual Builder's Outline lists SECTIONS, so a block only becomes selectable if it
sits inside one:

    experience (outline) -> section (grid) -> row -> column -> component

USAGE
    python3 scripts/lf_product_page.py --product home-insurance [--dry-run]

Add a product by writing a PRODUCTS entry and running the script again. The page
shape is shared; only the copy differs.

TWO CONSTRAINTS THAT SHAPE THIS FILE
  1. Every array-based block in this repo is unplaceable. OT_AccordionBlock,
     OT_FeatureGridBlock, OT_StatBlock, OT_TabsBlock, OT_ComparisonTableBlock,
     OT_DisclosureBlock and OT_TrustRail all carry an array-of-component
     property, and:
       - a column accepts only `elementEnabled` components;
       - `elementEnabled` cannot be granted to them — "The property 'items' is
         not allowed when content type has ElementEnabled";
       - and a section's component must have baseType `_section`, so offering a
         `_component` there fails with "The component type is not based on
         section base type."
     There is no legal position for any of them. The FAQ is therefore built from
     native <details>/<summary> in a rich text block (see faq_section), which
     also lifts the accordion block's silent 12-item cap.
  2. No block renders a tick list. OT_HeroBlock.body is a plain 300-char string,
     and rich-text `ul` is hard-set to disc. The hero is therefore composed by
     hand from PrimaryText + Button + Image rather than using OT_HeroBlock, and
     the ticks are literal characters in the rich text.
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
    if not v:
        sys.exit(f"Missing {n}. Set it in .env.local at the repo root.")
    return v


CMS           = "https://api.cms.optimizely.com"
CMP           = "https://api.cmp.optimizely.com"
CMP_TOKEN_URL = "https://accounts.cmp.optimizely.com/o/oauth2/v1/token"
ROOT          = "43f936c99b234ea397b261c538ad07c9"
UA            = "lf-product-page/1.0"


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
    s, _, b = _req(f"{CMS}/oauth/token", d, "POST",
                   {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200:
        sys.exit(f"CMS token failed: {s} {b}")
    return b["access_token"]


def dam_photos():
    """Every non-logo raster asset in DAM, so pages can draw placeholder imagery."""
    d = (f"grant_type=client_credentials&client_id={_need('CMP_CLIENT_ID')}"
         f"&client_secret={_need('CMP_CLIENT_SECRET')}").encode()
    s, _, b = _req(CMP_TOKEN_URL, d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200:
        sys.exit(f"CMP token failed: {s}")
    s, _, b = _req(f"{CMP}/v3/assets", headers={"Authorization": f"Bearer {b['access_token']}"})
    if s != 200:
        sys.exit(f"DAM list failed: {s}")
    out = []
    for a in b.get("data", []):
        mime = a.get("mime_type") or ""
        if mime.startswith("image/") and mime != "image/svg+xml" \
           and "logo" not in (a.get("title") or "").lower():
            out.append({"key": a["id"], "title": a.get("title") or ""})
    return out


def dam_asset_by_title(fragment, exclude=("logo",)):
    d = (f"grant_type=client_credentials&client_id={_need('CMP_CLIENT_ID')}"
         f"&client_secret={_need('CMP_CLIENT_SECRET')}").encode()
    s, _, b = _req(CMP_TOKEN_URL, d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200:
        return None
    s, _, b = _req(f"{CMP}/v3/assets", headers={"Authorization": f"Bearer {b['access_token']}"})
    if s != 200:
        return None
    for a in b.get("data", []):
        t = (a.get("title") or "").lower()
        if fragment.lower() in t and not any(x in t for x in exclude):
            return a["id"]
    return None


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


def row(columns, gap="medium", vpad="small", anim="slide", align="stretch"):
    return {"nodeType": "row",
            "displaySettings": {"displayTemplate": "OT_LandingRow",
                                # The stagger belongs on the row: [data-stagger]
                                # animates a node's CHILDREN, and a row's children
                                # are its columns.
                                "settings": {"showAsRowFrom": "lg", "contentSpacing": gap,
                                             "verticalPadding": vpad, "alignItems": align,
                                             "entranceAnimation": anim}},
            "nodes": columns}


def section(rows, name, bg="canvas", spacing="medium", width="default"):
    """A normal section: BlankSection wrapper holding rows of columns."""
    return {"nodeType": "section", "layoutType": "grid", "displayName": name,
            "displaySettings": {"displayTemplate": "OT_LandingSection",
                                "settings": {"gridWidth": width, "verticalSpacing": spacing,
                                             "backgroundColor": bg, "sectionOverlap": "none",
                                             "entranceAnimation": "none"}},
            "component": {"contentType": "BlankSection", "properties": {}},
            "nodes": rows}


# ── Block helpers ────────────────────────────────────────────────────────────

def rich(html, size="editorial", color="none", treatment="standard"):
    return component("OT_RichTextBlock", "OT_RichTextDefault",
                     {"color": color, "alignment": "left", "size": size,
                      "treatment": treatment},
                     {"content": {"value": {"html": html}}})


def primary_text(headline, body_html=None, size="headline", color="none", level="h2"):
    props = {"headline": {"value": headline}, "headingLevel": {"value": level},
             "headerEffect": {"value": "none"}}
    if body_html:
        props["body"] = {"value": {"html": body_html}}
    return component("OT_PrimaryTextBlock", "OT_PrimaryTextDefault",
                     {"alignment": "left", "color": color, "size": size,
                      "entranceAnimation": "none"},
                     props)


def button(label, url="#", variant="brand", size="md", align="left"):
    return component("OT_ButtonBlock", "OT_ButtonDefault",
                     {"size": size, "icon": "none", "iconPosition": "trailing",
                      "alignment": align, "fullWidth": "false"},
                     {"variant": {"value": variant}, "label": {"value": label},
                      "url": {"value": url}})


def image(asset, alt, ratio="natural", bg="canvas"):
    return component("OT_ImageBlock", "OT_ImageDefault",
                     {"bgColor": bg, "ratio": ratio, "overlay": "false", "frame": "none",
                      "animate": "false", "captionPosition": "below", "shadow": "false",
                      "lightbox": "false", "entranceAnimation": "none"},
                     {"image": {"value": f"cms://content/{asset}"},
                      "alt": {"value": alt}})


def card(heading, desc=None, cta=None, img=None, eyebrow=None,
         image_style="top", border="subtle", hover="border",
         density="default", image_side="left", fill="light"):
    props = {"Heading": {"value": heading}}
    if eyebrow: props["Eyebrow"] = {"value": eyebrow}
    if desc:    props["Description"] = {"value": {"html": f"<p>{desc}</p>"}}
    if cta:
        props["ctaLabel"] = {"value": cta}
        props["ctaUrl"]   = {"value": "#"}
    if image_style: props["imageStyle"] = {"value": image_style}
    if img:
        props["image"]    = {"value": f"cms://content/{img['key']}"}
        props["imageAlt"] = {"value": img["title"]}
    return component("OT_CardBlock", "OT_CardDefault",
                     {"tile": "none", "icon": "none", "fill": fill, "border": border,
                      "imageSide": image_side, "hover": hover, "density": density,
                      "noise": "false", "accentLine": "none",
                      "imageAspectRatio": "landscape"},
                     props)


def callout(heading, body=None, cta=None, intent="info", variant="filled",
            size="default", icon="none"):
    props = {"intent": {"value": intent}, "heading": {"value": heading}}
    if body: props["body"] = {"value": body}
    if cta:
        props["ctaLabel"] = {"value": cta}
        props["ctaUrl"]   = {"value": "#"}
    return component("OT_CalloutBlock", "OT_CalloutDefault",
                     {"variant": variant, "size": size, "alignment": "left",
                      "dismissible": "off", "sticky": "off", "icon": icon,
                      "entranceAnimation": "none", "maxWidth": "full"},
                     props)


def faq_section(headline, qa_pairs, name, bg="surface"):
    """
    FAQ as native <details>/<summary> inside a rich text block.

    NOT OT_AccordionBlock. That block cannot be placed in a composition on this
    instance at all, and the reason is worth recording because it applies to
    every array-based block here (FeatureGrid, StatBlock, Tabs, ComparisonTable,
    Disclosure, TrustRail):

      - a section node's component must have baseType `_section`; offering a
        `_component` is refused with "The component type is not based on section
        base type."
      - a column only accepts `elementEnabled`;
      - and `elementEnabled` cannot be granted to it, because the CMS rejects
        "The property 'items' is not allowed when content type has
        ElementEnabled." Its `items` array is exactly what makes it an accordion.

    So it has no legal position. Rich text does the job with no JS, and the
    browser supplies open/close, keyboard operation and the accessible name.
    There is also no 12-item cap here, which the block silently imposed.
    """
    rows = "".join(
        f"<details><summary>{q}</summary><p>{a}</p></details>" for q, a in qa_pairs
    )
    # The .ot-faq wrapper carries the card treatment (see globals.css). `class`
    # is on the sanitiser's attribute allowlist, which is what lets a rich text
    # block adopt a named pattern instead of being generic prose.
    #
    # colour "none" on the block: the card supplies its own ground, so a block
    # background would sit behind it as a second, slightly larger panel.
    # `narrow` centres the card rather than letting it run the full width, which
    # is what made the first version read as a wall of text rather than a list.
    return section([row([column([
        rich(f'<div class="ot-faq"><h2>{headline}</h2>{rows}</div>', color="none")],
        span="col12")], anim="fade")],
        name, bg=bg, spacing="large", width="narrow")


# ── Page content ─────────────────────────────────────────────────────────────

def home_insurance(photos, skyline):
    p = lambda i: photos[i % len(photos)] if photos else None
    nodes = []

    # Breadcrumb. No breadcrumb block exists in this repo, so it is a small rich
    # text line rather than semantic nav — flagged rather than faked silently.
    nodes.append(section([row([column([
        rich('<p><a href="#">Private</a> / <a href="#">Insurance</a> / '
             '<span>All home insurance</span></p>', size="compact")], span="col12")],
        vpad="none", anim="fade")],
        "Breadcrumb", bg="canvas", spacing="none"))

    # Hero. Composed by hand instead of OT_HeroBlock: the tick lines need rich
    # text, and HeroBlock.body is a plain 300-char string.
    nodes.append(section([row([
        column([
            primary_text("Home insurance",
                         "<p>Home insurance gives you financial security by covering costs "
                         "in the event of, for example, burglary, fire or water damage.</p>"
                         "<ul>"
                         "<li>✓ Applies to your home, your belongings and yourself</li>"
                         "<li>✓ 10 percent web discount the first year</li>"
                         "<li>✓ Combine with <a href='#'>car alarm</a> and get a 15 percent discount</li>"
                         "</ul>",
                         # `headline`, not `display`. The landing hero renders at
                         # --ot-text-hero; PrimaryText has no hero tier, and
                         # `display` overshot it badly.
                         size="headline"),
            button("Get an offer"),
        ], span="col6"),
        # r16_9 stated explicitly. `auto` resolved to the same box — it is absent
        # from RATIO_MAP in cms/styling, so it fell through to undefined and
        # ImageBlock's 16:9 default — but naming it means the height is chosen
        # rather than inherited from a lookup miss.
        column([image(p(0)["key"], "Home insurance illustration", ratio="r16_9")], span="col6"),
    ], anim="fade", align="center")],
        "Hero", bg="canvas", spacing="medium"))

    # Inspection strip — the small highlight card under the hero.
    nodes.append(section([row([column([
        card("Inspection is included in our home insurance",
             desc="Take out home insurance with us — damage prevention inspection worth up "
                  "to SEK 10,000 is included.",
             img=p(1), image_style="side", density="compact",
             border="none", hover="none", fill="surface")], span="col12")],
        anim="fade")],
        "Inspection strip", bg="canvas", spacing="small"))

    # "What home insurance do you need?" — 6 cards, 3 per row.
    variants = [
        ("Home insurance",
         "Villa insurance covers the regular home insurance, but also covers the house itself "
         "and the plot of land it stands on."),
        ("Homeowners' insurance",
         "Home insurance for those who own their home. It covers fixed furnishings, glass and "
         "other things for which you are responsible."),
        ("Tenancy insurance",
         "Insurance for those who rent their home. Protects your home, yourself and your "
         "belongings when the unexpected happens."),
        ("Holiday home insurance",
         "Insure your cottage or country house. The insurance covers damage, theft and "
         "accidents all year round."),
        ("Farm insurance",
         "For those who run small-scale farming or horse farming operations, and forestry in "
         "their own forest."),
        ("Student insurance",
         "Home insurance for those of you who study at university, college or folk high school "
         "and rent or own your home."),
    ]
    v_rows = [row([column([primary_text("What home insurance do you need?")], span="col12")],
                  vpad="none", anim="fade")]
    for i in range(0, 6, 3):
        v_rows.append(row([
            column([card(h, desc=d, cta="Read more", img=p(2 + i + j))], span="col4")
            for j, (h, d) in enumerate(variants[i:i + 3])
        ]))
    nodes.append(section(v_rows, "Insurance variants", bg="canvas"))

    # Pale-blue info panel.
    nodes.append(section([row([column([
        # heading caps at 100 chars and body at 200, so the sentence goes in the
        # body with a short label above it.
        callout("Affordable home insurance for tenants",
                body="Through a collaboration between Hyresgästföreningen and "
                     "Länsförsäkringar Stockholm, you who live in a housing area are "
                     "offered affordable home insurance.",
                cta="Trygg home insurance", intent="info", size="compact")], span="col12")],
        anim="fade")],
        "Housing collaboration", bg="canvas", spacing="small"))

    # Long-form editorial body. One rich text block per heading so each is its own
    # selectable node in Visual Builder rather than one unmanageable slab.
    body = [
        ("What is home insurance?",
         "<p>Home insurance provides financial compensation if your home or belongings are "
         "damaged, for example by fire, burglary or water damage. It also includes personal "
         "protection that can help you in certain situations, for example if you are liable "
         "for damages, are assaulted or are the subject of a crime while travelling. If you "
         "want compensation when you yourself are injured in an accident, you need "
         "<a href='#'>accident insurance</a>.</p>"),
        ("What is included in home insurance?",
         "<p>All of our home insurance policies include:</p>"
         "<ul>"
         "<li><strong>Property protection</strong> that can provide compensation if something "
         "happens to you, your house or your belongings, for example if there is a water "
         "damage or a burglary.</li>"
         "<li><strong>Travel protection for 45 days</strong> that can provide compensation if "
         "you are robbed, become seriously ill or have an accident while travelling.</li>"
         "<li><strong>Assault protection</strong> that can provide compensation if you are "
         "subjected to assault or certain sexual crimes.</li>"
         "<li><strong>Legal protection</strong> that can provide compensation if you end up in "
         "litigation and need to hire a lawyer.</li>"
         "<li><strong>Liability coverage</strong> that can provide compensation if you are "
         "sued for damages.</li>"
         "<li><strong>ID protection</strong> provides advice and assistance if you are a "
         "victim of <a href='#'>identity theft</a>.</li>"
         "</ul>"
         "<p>We offer several types of home insurance depending on your living situation. In "
         "addition to protection for your belongings alone, home insurance includes insurance "
         "coverage for your home and buildings.</p>"),
        ("Do you have to have home insurance?",
         "<p>There is no law that requires you to have home insurance, but it is highly "
         "recommended, regardless of how you live. A landlord may require you to have home "
         "insurance for your rental property, and the bank may require that your residence is "
         "insured in cases where you have <a href='#'>a home loan</a>.</p>"
         "<p>You need home insurance to receive compensation in the event of, for example, "
         "fire or water damage. If you are covered through neighbours, you can hire or "
         "smaller damage that affects other people's apartments or properties, you may be "
         "liable for compensation. The liability coverage in the home insurance covers this.</p>"),
        ("Calculate your home insurance price",
         "<p>Fill in information about yourself and your home to calculate how much the "
         "insurance costs. You will immediately receive an individual price quote based on "
         "where you live in your property, condominium or villa and can adjust deductibles "
         "and take additional charges. You are not obligated to buy and can sign up when "
         "everything looks right.</p>"),
        ("How much does home insurance cost?",
         "<p>The price of home insurance is calculated individually and is based on several "
         "factors:</p>"
         "<ul>"
         "<li>Your type of accommodation, for example rental property, condominium or villa</li>"
         "<li>Size of the home</li>"
         "<li>Where the home is located</li>"
         "<li>Which deductible you choose</li>"
         "<li>What insurance amount you choose</li>"
         "<li>Any additional insurance</li>"
         "</ul>"
         "<p>It is therefore not possible to specify a price that applies to everyone. "
         "Calculate your price directly with <a href='#'>a deductible</a> to see what home "
         "insurance costs for you. The price proposal takes into account any discounts and "
         "you are not obligated to take out insurance.</p>"),
        ("Deductible",
         "<p>You choose the deductible yourself when you take out home insurance. A higher "
         "deductible usually results in a slightly lower one, since your premium. Read more "
         "about <a href='#'>the deductible here</a>.</p>"),
    ]
    body_rows = []
    for heading, html in body:
        body_rows.append(row([column([primary_text(heading, html)], span="col12")],
                             vpad="small", anim="fade"))
    nodes.append(section(body_rows, "About home insurance", bg="canvas"))

    # Supplementary insurances — a heading and two plain links.
    nodes.append(section([row([column([
        rich("<h2>Supplementary insurances</h2>"
             "<ul><li><a href='#'>All-risk (drulle)</a></li>"
             "<li><a href='#'>Extended travel protection</a></li></ul>")], span="col12")],
        anim="fade")],
        "Supplementary insurances", bg="canvas", spacing="small"))

    # Report-damage panel — the warm/red attention block.
    nodes.append(section([row([column([
        callout("Do you need to report damage?",
                body="Have you had water damage, been burgled or had something else happen "
                     "that you need to report to us? You can easily do so here.",
                cta="Report damage", intent="danger", icon="shield")], span="col12")],
        anim="fade")],
        "Report damage", bg="canvas", spacing="small"))

    nodes.append(section([row([column([
        primary_text("If something happens to your things",
                     "<p>All of your belongings that you have in your home that are movable, "
                     "such as your TV, furniture, art and personal items, are called "
                     "<a href='#'>movable property</a>. In disaster victims and accidents, "
                     "broken items, it is important that you have receipts of how much your "
                     "belongings are worth. The amount should correspond to everything in the "
                     "home. Do not forget to check from time to time that the amount you have "
                     "entered is correct, or to update it if you have bought new things or "
                     "become a parent.</p>")], span="col12")], anim="fade")],
        "If something happens", bg="canvas", spacing="small"))

    # FAQ — see faq_section for why this is rich text rather than the accordion
    # block. All 15 questions from the design fit; nothing is dropped.
    nodes.append(faq_section(
        "Frequently asked questions and answers about home insurance",
        [("What is included in home insurance?",
          "Home insurance includes property protection, travel protection for 45 days, "
          "assault protection, legal protection, liability coverage and ID protection."),
         ("Who does home insurance apply to?",
          "It applies to you and everyone registered at your address, and to your belongings."),
         ("How much does home insurance cost per month?",
          "The price is set individually from your type of home, its size, where you live, "
          "your deductible and the insurance amount you choose."),
         ("What happens if I don't have home insurance?",
          "You pay for any damage yourself, and you may be liable for damage you cause to "
          "other people's property."),
         ("What is included in the property protection for home insurance?",
          "Compensation if something happens to your home or belongings — for example water "
          "damage, fire or burglary."),
         ("What is the difference between home insurance and homeowners' insurance?",
          "Home insurance covers your belongings; homeowners' insurance also covers the "
          "building itself and the plot it stands on."),
         ("How does home insurance apply when subletting?",
          "Tell us before you sublet. Your insurance may need to be adjusted depending on "
          "how long and to whom you sublet."),
         ("Is travel coverage included in home insurance?",
          "Yes — travel protection for the first 45 days of a trip is included."),
         ("Is cancellation protection included in home insurance?",
          "Cancellation protection is an add-on rather than part of the base cover."),
         ("Is legal protection included in home insurance?",
          "Yes. It can provide compensation if you end up in litigation and need a lawyer."),
         ("How much is the deductible on home insurance?",
          "You choose it yourself when you take out the insurance. A higher deductible "
          "usually lowers the premium."),
         ("Does home insurance cover damage to my mobile phone?",
          "A phone is movable property, so it is covered — all-risk cover extends what is "
          "included."),
         ("Can home insurance help me if I need to change the locks if I have lost my keys?",
          "Yes. Lock replacement is covered when your keys have been lost or stolen in a way "
          "that puts your home at risk."),
         ("When can I change my home insurance?",
          "You can switch at the end of your current insurance period, or immediately if your "
          "living situation changes."),
         ("How does home insurance work when moving?",
          "Tell us your new address before you move. Both homes are covered during the "
          "overlap so nothing is left unprotected.")],
        "FAQ"))

    # Three article teasers.
    articles = [
        ("HOUSING", "How to succeed with your renovation",
         "Are you planning to renovate? Here are our best tips for those who are planning "
         "to build or remodel."),
        ("MOVING", "Is the moving truck leaving soon?",
         "Here is what you need to know for a smooth move — so you have the right protection "
         "for you and your new home from day one."),
        ("TRAVEL", "Are you going out and travelling?",
         "Travel insurance is included in your home insurance and covers trips up to 45 days. "
         "Do you need to extend your coverage for longer trips, choose to travel abroad?"),
    ]
    nodes.append(section([row([
        column([card(t, desc=d, eyebrow=e, cta="Read more", img=p(4 + i),
                     border="none", hover="none")], span="col4")
        for i, (e, t, d) in enumerate(articles)
    ], anim="slide")], "Articles", bg="canvas"))

    # Skyline, flush above the footer — same treatment as the home page.
    nodes.append(section([row([column([
        image(skyline, "Illustration of the Stockholm skyline")], span="col12")],
        vpad="none", anim="fade")],
        "Stockholm illustration", bg="canvas", spacing="small", width="full"))

    return {"nodeType": "experience", "layoutType": "outline", "nodes": nodes}


# Content keys are stable CMS identifiers, so they live here rather than in a
# scratch file — an earlier version read them from /tmp and stopped working the
# moment the shell was recycled.
PRODUCT_FOLDER = "4866d4dfda774334a222e0539e731025"   # Root > Product

PRODUCTS = {
    "home-insurance": {
        "key":     "e7312340564e47d990bb7d24618729cd",
        "display": "Home insurance",
        "build":   home_insurance,
    },
}


# ── Describe / publish ───────────────────────────────────────────────────────

def describe(comp):
    for sec in comp["nodes"]:
        ct = (sec.get("component") or {}).get("contentType", "?")
        print(f"  section  {ct:<20} {sec.get('displayName')}")
        for r in sec.get("nodes") or []:
            print(f"    row")
            for c in r.get("nodes") or []:
                for n in c.get("nodes") or []:
                    cc = (n.get("component") or {}).get("contentType", "?")
                    props = (n.get("component") or {}).get("properties", {})
                    label = ""
                    for k in ("headline", "Heading", "heading", "label", "alt"):
                        if k in props:
                            label = str(props[k].get("value", ""))[:44]
                            break
                    print(f"      component  {cc:<22} {label}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", default="home-insurance", choices=sorted(PRODUCTS))
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    spec = PRODUCTS[args.product]
    key = spec["key"]

    photos  = dam_photos()
    skyline = dam_asset_by_title("skyline")
    if not skyline:
        sys.exit("No DAM asset matching 'skyline'.")
    if not photos:
        sys.exit("No usable DAM photos.")
    print(f"{len(photos)} DAM photos available\n")

    comp = spec["build"](photos, skyline)
    describe(comp)

    if args.dry_run:
        print("\n(dry run — nothing written)")
        return

    tok = cms_token()
    H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}
    s, _, vs = _req(f"{CMS}/v1/content/{key}/versions?pageSize=100", None, "GET", H)
    if s != 200:
        sys.exit(f"versions failed: {s} {vs}")
    # The list is NOT sorted — filter on status rather than taking the last item.
    pub = [v for v in vs["items"] if v.get("status") == "published"]
    cur = max(pub or vs["items"], key=lambda x: int(x["version"]))

    # `composition` is a TOP-LEVEL field on the version, a sibling of
    # `properties` — not a property. Nesting it under properties is rejected with
    # "The field 'nodeType' does not exist on type 'PropertyData'".
    #
    # POST /versions builds the version from the payload ALONE: anything omitted
    # is blanked. Re-post the whole property set every time.
    payload = {"locale": cur.get("locale", "en"),
               "displayName": cur.get("displayName") or spec["display"],
               "routeSegment": cur.get("routeSegment"),
               "properties": dict(cur.get("properties") or {}),
               "composition": comp}
    s, h, b = _req(f"{CMS}/v1/content/{key}/versions", json.dumps(payload).encode(), "POST", H)
    if s not in (200, 201):
        sys.exit(f"create version failed: {s}\n{json.dumps(b, indent=2)[:2000]}")
    nv = h.get("location", "").rstrip("/").split("/")[-1]
    s2, _, b2 = _req(f"{CMS}/v1/content/{key}/versions/{nv}:publish", b"{}", "POST", H)
    if s2 not in (200, 204):
        sys.exit(f"publish failed: {s2} {b2}")
    print(f"\nPUBLISHED v{nv}  —  /product/{args.product}")
    print("Graph indexing lags a few minutes.")


if __name__ == "__main__":
    main()
