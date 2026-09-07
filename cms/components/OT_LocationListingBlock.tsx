import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_LocationListingBlock as OT_LocationListingBlockContentType } from '@/cms/content-types/OT_LocationListingBlock'
import { getRequestDomain, getRequestLocale, getSiteKey, getSiteSettings } from '@/lib/optimizely'
import { getAllLocations } from '@/lib/locations'
import { getLocationListingStyles } from '@/cms/styling/OT_LocationListingBlock.styling'
import LocationListingBlock from '@/components/blocks/LocationListingBlock'
import { buildLocationListJsonLd } from '@/lib/structured-data'
import JsonLd from '@/components/seo/JsonLd'

type Props = {
  content:          ContentProps<typeof OT_LocationListingBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

// Async server component. Fetches location records at render time — scoped to
// the current site via siteKey (ThemeManager frontEndDomain). The server wrapper
// geocodes addresses before delegating to the client. React cache() in
// lib/locations.ts dedups the Graph round-trip across multiple listings.
export default async function OT_LocationListingBlockAdapter({
  content,
  displaySettings = {},
}: Props) {
  const { pa } = getPreviewUtils(content)

  const styleOptions = getLocationListingStyles(content.defaultView ? { ...displaySettings, defaultView: content.defaultView } : displaySettings)
  const [locale, siteKey, settings] = await Promise.all([
    getRequestLocale(),
    getSiteKey(),
    getRequestDomain().then(domain => getSiteSettings(domain)),
  ])

  const rawMax = content.maxItems ?? 0
  const limit  = Number.isInteger(rawMax) && rawMax >= 1 ? rawMax : 50

  const locations = await getAllLocations({ siteKey: siteKey ?? undefined, limit, locale })

  // Block-level structured data. The branches are fetched here, so the
  // page-level walk over the composition tree in lib/structured-data.ts sees
  // only this block's configuration — an ItemList of LocalBusiness can be built
  // nowhere but inside the adapter that has the records.
  const jsonLd = buildLocationListJsonLd(locations, {
    name:               content.heading ?? undefined,
    origin:             (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '') || undefined,
    parentOrganization: settings?.siteName ?? undefined,
  })

  return (
    <div {...pa(content.__composition)} className="w-full">
      {jsonLd && <JsonLd data={jsonLd} />}
      <LocationListingBlock
        heading={content.heading ?? undefined}
        subtext={content.subtext ?? undefined}
        locations={locations}
        epiEmptyMessage={pa('emptyMessage')}
        emptyMessage={content.emptyMessage ?? undefined}
        styleOptions={styleOptions}
        pa={pa}
      />
    </div>
  )
}
