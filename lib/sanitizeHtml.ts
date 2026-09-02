import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'ins',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'figure', 'figcaption', 'img',
  'hr', 'sup', 'sub',
  // Native disclosure. This is how an FAQ gets built here: OT_AccordionBlock
  // cannot be placed in a composition at all on this CMS — its `items` array
  // bars it from being elementEnabled, and a `_component` is refused as a
  // section's component — so rich text is the only route to collapsible rows.
  // Both tags are inert structure with no scripting surface, and the attribute
  // allowlist below still applies (class / id / data-* only, so no `open`
  // toggling from content).
  'details', 'summary',
]

const ALLOWED_ATTRS: sanitizeHtml.IOptions['allowedAttributes'] = {
  a:   ['href', 'target', 'rel', 'title'],
  img: ['src', 'alt', 'width', 'height', 'loading'],
  td:  ['colspan', 'rowspan'],
  th:  ['colspan', 'rowspan', 'scope'],
  '*': ['class', 'id', 'data-*'],
}

export function sanitizeCmsHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitizeHtml(html, {
    allowedTags:       ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRS,
    allowedSchemes:    ['https', 'http', 'mailto', 'tel'],
    disallowedTagsMode: 'discard',
  })
}
