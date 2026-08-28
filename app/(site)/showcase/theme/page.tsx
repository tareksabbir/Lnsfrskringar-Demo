import type { Metadata } from 'next'
import { getSiteSettings, getRequestDomain, getRequestLocale } from '@/lib/optimizely'
import ThemePlayground from '@/components/theme/playground/ThemePlayground'
import { buildInitialColors, buildInitialAxes } from '@/components/theme/playground/model'

export const metadata: Metadata = {
  title: 'Theme Playground — Design System — Site Accelerator',
}

export default async function ThemePlaygroundPage() {
  const settings = await getSiteSettings(await getRequestDomain(), await getRequestLocale())

  return (
    <ThemePlayground
      initialColors={buildInitialColors(settings)}
      initialAxes={buildInitialAxes(settings)}
    />
  )
}
