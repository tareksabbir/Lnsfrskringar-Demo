import { getClient } from '@/lib/optimizely'
import { ELEMENT_FRAGMENT } from '@/cms/components/OptiFormsContainerData'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Hand-written composition fetch for pages that embed an Optimizely Forms
 * container — see app/(site)/contact-us/page.tsx.
 *
 * WHY THIS EXISTS, NOT THE SDK'S AUTO-GENERATED QUERY
 * Optimizely's own reference implementation (docs.developers.optimizely.com
 * → "Render a form with Optimizely Graph") hand-writes its composition query
 * rather than using `@optimizely/cms-sdk`'s generated one, and requests
 * `component { ..._IComponent }` directly on every CompositionStructureNode
 * — not gated behind `... on CompositionComponentNode`. That is the one
 * detail that matters here: `@optimizely/cms-sdk` 2.2.0's generated fragment
 * (`buildNestedCompositionNodes`) only ever asks for `component` under the
 * `CompositionComponentNode` condition. A form embedded on a page has to be
 * a REFERENCE (Optimizely rejects embedding a layoutType:'form' section
 * inline — see the official doc's own warning: "forms work with experiences
 * only... ContentReference... the form does not work"), and that reference
 * shows up in Graph as a pure CompositionStructureNode carrying its OWN
 * `component` (the form's Title/SubmitUrl/etc.) alongside `nodes`. The SDK's
 * query never asks for it there, so `_metadata.key` (and everything else on
 * the form) is simply absent from what the page's normal query returns —
 * not a caching issue, not a CMS issue, a gap in the generated query.
 *
 * This file closes that gap by writing the query the same way Optimizely's
 * own sample does, requesting `component` unconditionally at every
 * structural level, deep enough to reach elements nested inside a
 * form-reference (section → step → row → column → component).
 */

// The component fragment applies at EVERY structural nesting level, so it has
// to cover every content type that might appear there: section wrappers,
// simple text blocks, the form container itself, and every form element type.
const COMPONENT_FRAGMENT = `
  __typename
  ... on OptiFormsContainerData {
    _metadata { key }
    Title
    Description
    SubmitConfirmationMessage
    ShowSummaryMessageAfterSubmission
    SubmitUrl { default }
  }
  ... on OT_PrimaryTextBlock {
    headline
    headingLevel
    headerEffect
    body { html }
  }
  ${ELEMENT_FRAGMENT}
`

/**
 * Builds the selection set for one composition node, recursing `depth` more
 * "nodes" hops. Both possible concrete types are covered at every level:
 * CompositionStructureNode (has `nodes`, may ALSO carry its own `component`
 * — a section wrapping a form is exactly this) and CompositionComponentNode
 * (a leaf — no `nodes`, only `component`).
 */
function nodeSelection(depth: number): string {
  const structural =
    `__typename key nodeType layoutType displayName ` +
    `component { ${COMPONENT_FRAGMENT} }` +
    (depth > 0 ? ` nodes { ${nodeSelection(depth - 1)} }` : '')
  const leaf = `__typename key component { ${COMPONENT_FRAGMENT} }`
  return `... on CompositionStructureNode { ${structural} } ... on CompositionComponentNode { ${leaf} }`
}

// section → {row|step} → row → column → component is 4 hops past the section
// itself; +1 for margin.
const DEPTH = 5

const EXPERIENCE_QUERY = `
  query GetExperienceComposition($key: String!) {
    _Content(where: { _metadata: { key: { eq: $key } } }) {
      item {
        __typename
        _metadata { key }
        ... on _IExperience {
          composition {
            ... on CompositionStructureNode {
              nodes { ${nodeSelection(DEPTH)} }
            }
          }
        }
      }
    }
  }
`

export type ExperienceNode = {
  __typename: 'CompositionStructureNode' | 'CompositionComponentNode'
  key: string
  nodeType?: string
  layoutType?: string
  displayName?: string
  component?: any
  nodes?: ExperienceNode[]
}

type FetchOptions = {
  previewToken?: string
  edit?: boolean
}

/**
 * Adds `__context = { edit, preview_token }` next to every `__typename`,
 * mirroring `decorateWithContext` inside the SDK's own GraphClient (not
 * exported publicly, so reimplemented here). `getPreviewUtils(node).pa(node)`
 * — used by the renderer for click-to-select in Visual Builder — reads
 * exactly this shape.
 */
function decorateWithContext(obj: any, ctx: { edit: boolean; preview_token?: string }): any {
  if (Array.isArray(obj)) return obj.map(e => decorateWithContext(e, ctx))
  if (typeof obj === 'object' && obj !== null) {
    for (const k in obj) obj[k] = decorateWithContext(obj[k], ctx)
    if ('__typename' in obj) obj.__context = ctx
  }
  return obj
}

export async function fetchExperienceComposition(
  key: string,
  { previewToken, edit = false }: FetchOptions = {},
): Promise<ExperienceNode[] | null> {
  try {
    const data = await getClient().request(
      EXPERIENCE_QUERY,
      { key },
      previewToken,
      // Never cache a preview request; published requests use this page's
      // own `revalidate`, so no additional caching is needed at this layer.
      !previewToken,
    ) as any
    const item = data?._Content?.item
    if (!item) return null
    const nodes = item.composition?.nodes ?? []
    return (previewToken || edit) ? decorateWithContext(nodes, { edit: true, preview_token: previewToken }) : nodes
  } catch (err) {
    console.error('[experienceComposition] could not load composition:', err)
    return null
  }
}
