# Opal skills

Skills are Optimizely Opal's reusable instructions, applied at runtime. Opal
uses the `SKILL.md` format and is agentskills.io compatible, so a skill folder
here imports directly.

## Importing

**Opal → Context → Skills → Add Skill → Import Skill**, then either:

- **GitHub URL** — paste the URL of the skill's folder in this repo. This is the
  reason the skill lives in version control rather than in someone's notes: the
  imported skill and the tool it drives move together.
- **Direct upload** — drag the folder, or `SKILL.md`, or paste the contents of
  `skill.json`.

Set **Create as: Organization** so the skill applies to everyone rather than one
account.

## After importing

Open the skill and set **Where to use** to the Optimizely product and instance
it belongs to — for the blog skill that is Content Management System,
`lans01saas: Production1`. Nothing in `SKILL.md` can express that binding; it is
an Opal-side field, and without it the skill applies everywhere.

Check **Activation Trigger** too. Keyword and intent matching is right for the
blog skill; the alternative fires only when specific tools are already in use,
which is too late to influence which tool gets chosen.

## Which file the importer wants

`SKILL.md` is the documented format and the one to prefer. `skill.json` is
generated from it as a convenience for the paste-JSON path — the field names
there are taken from Opal's own skill editor, but the exact export schema is not
published. If the JSON import rejects it, export any existing skill from Opal
("More options → Export as JSON"), and the shape it gives back is authoritative.

Regenerate the JSON after editing `SKILL.md` so the two do not drift.

## Skills here

| Folder | What it does |
| --- | --- |
| `lf-stockholm-blog-articles/` | Pins blog writing to this site's `create_blog_article` tool instead of Opal's built-in CMS tools, and requires image keys to come from `list_dam_images`. |
