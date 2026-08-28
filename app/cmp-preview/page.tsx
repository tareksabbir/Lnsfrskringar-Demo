import { getLatestDelivery, getDeliveryByPreviewId } from '@/lib/cmpPreviewStore'
import { mapCmpPreviewToBlog } from '@/lib/cmpBlog'
import { resolveCmpAsset, cmpConfigured } from '@/lib/cmpApi'
import BlogPage from '@/components/pages/BlogPage'

// CMP blog preview render — PHASE 2.
//
// Renders the most recently captured CMP preview payload (or a specific one via
// ?id=<preview_id>) through the same <BlogPage> component a CMS-backed blog uses.
// ?style=impact|atmospheric|editorial picks the header treatment, since CMP's
// blog content type carries no equivalent field.
//
// Reads from the in-memory store, so it reflects deliveries received by the same
// server process — reliable under `yarn dev`. See cmpPreviewStore.ts for the
// production durability note (phase 3 = Vercel KV + the acknowledge/complete
// round-trip so this renders inside CMP's preview iframe).

export const dynamic = 'force-dynamic'
export const revalidate = 0

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

function Notice({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center px-md">
      <div className="max-w-prose text-center">
        <h1 className="text-title font-semibold text-fg">{title}</h1>
        <p className="mt-sm text-body text-fg-muted">{detail}</p>
      </div>
    </main>
  )
}

export default async function CmpPreviewPage({ searchParams }: Props) {
  const sp = await searchParams
  const id    = typeof sp.id === 'string' ? sp.id : undefined
  const style = typeof sp.style === 'string' ? sp.style : undefined

  const delivery = id ? await getDeliveryByPreviewId(id) : await getLatestDelivery()

  if (!delivery) {
    return (
      <Notice
        title="No preview captured yet"
        detail="Trigger a preview from Optimizely CMP (its webhook POSTs to /api/cmp-preview), then reload this page."
      />
    )
  }

  const mapped = mapCmpPreviewToBlog(delivery.payload, { blogStyle: style })

  if (!mapped) {
    return (
      <Notice
        title="Captured payload had no blog content"
        detail="The most recent CMP delivery did not contain a structured-content blog. Check /api/cmp-preview for the raw payload."
      />
    )
  }

  // Resolve the CMP-hosted featured image to its public CDN URL (needs API
  // creds). Skipped gracefully when CMP_* isn't configured — the blog still
  // renders without the hero image.
  const content = { ...mapped.content }
  if (mapped.featuredImageAssetUrl && cmpConfigured()) {
    const { url } = await resolveCmpAsset(mapped.featuredImageAssetUrl)
    if (url) content.featuredImage = { url: { default: url } }
  }

  return <BlogPage content={content} latestPosts={[]} />
}
