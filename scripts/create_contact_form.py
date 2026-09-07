#!/usr/bin/env python3
"""
Create a real Optimizely Forms contact form (OptiFormsContainerData) on lans01saas,
mirroring the field set of the code-based OT_ContactForm on the (not-yet-built) /contact
page: Name, Email, Subject, Message, Consent, Submit.

Two-step, matching Optimizely.md's documented shape:
  1. POST /v1/content  -> create the form container itself (contentType:
     OptiFormsContainerData), composition: step -> row -> column -> component (inline).
  2. Publish it, then POST /v1/content again to create a demo BlankExperience page that
     REFERENCES the form via a bare component node (the CMS rejects inline embedding of
     a layoutType:'form' section).

Run:  python3 create_contact_form.py --dry-run   (prints payloads, no writes)
      python3 create_contact_form.py              (writes + publishes)

── Verified against the live instance (2026-09-07) ──────────────────────────
Two things this file's shape depends on, established by probing errors rather
than assumed:
  - A content item's OWN composition root is nodeType 'section' (NOT
    'composition', despite the FORM_QUERY reading it back as an unnamed
    `composition { ... }` field in cms/components/OptiFormsContainerData.tsx).
  - OptiFormsChoiceElement.Options wants `{ "Label": ..., "Value": ... }`
    per option (capitalized) on write; it reads back lowercased
    (`{ "label": ..., "value": ... }`), which is what
    cms/forms/options.ts::parseOptions expects.

Already run once on lans01saas:
  form key: d41bfb2506f6e6513e1dfe515279cd9d
  page key: 99d4e9251838dd7fb92c93ceb303f3d4  (routeSegment: forms-demo-contact)
Running this script again creates a SECOND form + page (new random keys) —
it does not check for an existing one first.

Still needs a human, in the CMS UI, before the form actually works:
  1. Open the form once and Save — a REST-created form has a null SubmitUrl,
     and opening+saving in the UI is what mints one (Optimizely.md, "A form
     created over REST has a null SubmitUrl").
  2. Set that Submit URL property to an External link:
     <site origin>/api/form-submit
  3. Set Required (and the email pattern on the Email field) via the
     Validators UI — writes to Validators over REST are dropped or
     rejected (see Optimizely.md, "What REST would not do").
"""
import argparse, json, os, pathlib, secrets, sys, urllib.error, urllib.request

def _load_env(path=".env.local"):
    here = pathlib.Path(__file__).resolve().parent
    for base in (here, here.parent, pathlib.Path.cwd()):
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
ROOT = "43f936c99b234ea397b261c538ad07c9"  # same top-level parent used by build_lf_chrome.py / lf_product_page.py
UA = "lf-forms-contact/1.0"

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
        try: p = json.loads(b)
        except Exception: p = b.decode(errors="replace")
        return e.code, {k.lower(): v for k, v in e.headers.items()}, p

def cms_token():
    d = (f"grant_type=client_credentials&client_id={_need('OPTIMIZELY_CMS_CLIENT_ID')}"
         f"&client_secret={_need('OPTIMIZELY_CMS_CLIENT_SECRET')}").encode()
    s, _, b = _req(f"{CMS}/oauth/token", d, "POST", {"Content-Type": "application/x-www-form-urlencoded"})
    if s != 200: sys.exit(f"CMS token failed: {s} {b}")
    return b["access_token"]

def new_key():
    return secrets.token_hex(16)  # 32 hex, no dashes

def dashed(key32):
    return f"{key32[0:8]}-{key32[8:12]}-{key32[12:16]}-{key32[16:20]}-{key32[20:32]}"

# ── Form elements (inline component nodes) ──────────────────────────────────
def el(content_type, props):
    return {"nodeType": "component", "component": {"contentType": content_type, "properties": props}}

def column(nodes):
    return {"nodeType": "column", "nodes": nodes}

def row(cols):
    return {"nodeType": "row", "nodes": cols}

def step(nodes, name):
    return {"nodeType": "step", "displayName": name, "nodes": nodes}

ELEMENTS = [
    el("OptiFormsTextboxElement", {
        "Label": {"value": "Your name"},
        "SubmissionFieldName": {"value": "Name"},
    }),
    el("OptiFormsTextboxElement", {
        "Label": {"value": "Email address"},
        "SubmissionFieldName": {"value": "Email"},
        "AutoComplete": {"value": "email"},
    }),
    el("OptiFormsTextboxElement", {
        "Label": {"value": "Subject"},
        "SubmissionFieldName": {"value": "Subject"},
    }),
    el("OptiFormsTextareaElement", {
        "Label": {"value": "How can we help?"},
        "SubmissionFieldName": {"value": "Message"},
    }),
    el("OptiFormsChoiceElement", {
        "Label": {"value": "Consent"},
        "SubmissionFieldName": {"value": "Consent"},
        "Options": {"value": [{"Label": "I agree that Länsförsäkringar Stockholm may use my details to answer this enquiry.", "Value": "agree"}]},
        "AllowMultiSelect": {"value": True},
    }),
    el("OptiFormsSubmitElement", {
        "Label": {"value": "Send message"},
    }),
]

