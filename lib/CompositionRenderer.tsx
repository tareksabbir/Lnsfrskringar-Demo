/**
 * Drop-in replacement for OptimizelyComposition that correctly passes
 * displaySettings to top-level component nodes.
 *
 * The SDK's OptimizelyComposition computes parsedDisplaySettings for
 * CompositionComponentNode entries but forwards it only to the Wrapper,
 * not to OptimizelyComponent.  OptimizelyGridSection (used for blocks
 * nested inside sections) does pass it correctly.  This renderer fixes
 * the gap so any block placed at the experience root also receives its
 * configured display settings.
 *
 * ── Preview attributes ──────────────────────────────────────────────────────
 * The SDK also spreads `...pa(node)` onto each node it renders:
 *
 *     _jsx(OptimizelyComponent, { content: {...}, displaySettings, ...previewAttrs }, node.key)
 *
 * That spread is what emits `data-epi-block-id`, and it is the ONLY thing
 * Visual Builder uses to map a click in the preview back to a node in the
 * Outline. This file used to omit it, so sections rendered at the experience
 * root carried no id and were not selectable — the page looked right and
 * nothing responded to clicks. It is restored below.
 *
 * `pa()` only emits anything when `content.__context.edit` is true, and
 * `__context` is attached exclusively by getPreviewContent (see
 * decorateWithContext in the SDK's graph client). So a page fetched through the
 * ordinary published path is inert by design — the route has to take its
 * preview branch for any of this to appear.
 */
import { OptimizelyComponent, getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { DisplayTemplates } from '@optimizely/cms-sdk'

const { parseDisplaySettings } = DisplayTemplates

function isComponentNode(node: any): boolean {
  return node.__typename === 'CompositionComponentNode'
}

export function CompositionRenderer({ nodes }: { nodes: any[] }) {
  // Dev-only: says in one line whether Visual Builder will be able to select
  // anything, so this does not have to be diagnosed by reading page source.
  if (process.env.NODE_ENV !== 'production') {
    // `n` is inferred from `nodes: any[]`; annotating it explicitly would trip
    // @typescript-eslint/no-explicit-any for no benefit.
    const withCtx = nodes.filter((n) => n?.__context?.edit === true).length
    if (nodes.length) {
      console.log(
        `[composition] ${nodes.length} root nodes · editContext on ${withCtx} · ` +
        (withCtx > 0
          ? 'emitting data-epi-block-id — VB should be able to select'
          : 'NO edit context — page is inert in VB (preview fetch did not supply __context)'),
      )
    }
  }

  return nodes.map((node) => {
    const displaySettings = parseDisplaySettings(node.displaySettings)
    const { pa } = getPreviewUtils(node)
    const previewAttrs = pa(node)

    if (isComponentNode(node)) {
      return (
        <OptimizelyComponent
          key={node.key}
          content={{ ...node.component, __composition: node }}
          displaySettings={displaySettings}
          {...previewAttrs}
        />
      )
    }

    if (!node.type) return null

    return (
      <OptimizelyComponent
        key={node.key}
        content={{ ...node, __typename: node.type }}
        displaySettings={displaySettings}
        {...previewAttrs}
      />
    )
  })
}
