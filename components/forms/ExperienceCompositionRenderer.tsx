import { getPreviewUtils, OptimizelyComponent } from '@optimizely/cms-sdk/react/server'
import { RenderOptiForm, flattenElements, type FormData } from '@/cms/components/OptiFormsContainerData'
import type { ExperienceNode } from '@/lib/experienceComposition'

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Recursive renderer for a composition tree fetched by
 * `fetchExperienceComposition` (see lib/experienceComposition.ts for why this
 * exists instead of the SDK's OptimizelyComposition/OptimizelyGridSection).
 *
 * Every LEAF (CompositionComponentNode) is handed to the existing
 * `OptimizelyComponent` registry unchanged — every block/element adapter
 * already built (OT_PrimaryTextBlock, OptiFormsTextboxElement, ...) is reused
 * as-is. The only new logic here is the STRUCTURAL walk, and the one special
 * case a generic walk can't handle: a structural node whose own `component`
 * is `OptiFormsContainerData` (a referenced form) needs its nested
 * step→row→column→element tree flattened and handed to `RenderOptiForm`,
 * because the form's OWN adapter (`OptiFormsContainerDataAdapter`) expects to
 * do its own by-key lookup — which is exactly what this render path avoids.
 */

function buildFormData(node: ExperienceNode): FormData {
  const c = node.component ?? {}
  return {
    title: c.Title ?? undefined,
    description: c.Description ?? undefined,
    submitUrl: c.SubmitUrl?.default ?? undefined,
    confirmationMessage: c.SubmitConfirmationMessage ?? undefined,
    elements: flattenElements({ nodes: node.nodes ?? [] }),
  }
}

export function RenderExperienceComposition({ nodes }: { nodes: ExperienceNode[] }) {
  return (
    <>
      {nodes.map((node) => {
        const { pa } = getPreviewUtils(node as any)
        const previewAttrs = pa(node as any)

        if (node.__typename === 'CompositionComponentNode') {
          return (
            <div key={node.key} {...previewAttrs}>
              <OptimizelyComponent content={{ ...node.component, __composition: node }} />
            </div>
          )
        }

        // CompositionStructureNode from here on. A plain layout node with no
        // content of its own still comes back with a `component`, but a
        // generic Graph BASE-TYPE placeholder — `_Component` for a row/column,
        // `_Section` for a plain section (BlankSection), and so on for any
        // other base type. Every real, renderable content type in this schema
        // is namespaced (`OT_...`, `OptiForms...`) and never starts with `_`,
        // so that prefix is what distinguishes "this node has an actual block"
        // from "this is just a layout wrapper" — checking one literal name
        // (as the first version of this file did) missed every other base
        // type and misrendered plain sections as if OptimizelyComponent could
        // resolve "_Section".
        const typename = node.component?.__typename
        const hasRealComponent = !!typename && !typename.startsWith('_')

        if (typename === 'OptiFormsContainerData') {
          return (
            <div key={node.key} className="w-full" {...previewAttrs}>
              <RenderOptiForm form={buildFormData(node)} />
            </div>
          )
        }

        if (hasRealComponent) {
          // An inline block acting as its own wrapper (rare here, kept for
          // completeness) — render it, then recurse into its children.
          return (
            <div key={node.key} {...previewAttrs}>
              <OptimizelyComponent content={{ ...node.component, __composition: node }} />
              <RenderExperienceComposition nodes={node.nodes ?? []} />
            </div>
          )
        }

        // A plain layout node (section/step/row/column) with no component of
        // its own. Intentionally simple — this renderer trades exact parity
        // with OT_LandingSection's styling for reliability on this one page.
        const layoutClass =
          node.nodeType === 'row'    ? 'flex flex-col gap-md md:flex-row md:gap-lg'
          : node.nodeType === 'column' ? 'flex-1'
          : 'flex flex-col gap-lg'

        return (
          <div key={node.key} className={layoutClass} {...previewAttrs}>
            <RenderExperienceComposition nodes={node.nodes ?? []} />
          </div>
        )
      })}
    </>
  )
}
