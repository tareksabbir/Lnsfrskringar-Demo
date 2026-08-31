import { contentType } from '@optimizely/cms-sdk'
import { OT_FooterLink } from './OT_FooterLink'

/**
 * OT_FooterColumn — one heading + link-list group inside a "Columns" footer
 * (OT_FooterBlock.footerStyle === 'columns'). Modeled for multi-column
 * footers such as Länsförsäkringar's 6-column layout (e.g. "About us",
 * "Customer service", "Insurance", "Bank", "Sustainability", "Contact").
 */
export const OT_FooterColumn = contentType({
  key: 'OT_FooterColumn',
  displayName: 'Footer Column',
  baseType: '_component',
  properties: {
    heading: {
      type: 'string',
      isLocalized: true,
      maxLength: 60,
      displayName: 'Column Heading',
      group: 'OT_Content',
      sortOrder: 10,
    },
    links: {
      type: 'array',
      isLocalized: true,
      displayName: 'Links',
      description: 'Links listed under this column heading. Up to 8 per column.',
      group: 'OT_Content',
      sortOrder: 20,
      maxItems: 8,
      items: { type: 'component', contentType: OT_FooterLink },
    },
  },
})
