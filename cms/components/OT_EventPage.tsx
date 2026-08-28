import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_EventPage as OT_EventPageContentType } from '@/cms/content-types/OT_EventPage'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import EventPage from '@/components/pages/EventPage'
import type { EventPageContent } from '@/lib/events'

type Props = { content: ContentProps<typeof OT_EventPageContentType> }

// CMS Visual Editor adapter for OT_EventPage.
// Renders the full event page (with Header/Footer) so the editor preview shows
// the real layout. pa() is threaded to EventPage so each field gets a
// data-epi-edit attribute for click-to-edit highlighting.
export default async function OT_EventPageAdapter({ content }: Props) {
  const { pa } = getPreviewUtils(content)

  return (
    <>
      <Header />
      <main className="flex-1" {...pa(content.__composition)}>
        <EventPage content={content as unknown as EventPageContent} pa={pa} />
      </main>
      <Footer />
    </>
  )
}
