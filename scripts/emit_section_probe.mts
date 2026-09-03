/**
 * Builds one article that uses EVERY section type and prints the composition
 * as JSON. Nothing is posted from here — scripts/section_probe.py does that —
 * because the point is to exercise the real builder and then watch the CMS
 * accept or reject its output.
 *
 * A section type that is silently dropped by the builder, or rejected by the
 * CMS, shows up as a missing section in the published tree. That is the only
 * honest test available: tsc proves the shapes compile, not that Optimizely
 * agrees with them.
 *
 *   npx tsx scripts/emit_section_probe.mts > /tmp/probe.json
 */
import { buildBlogComposition, type BlogInput } from '../lib/blogComposition'

// Real DAM asset keys, read from cmp_Asset via Graph. Invented keys produce an
// image block with no image, which is exactly the failure this probe exists to
// catch, so they must be real.
const IMG_A = '2f4c455aa50b11f1916b4a7836a56b60'
const IMG_B = '2fb42c88a50b11f18642aad510e37e1a'
const IMG_C = '3ba670faa50b11f1bbfea2186c78d1d2'

const article: BlogInput = {
  title: 'Section probe — every block type',
  intro: 'A throwaway draft that exercises every section the blog tool can build. Delete it once the tree has been checked.',
  breadcrumb: ['Private', 'Internal', 'Probe'],
  heroImageKey: IMG_A,
  heroImageAlt: 'Lead image for the section probe',
  sections: [
    { type: 'text', heading: 'Text section', body: '<p>Prose with a list.</p><ul><li>One</li><li>Two</li></ul>' },
    { type: 'steps', heading: 'Steps section', intro: 'Order matters here.', steps: ['Check the roof', 'Clear the gutters', 'Insulate the pipes'] },
    { type: 'accordion', heading: 'Accordion section', items: [
      { question: 'First question', answer: 'First answer.' },
      { question: 'Second question', answer: 'Second answer.' },
    ] },
    { type: 'image', imageKey: IMG_B, alt: 'A standalone image', caption: 'Image section with a caption' },
    { type: 'imageText', imageKey: IMG_C, alt: 'Image beside text', heading: 'Image and text section',
      body: '<p>Text sitting next to the picture.</p>', imageSide: 'right', ctaLabel: 'Read more', ctaUrl: '/' },
    { type: 'gallery', heading: 'Gallery section', images: [
      { imageKey: IMG_A, alt: 'One' }, { imageKey: IMG_B, alt: 'Two' }, { imageKey: IMG_C, alt: 'Three' },
    ] },
    { type: 'table', heading: 'Table section', intro: 'Two levels of cover.',
      columnLabels: ['Basic', 'Plus'],
      rows: [
        { label: 'Excess', cells: ['1500 kr', '500 kr'] },
        { label: 'Travel cover', cells: ['No', 'Yes'] },
        // Deliberately short: the builder must pad it, not slip the grid.
        { label: 'Legal cover', cells: ['No'] },
      ] },
    { type: 'stats', heading: 'Stats section', stats: [
      { value: '73%', label: 'of winter claims are water damage' },
      { value: '4 h', label: 'average time to first response' },
      { value: '1 in 5', label: 'homes has a pipe at risk' },
    ] },
    { type: 'quote', text: 'A short pull quote for the probe.', author: 'Morgan Öhlund', role: 'Damage prevention specialist' },
    { type: 'callout', heading: 'Callout section', body: 'A tinted warning panel, comfortably under two hundred characters.', intent: 'warning', ctaLabel: 'What to do', ctaUrl: '/' },
    { type: 'divider', label: 'Divider' },
    { type: 'banner', heading: 'Banner section', body: 'A full-width call to action.', imageKey: IMG_B, ctaLabel: 'Get a quote', ctaUrl: '/' },
    { type: 'video', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', title: 'Video section', caption: 'A YouTube embed' },
    // Must be DROPPED — the content type only accepts YouTube/Vimeo.
    { type: 'video', videoUrl: 'https://example.com/not-a-video.mp4', title: 'Should be dropped' },
    { type: 'cards', heading: 'Cards section', cards: [
      { title: 'Card one', body: 'First card.', ctaLabel: 'Go', ctaUrl: '/' },
      { title: 'Card two', body: 'Second card.' },
    ] },
    { type: 'links', heading: 'Related links', links: [
      { label: 'Home insurance', url: '/product/home-insurance' },
      { label: 'Car insurance', url: '/product/car-insurance' },
    ] },
  ],
}

process.stdout.write(JSON.stringify({
  displayName: article.title,
  routeSegment: 'section-probe',
  composition: buildBlogComposition(article),
}))
