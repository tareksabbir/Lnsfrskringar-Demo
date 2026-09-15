import Script from 'next/script'
import PreviewNavigator from '@/components/preview/PreviewNavigator'

/** Load CMS communication and refetch the requested preview on contentSaved. */
export function PreviewBridge({ cmsUrl }: { cmsUrl?: string | null }) {
  const base = (cmsUrl ?? '').replace(/\/$/, '')

  return (
    <>
      {base && <Script src={`${base}/util/javascript/communicationinjector.js`} />}
      <PreviewNavigator />
    </>
  )
}

export default PreviewBridge
