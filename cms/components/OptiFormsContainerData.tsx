import { getPreviewUtils, OptimizelyComponent } from '@optimizely/cms-sdk/react/server'
import FormWrapper from '@/components/forms/FormWrapper'
import { getClient } from '@/lib/optimizely'

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  content: any
  displaySettings?: Record<string, string | boolean>
}

/**
 * Renders an Optimizely Forms container.
 *
 * ── The query below is verified, not assumed ────────────────────────────────
 * An earlier version asked for `SingleChoice`, `Step`, `Feed` and a `Validators`
 * on the range element — none of which exist on this instance's schema — and
 * read the elements out of `composition.grids`, which is not the shape Graph
 * returns. Every field here was checked against the live schema, and the walk
 * below matches what a real form actually returns:
 *
 *     composition → step → row → column → component
 *
 * `step`, not `section`. That is the one structural difference between a form's
 * composition and a page's, and it is why the page renderer cannot be reused.
 */

export const ELEMENT_FRAGMENT = `
  __typename
  ... on OptiFormsTextboxElement   { Label SubmissionFieldName Placeholder Tooltip PredefinedValue AutoComplete Validators }
  ... on OptiFormsTextareaElement  { Label SubmissionFieldName Placeholder Tooltip PredefinedValue AutoComplete Validators }
  ... on OptiFormsNumberElement    { Label SubmissionFieldName Placeholder Tooltip PredefinedValue AutoComplete Validators }
  ... on OptiFormsUrlElement       { Label SubmissionFieldName Placeholder Tooltip PredefinedValue Validators }
  ... on OptiFormsChoiceElement    { Label SubmissionFieldName Tooltip Options AllowMultiSelect Validators }
  ... on OptiFormsSelectionElement { Label SubmissionFieldName Placeholder Tooltip Options AllowMultiSelect AutoComplete Validators }
  ... on OptiFormsRangeElement     { Label SubmissionFieldName Tooltip PredefinedValue Min Max Increment }
  ... on OptiFormsSubmitElement    { Label Tooltip }
  ... on OptiFormsResetElement     { Label Tooltip }
`

const FORM_QUERY = `
  query GetForm($key: String!) {
    OptiFormsContainerData(where: { _metadata: { key: { eq: $key } } }, limit: 1) {
      items {
        Title
        Description
        SubmitConfirmationMessage
        SubmitUrl { default }
        composition {
          ... on CompositionStructureNode {
            nodes {
              ... on CompositionStructureNode {
                key nodeType displayName
                nodes {
                  ... on CompositionStructureNode {
                    key nodeType
                    nodes {
                      ... on CompositionStructureNode {
                        key nodeType
                        nodes {
                          ... on CompositionComponentNode {
                            key
                            component { ${ELEMENT_FRAGMENT} }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

export type FormData = {
  title?: string
  description?: string
  submitUrl?: string
  confirmationMessage?: string
  /** Flattened in document order — the row/column grid is not reproduced. */
  elements: Array<{ key: string; component: any }>
}

/** Collect every component node, depth first, so document order is preserved. */
export function flattenElements(node: any, out: Array<{ key: string; component: any }> = []) {
  if (node?.component?.__typename) out.push({ key: node.key, component: node.component })
  for (const child of node?.nodes ?? []) flattenElements(child, out)
  return out
}

/**
 * Fetches one form container by its CMS content key.
 *
 * Exported so a code route can call this directly with a hardcoded/env key,
 * bypassing composition entirely — see `app/(site)/contact/page.tsx`. That
 * bypass exists because a form PLACED ON A PAGE is stored as a reference
 * (Optimizely rejects embedding a layoutType:'form' section inline), and the
 * reference shows up in Graph as a structural node whose OWN `component`
 * field (carrying this key) is only reachable with a query shape this app's
 * auto-generated page/composition query does not produce — so the composition
 * adapter below (`OptiFormsContainerDataAdapter`) never receives a usable
 * `_metadata.key` for a REFERENCED form, only a form placed directly at an
 * experience root. Fetching by a known key sidesteps that gap completely.
 */
export async function fetchForm(key: string): Promise<FormData | null> {
  try {
    // request()'s 4th param is `cache`, defaulting to true — unlike the page's
    // own composition fetch (getPreviewContent(..., { cache: false })), this is
    // a SEPARATE query the adapter issues itself, so it was never covered by that
    // bypass. An editor building a form in Visual Builder would add an element,
    // see the page-level preview refetch correctly, and still see "This form
    // could not be loaded" — the empty/earlier result stayed cached under this
    // query's own key. Forms change rarely enough that always-fresh is worth
    // more here than the cache would save.
    const data = await getClient().request(FORM_QUERY, { key }, undefined, false) as any
    const item = data?.OptiFormsContainerData?.items?.[0]
    if (!item) return null
    return {
      title:               item.Title ?? undefined,
      description:         item.Description ?? undefined,
      submitUrl:           item.SubmitUrl?.default ?? undefined,
      confirmationMessage: item.SubmitConfirmationMessage ?? undefined,
      elements:            flattenElements(item.composition),
    }
  } catch (err) {
    // Loud: a form that silently renders empty looks like an authoring mistake
    // and sends someone into the CMS to look for a problem that is in the query.
    console.error('[forms] could not load the form container:', err)
    return null
  }
}

/**
 * Pure rendering for a fetched form — no composition, no preview attrs. Used
 * both by the composition adapter below and by any code route that fetched
 * a `FormData` directly with `fetchForm()`.
 */
export function RenderOptiForm({ form }: { form: FormData }) {
  return (
    <FormWrapper
      title={form.title}
      description={form.description}
      submitUrl={form.submitUrl}
      confirmationMessage={form.confirmationMessage}
    >
      <div className="flex flex-col gap-md">
        {form.elements.map(({ key: k, component }) => (
          <OptimizelyComponent
            key={k}
            content={{ ...component, __composition: { key: k } }}
          />
        ))}
      </div>
    </FormWrapper>
  )
}

export default async function OptiFormsContainerDataAdapter({ content }: Props) {
  const { pa } = getPreviewUtils(content)

  const key = content._metadata?.key
  const form = key ? await fetchForm(key) : null

  if (!form) {
    return (
      <div className="w-full border border-fg/15 bg-surface p-lg" {...pa(content)}>
        <p className="text-body text-fg-muted">This form could not be loaded.</p>
      </div>
    )
  }

  return (
    <div className="w-full" {...pa(content)}>
      <RenderOptiForm form={form} />
    </div>
  )
}
