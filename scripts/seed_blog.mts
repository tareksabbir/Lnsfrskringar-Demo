/**
 * Seeds a blog article through the SAME code path /api/opal/create-blog uses —
 * buildBlogComposition, then one POST to the CMS. Running the real builder
 * rather than a reimplementation is the point: if the composition shape is
 * wrong, it is wrong here too.
 *
 *   npx tsx scripts/seed_blog.mts [--dry-run]
 */
import { readFileSync } from 'node:fs'
import { buildBlogComposition, type BlogInput } from '../lib/blogComposition'

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const t = line.trim()
  if (t && !t.startsWith('#') && t.includes('=')) {
    const [k, ...v] = t.split('=')
    process.env[k.trim()] ??= v.join('=').trim()
  }
}

const GATEWAY = 'https://api.cms.optimizely.com'
const FOLDER = process.env.CMS_BLOG_CONTAINER_KEY!

const article: BlogInput = {
  title: 'The road to a successful renovation',
  intro:
    'Are you thinking about rebuilding or renovating your home? A well-executed renovation can '
    + 'increase both the comfort and the value of your home. But if the work is done incorrectly, '
    + 'it can lead to costly damage — and in some cases affect your insurance coverage. Here we '
    + 'have collected our best tips for a safer renovation.',
  breadcrumb: ['Private', 'Tips & guides', 'Home and household', 'Renovate', 'Successful renovation'],
  sections: [
    {
      type: 'accordion',
      heading: 'Tips for those renovating',
      items: [
        { question: 'Calculate with margin',
          answer: 'A renovation often costs more than you expect and takes longer than planned. '
                + 'If you need to borrow for your renovation, you can apply to expand your mortgage.' },
        { question: 'Replace the old parts',
          answer: 'Replace old installations such as pipes and drains in connection with renovation. '
                + 'The material has a certain technical lifespan and it may be a good idea to replace '
                + 'the installations in connection with the renovation.' },
        { question: 'Think about the environment',
          answer: 'Choose sustainable alternatives if you have the opportunity. For example, choosing '
                + 'an installation that has a longer lifespan reduces waste over time.' },
        { question: 'Beware of the design trap',
          answer: 'Design is nice, but remember to consider the practical aspects of choosing materials '
                + 'and methods when renovating. A well-executed renovation offers protection for the '
                + 'value of your home.' },
      ],
    },
    {
      type: 'quote',
      text: 'A tap for the home transformation update the entire construction in connection with the '
          + 'renovation. Don’t we can also give a technical installation become part of the renovated '
          + 'space, but make sure to replace old installations once you have renovated.',
      author: 'Morgan Öhlund',
      role: 'Damage prevention specialist at Länsförsäkringar',
    },
    {
      type: 'text',
      heading: 'Make a renovation plan',
      body:
        '<p>A renovation plan makes it easier to plan and structure your renovation. It clearly shows '
        + 'what needs to be done and when it needs to be done, and it also gives you a good overview of '
        + 'how the entire renovation is going. Some examples of questions that are good to think about:</p>'
        + '<ul>'
        + '<li>Does the renovation require a building permit or building notification?</li>'
        + '<li>Does the planned work affect existing construction and installation?</li>'
        + '<li>What building and industry regulations do I need to take into account?</li>'
        + '<li>Do I need help from a qualified professional?</li>'
        + '<li>If you live in a condominium, association or cooperative, you need to be approved by your '
        + 'condominium association. Do also check what applies in your particular association before you '
        + 'start the renovation.</li>'
        + '<li>If you live in a rental property, you need to get the landlord’s approval to renovate or '
        + 'rebuild your home.</li>'
        + '</ul>',
    },
    {
      type: 'accordion',
      heading: 'Examples of renovation mistakes to avoid',
      items: [
        { question: 'Punctured moisture barrier in bathroom',
          answer: 'For example, if you drill into the wall to install a shower screen or interior '
                + 'design without sealing properly, a so-called penetrant moisture barrier may occur.' },
        { question: 'Damage to water pipes',
          answer: 'Can occur if you drill or saw without knowing where the pipes are.' },
        { question: 'Damage to electrical wiring',
          answer: 'Damage to electrical wiring is particularly common during demolition, but also '
                + 'during installation or remodelling of walls.' },
        { question: 'Improper ventilation or heating',
          answer: 'Blocked vents or too low heating can contribute to dampness, mould or frozen pipes.' },
        { question: 'Incorrectly decorated basement',
          answer: 'Older basements require special protection against moisture and condensation.' },
        { question: 'Sealing basement floors',
          answer: 'Sealing materials can trap moisture and cause mould.' },
        { question: 'Incorrectly performed drainage',
          answer: 'If drainage is not performed correctly, it can, in the worst case, lead to major and '
                + 'costly moisture damage.' },
        { question: 'Incorrectly installed gutters and downpipes',
          answer: 'If you have the wrong slope or stoppage in the system, it can damage the facade, '
                + 'eaves and drainage.' },
        { question: 'Balconies that let in moisture',
          answer: 'If you have the wrong upload trend to the facade or foundation, it can cause moisture '
                + 'damage over time.' },
        { question: 'Own electrical installations',
          answer: 'Many electrical works require authorisation and incorrect installation can, in the '
                + 'worst case, cause a fire.' },
      ],
    },
    {
      type: 'text',
      heading: 'Building and industry regulations',
      body:
        '<p>In order for the construction or renovation to be carried out correctly, you must follow the '
        + 'applicable building and industry regulations and follow the manufacturer’s instructions. The '
        + 'building and industry regulations that exist are:</p>'
        + '<ul>'
        + '<li>The National Board of Housing, Building and Planning’s building regulations, BBR</li>'
        + '<li>Safe Water</li>'
        + '<li>The Building Ceramics Council’s industry rules for wet rooms, BKR</li>'
        + '<li>The flooring industry’s wet room inspection, GVK</li>'
        + '<li>The painting industry’s wet room inspection, MVK</li>'
        + '<li>Safe Electricity</li>'
        + '</ul>'
        + '<p>If damage occurs in your home and it turns out that the construction or renovation was not '
        + 'carried out in accordance with the building and industry regulations in force at the time, the '
        + 'compensation from your insurance may be lower or not paid at all.</p>',
    },
    {
      type: 'text',
      heading: 'Renovate yourself or hire a contractor?',
      body:
        '<p>Regardless of whether you intend to carry out the renovation yourself or hire a contractor, '
        + 'it is important that the work is carried out in accordance with applicable building and '
        + 'industry regulations. Things to consider when choosing who will carry out your renovation are:</p>'
        + '<h3>Entrepreneur</h3>'
        + '<p>If you hire a contractor, it is important that you ensure that the contractor has the right '
        + 'expertise and the work is carried out in accordance with applicable building and industry '
        + 'regulations. It is important that your contractor can provide current certificates of liability '
        + 'insurance and F-tax.</p>'
        + '<h3>Renovate yourself</h3>'
        + '<p>If you want to carry out the renovation yourself, you should ensure that the renovation is '
        + 'carried out professionally. We always recommend that you follow applicable building and industry '
        + 'regulations.</p>',
    },
    {
      type: 'text',
      heading: 'How does insurance apply to renovations?',
      body:
        '<p>Renovation must be carried out in accordance with applicable building and industry regulations '
        + 'in order for your insurance to compensate you for damage. If you do not renovate in accordance '
        + 'with applicable building and industry regulations, or do not follow the manufacturer’s, '
        + 'supplier’s or installer’s instructions, compensation may be reduced or not paid at all.</p>'
        + '<p>Remember to take care of and maintain your property to, for example, following your '
        + 'instructions to avoid damage.</p>',
    },
    {
      type: 'callout',
      heading: 'Can I carry out all the construction work myself?',
      body:
        'As an insurance company, we want construction and renovations to be carried out professionally '
        + 'and in accordance with applicable building and industry regulations. However, there are certain '
        + 'jobs where it may be more appropriate to hire a qualified contractor to carry out the work, such '
        + 'as plumbing work and electrical installations.',
      ctaLabel: 'Read more about electrical installations at home',
      intent: 'neutral',
    },
    {
      type: 'cards',
      heading: 'What are you planning to renovate?',
      cards: [
        { title: 'Renovate the kitchen',
          body: 'Find out what the regulations say and how to eliminate the risk of water damage, so you '
              + 'can renovate your kitchen securely and safely.',
          ctaLabel: 'To renovate kitchen' },
        { title: 'Renovate the bathroom',
          body: 'Renovating a bathroom is a big project that requires careful planning. Read our guides to '
              + 'a successful bathroom renovation.',
          ctaLabel: 'To renovate bathroom' },
        { title: 'Choose a facade cleaner that works',
          body: 'Free use of it in the best products for cleaning facades and plaster, and no better than '
              + 'water. Only five products give satisfactory results.',
          ctaLabel: 'To facade and plastic cleaning' },
      ],
    },
    {
      type: 'callout',
      heading: 'The text has been fact-checked by Bertil Jonsson, Construction Technician',
      body:
        'Bertil is Länsförsäkringar’s construction expert who conveys knowledge about sustainable '
        + 'construction and long-term solutions to reduce future renovation problems.',
      intent: 'info',
    },
    {
      type: 'links',
      heading: 'Related links',
      links: [
        { label: 'Home insurance' },
        { label: 'Holiday home insurance' },
        { label: 'Home insurance for tenants' },
      ],
    },
  ],
}

