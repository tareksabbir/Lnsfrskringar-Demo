'use client'

import { PreviewBridge } from './PreviewBridge'

export function PreviewUnavailable({ cmsUrl }: { cmsUrl: string }) {
  return <>
    <PreviewBridge cmsUrl={cmsUrl} />
    <section role="alert" className="p-lg">
      <h1>Preview unavailable</h1>
      <p>The requested draft could not be loaded. If the link has expired, reopen preview in the CMS for a fresh link. Retrying does not renew an expired token.</p>
      <button type="button" onClick={() => window.location.reload()}>Retry preview</button>
    </section>
  </>
}
