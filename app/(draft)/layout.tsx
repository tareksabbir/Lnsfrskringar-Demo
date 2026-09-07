import { PreviewBridge } from '@/components/preview/PreviewBridge'

export const dynamic  = 'force-dynamic'
export const revalidate = 0

/**
 * Wraps the single-block draft route. The bridge is shared with the slug route
 * and /preview so the three preview pieces cannot drift apart between them —
 * this layout used to carry its own copy of the injector, which is how it ended
 * up as the only place OnPageEdit was mounted.
 */
export default function DraftLayout({ children }: { children: React.ReactNode }) {
  const cmsUrl = process.env.NEXT_PUBLIC_CMS_URL ?? process.env.OPTIMIZELY_CMS_URL ?? ''

  return (
    <>
      <PreviewBridge cmsUrl={cmsUrl} />
      {children}
    </>
  )
}
