# Opal skill — "LF Stockholm blog articles"

Opal keeps writing blog pages with its own built-in CMS tools instead of this
site's `create_blog_article`. A skill is the mechanism Optimizely provides for
that: reusable instructions Opal applies at runtime, scoped to a product and an
instance.

Create it at **Optimizely → Opal → Context → Skills → Create**, as an
**Organization** skill so it applies to everyone, not just one person.

---

## Field values

| Field | Value |
| --- | --- |
| **Name** | LF Stockholm blog articles |
| **Active** | On |
| **Shortcut** | `lf-blog` |
| **Who is this skill for?** | Organization |
| **Activation Trigger** | Keyword and intent matching |
| **Where to use** | Content Management System — `lans01saas: Production1` |

`Where to use` is the field that answers "only on our instance". Set it and the
skill stays out of the way everywhere else.

---

## Core Skill

Paste everything between the rules into the **Core Skill** box.

---

Use this skill whenever someone asks for a blog article, guide, tips page or
editorial post to be written for the Länsförsäkringar Stockholm site.

**Which tool to use**

Write the article with `create_blog_article` from the "LF site — blog" tool
registry. Do not use any built-in CMS, content, page or media tool to create a
blog article on this site, and do not create the page by any other route. Those
tools put the page outside the Blog folder, in a shape the site cannot render.

If `create_blog_article` is not available, stop and say so plainly. Do not
substitute another tool and do not write the article as chat text instead. An
unavailable tool means the tool registry needs attention, and saying so is more
useful than producing something that has to be thrown away.

**Images**

Call `list_dam_images` first and choose from what it returns. Pass the `key` of
the image you chose as `imageKey`, or as `heroImageKey` for the lead image.

Never invent, guess or construct an image key. A key that is not in the library
produces an image block with no image, and nothing reports the mistake. If the
library holds nothing suitable, leave the image out and say which sections would
benefit from one — an editor adds it in the CMS afterwards.

Image titles are usually original filenames and rarely describe what is in the
picture, so do not treat a title as a reliable description of the image.

**How to shape an article**

Prefer several short sections over one long block of prose. Reach for the
section type that matches the content:

- `steps` for anything the reader does in order; `text` with a bulleted list
  when order does not matter.
- `accordion` for FAQs, common mistakes, and any long list a reader will skim.
- `table` for comparing two or more options across the same set of features.
  Give every row one cell per column label.
- `stats` for figures worth pausing on, up to four.
- `quote` only with a real named person and their role.
- `callout` for a single warning or key point, body under 200 characters.
- `banner` at most once per article, near the end, as the call to action.
- `imageText`, `gallery` and `image` wherever a picture genuinely helps.

Write in plain, practical language. No marketing copy, no invented statistics,
no claims about what the insurance covers unless the person asking supplied
them — this is a regulated insurer, and an invented policy detail is worse than
a vague one.

**After the tool returns**

Report the `url` and the `container` from the tool's response. `container`
confirms the article went into the Blog folder; if that field is missing, a
different tool ran and the article is in the wrong place.

Say clearly that the article was created as a **draft** and that someone has to
publish it in the CMS before it appears on the site. Never claim it is live.

---

## Verifying it worked

Ask Opal for an article and check its raw response:

- A `container` field means `create_blog_article` ran.
- No `container` field means a built-in tool ran and the skill is not biting —
  check that the skill is Active, that `Where to use` names this instance, and
  that the "LF site — blog" registry is present with a valid bearer token.

The article should land in **Root > Blog** as a draft.

---

## Related

- Tool registry setup and the discovery URL: `app/api/opal/discovery/route.ts`
- What each section type builds: `lib/blogComposition.ts`
- Optimizely's own guidance: [Skills overview](https://support.optimizely.com/hc/en-us/articles/36353487109133-Skills-overview),
  [Create an organization skill](https://support.optimizely.com/hc/en-us/articles/44401621317517-Create-an-organization-skill)
