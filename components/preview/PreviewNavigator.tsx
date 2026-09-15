'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { previewNavigation } from '@/lib/previewNavigation'

/** Optimizely's documented contentSaved event supplies the new URL and token. */
export default function PreviewNavigator() {
  const router = useRouter()
  const [unavailable, setUnavailable] = useState(false)

  useEffect(() => {
    function onSaved(event: Event) {
      const message = (event as CustomEvent).detail
      const target = message && previewNavigation(message, window.location.href)
      if (!target) {
        setUnavailable(true)
        return
      }
      setUnavailable(false)
      const current = window.location.pathname + window.location.search + window.location.hash
      if (target === current) router.refresh()
      else router.replace(target, { scroll: false })
    }
    window.addEventListener('optimizely:cms:contentSaved', onSaved)
    return () => window.removeEventListener('optimizely:cms:contentSaved', onSaved)
  }, [router])

  return unavailable ? <p role="alert">The CMS did not provide a complete preview link. Reopen preview in the CMS.</p> : null
}