FORM_COMPOSITION = {
    "nodeType": "section",
    "layoutType": "form",
    "nodes": [
        step([row([column(ELEMENTS)])], "Contact details"),
    ],
}

FORM_PROPERTIES = {
    "Title": {"value": "Send us a message"},
    "Description": {"value": "Fields marked with a label are required. We use your details only to answer this enquiry."},
    "SubmitConfirmationMessage": {"value": "Thank you — your message has been received. We will be in touch within two working days."},
    "ShowSummaryMessageAfterSubmission": {"value": True},
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    form_key = new_key()
    form_payload = {
        "key": form_key,
        "contentType": "OptiFormsContainerData",
        "container": ROOT,
        "initialVersion": {
            "displayName": "LF contact form",
            "locale": "en",
            "properties": FORM_PROPERTIES,
            "composition": FORM_COMPOSITION,
        },
    }

    page_key = new_key()
    page_payload = {
        "key": page_key,
        "contentType": "BlankExperience",
        "container": ROOT,
        "initialVersion": {
            "displayName": "Contact form (Forms demo)",
            "routeSegment": "forms-demo-contact",
            "locale": "en",
            "composition": {
                "nodeType": "experience",
                "layoutType": "outline",
                "nodes": [
                    {
                        "nodeType": "component",
                        "id": dashed(form_key),
                        "displayName": "LF contact form",
                        "layoutType": "form",
                        "displaySettings": {
                            "displayTemplate": "OT_LandingSection",
                            "settings": {
                                "gridWidth": "narrow", "verticalSpacing": "medium",
                                "backgroundColor": "canvas", "sectionOverlap": "none",
                                "entranceAnimation": "none",
                            },
                        },
                        "component": {"contentType": "OptiFormsContainerData"},
                    },
                ],
            },
        },
    }

    if args.dry_run:
        print("FORM:", json.dumps(form_payload, indent=2))
        print("PAGE:", json.dumps(page_payload, indent=2))
        return

    tok = cms_token()
    H = {"Authorization": f"Bearer {tok}", "Content-Type": "application/json"}

    print("Creating form container...")
    s, _, b = _req(f"{CMS}/v1/content", json.dumps(form_payload).encode(), "POST", H)
    print("  ->", s, str(b)[:500])
    if s not in (200, 201):
        sys.exit("Aborting: form container creation failed.")

    s, hdrs, b = _req(f"{CMS}/v1/content/{form_key}/versions", None, "GET", H)
    items = b.get("items", []) if isinstance(b, dict) else (b if isinstance(b, list) else [])
    versions = [v for v in items if str(v.get("status", "")).lower() == "draft"]
    if not versions:
        sys.exit(f"No draft version found for form: {b}")
    v = versions[0]["version"]
    print(f"  draft version: {v}")

    print("Publishing form container...")
    s, _, b = _req(f"{CMS}/v1/content/{form_key}/versions/{v}:publish", b"{}", "POST", H)
    print("  ->", s, str(b)[:300])

    print("Creating demo page referencing the form...")
    s, _, b = _req(f"{CMS}/v1/content", json.dumps(page_payload).encode(), "POST", H)
    print("  ->", s, str(b)[:500])
    if s not in (200, 201):
        sys.exit("Aborting: demo page creation failed.")

    s, hdrs, b = _req(f"{CMS}/v1/content/{page_key}/versions", None, "GET", H)
    items = b.get("items", []) if isinstance(b, dict) else (b if isinstance(b, list) else [])
    versions = [v for v in items if str(v.get("status", "")).lower() == "draft"]
    v = versions[0]["version"]
    print("Publishing demo page...")
    s, _, b = _req(f"{CMS}/v1/content/{page_key}/versions/{v}:publish", b"{}", "POST", H)
    print("  ->", s, str(b)[:300])

    print()
    print(f"Form key:  {form_key}  (dashed: {dashed(form_key)})")
    print(f"Page key:  {page_key}")
    print("Route:     /forms-demo-contact  (once Graph re-indexes)")

if __name__ == "__main__":
    main()
