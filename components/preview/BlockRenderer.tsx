import { OptimizelyComponent } from '@optimizely/cms-sdk/react/server'

type Props = { content: any; contentKey: string }

// Synthesizes __composition so adapters' pa(content.__composition) produces data-epi-block-id
// for the CMS overlay, then delegates rendering to the SDK's component resolver.
export default async function BlockRenderer({ content, contentKey }: Props) {
  return (
    <OptimizelyComponent content={{ ...content, __composition: { key: contentKey } }} />
  )
}