async function cmsToken(): Promise<string> {
  const res = await fetch(`${GATEWAY}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.OPTIMIZELY_CMS_CLIENT_ID!,
      client_secret: process.env.OPTIMIZELY_CMS_CLIENT_SECRET!,
    }),
  })
  if (!res.ok) throw new Error(`token ${res.status}`)
  return (await res.json()).access_token
}

const composition = buildBlogComposition(article)
const slug = article.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

console.log(`sections: ${composition.nodes.length}`)
for (const n of composition.nodes as Record<string, unknown>[]) {
  const kinds = ((n.nodes as Record<string, unknown>[]) ?? []).flatMap(r =>
    ((r.nodes as Record<string, unknown>[]) ?? []).flatMap(c =>
      ((c.nodes as Record<string, unknown>[]) ?? []).map(b =>
        ((b.component as Record<string, unknown>).contentType as string))))
  console.log(`  ${String(n.displayName).slice(0, 42).padEnd(44)} ${kinds.join(', ')}`)
}

// --emit writes the composition for a separate publisher to POST. Node's fetch
// cannot resolve the CMS host in some sandboxes; the builder is the part worth
// exercising here, so emitting lets the real output be published by other means.
if (process.argv.includes('--emit')) {
  const { writeFileSync } = await import('node:fs')
  writeFileSync('/tmp/blog_payload.json', JSON.stringify({
    displayName: article.title,
    routeSegment: slug,
    seoDescription: article.intro,
    composition,
  }, null, 2))
  console.log('\nwrote /tmp/blog_payload.json')
  process.exit(0)
}

if (process.argv.includes('--dry-run')) {
  console.log('\n(dry run — nothing written)')
  process.exit(0)
}

const token = await cmsToken()
const res = await fetch(`${GATEWAY}/v1/content`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    contentType: 'BlankExperience',
    container: FOLDER,
    initialVersion: {
      displayName: article.title,
      locale: 'en',
      routeSegment: slug,
      properties: {
        seoTitle: { value: article.title },
        seoDescription: { value: article.intro },
      },
      composition,
    },
  }),
})

if (res.status !== 201) {
  console.error(`\nCMS rejected: ${res.status}`)
  console.error((await res.text()).slice(0, 1200))
  process.exit(1)
}

const key = (res.headers.get('location') || '').replace(/\/$/, '').split('/').pop()
const ver = (res.headers.get('cms-content-version-location') || '').replace(/\/$/, '').split('/').pop()
const pub = await fetch(`${GATEWAY}/v1/content/${key}/versions/${ver}:publish`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: '{}',
})
console.log(`\nCREATED key=${key} v=${ver} publish=${pub.status}  —  /blog/${slug}`)
