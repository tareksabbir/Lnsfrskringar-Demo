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
  // Native disclosure, allowed for hand-authored rich text that wants a
  // collapsible aside. NOT how the FAQ is built — that is OT_FaqSection, a real
  // component. Note that this only matters for HTML that reaches the sanitiser:
  // OT_RichTextBlock renders through the SDK's <RichText>, which walks a
  // structured node tree and ignores raw HTML entirely.
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
