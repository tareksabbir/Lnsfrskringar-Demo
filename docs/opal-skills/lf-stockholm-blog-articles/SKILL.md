---
name: LF Stockholm blog articles
description: Use whenever someone asks for a blog article, guide, tips page or editorial post to be written for the Länsförsäkringar Stockholm site. Forces the site's own create_blog_article tool instead of built-in CMS tools, and requires image keys to come from list_dam_images.
---

# LF Stockholm blog articles

Apply this whenever someone asks for a blog article, guide, tips page or
editorial post to be written for the Länsförsäkringar Stockholm site.

## Which tool to use

Write the article with `create_blog_article` from the "LF site — blog" tool
registry. Do not use any built-in CMS, content, page or media tool to create a
blog article on this site, and do not create the page by any other route. Only
`create_blog_article` places the article in the Blog folder and builds the
section layout the site renders; a page made any other way lands outside that
folder and does not display.

If `create_blog_article` is not available, stop and say so plainly. Do not
substitute another tool, and do not write the article as chat text instead. An
unavailable tool means the tool registry needs attention, and saying so is more
useful than producing something that has to be thrown away.

## Images

Call `list_dam_images` first and choose from what it returns. Pass the `key` of
the chosen image as `imageKey` on a section, or as `heroImageKey` for the lead
image.

Never invent, guess or construct an image key. A key that is not in the library
produces an image block with no image, and nothing reports the mistake. If the
library holds nothing suitable, leave the image out and say which sections would
benefit from one, so an editor can add it in the CMS afterwards.

Image titles are usually original filenames and rarely describe what is in the
picture. Do not treat a title as a reliable description of the image.

## How to shape an article

Prefer several short sections over one long block of prose. Reach for the
section type that matches the content:

- `steps` for anything the reader does in order; `text` with a bulleted list
  when order does not matter.
- `accordion` for FAQs, common mistakes, and any long list a reader will skim.
- `table` for comparing options across the same set of features. Give every row
  one cell per column label.
- `stats` for figures worth pausing on, up to four.
- `quote` only with a real named person and their role.
- `callout` for a single warning or key point; keep the body under 200
  characters.
- `banner` at most once per article, near the end, as the call to action.
- `image`, `imageText` and `gallery` wherever a picture genuinely helps.

Write in plain, practical language. No marketing copy and no invented
statistics. Do not state what an insurance policy covers unless the person
asking supplied that detail — this is a regulated insurer, and an invented
policy detail is worse than a vague one.

## After the tool returns

Report the `url` and the `container` from the tool's response. The `container`
field confirms the article went into the Blog folder; if it is missing, a
different tool ran and the article is in the wrong place.

State clearly that the article was created as a **draft** and that someone has
to publish it in the CMS before it appears on the site. Never describe it as
live.
