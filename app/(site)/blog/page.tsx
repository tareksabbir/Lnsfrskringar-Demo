import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getBlogIndex, type BlogIndexPost } from '@/lib/blogIndex'
import { getRequestLocale } from '@/lib/optimizely'

/**
 * /blog — the index the articles were missing.
 *
 * Articles live in a CMS FOLDER (Root > Blog). A folder contributes its segment
 * to a child's URL but is not itself a page, so /blog answered 404 while
 * /blog/<article> worked. Every article the Opal tool writes was reachable only
 * by knowing its exact URL.
 *
 * This is a code route rather than a CMS experience carrying OT_BlogFeedBlock,
 * for two reasons:
 *   - that block queries OT_BlogPage, and these articles are BlankExperience
 *     documents (see lib/blogIndex.ts), so it would have listed nothing;
 *   - a listing that derives itself from Graph needs no authoring step, so a new
 *     article appears here the moment it is published — including one Opal wrote
 *     while nobody was watching.
 *
 * The trade-off, stated plainly: this page is NOT editable in Visual Builder.
 * The articles it links to still are. If the index itself ever needs to be
 * authored, the replacement is a CMS experience whose feed block queries
 * BlankExperience.
 */

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return {
    title: 'Blog',
    description: 'Guides, tips and advice from Länsförsäkringar Stockholm.',
    alternates: siteUrl ? { canonical: `${siteUrl}/blog` } : undefined,
  }
}

function formatDate(iso: string | null, locale: string): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  try {
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric', month: 'long', day: 'numeric',
    }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

function ArticleCard({ post, locale }: { post: BlogIndexPost; locale: string }) {
  const date = formatDate(post.published, locale)

  return (
    <li className="h-full">
      <Link
        href={post.path}
        className="group flex h-full flex-col overflow-hidden rounded-[var(--ot-radius-surface)]
                   border border-fg/10 bg-surface transition-colors duration-200
                   hover:border-brand focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-accent motion-reduce:transition-none"
      >
        {post.imageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden bg-brand-tint">
            <Image
              src={post.imageUrl}
              alt=""
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        ) : (
          // No image is the common case today — the articles carry none yet. A
          // flat brand-tint band keeps the cards the same height instead of
          // leaving a ragged grid.
          <div className="aspect-[16/9] w-full bg-brand-tint" aria-hidden="true" />
        )}

        <div className="flex flex-1 flex-col gap-2 p-5">
          {date && (
            <time
              dateTime={post.published ?? undefined}
              className="text-label uppercase tracking-wide text-fg-muted"
            >
              {date}
            </time>
          )}

          <h2 className="text-subhead font-semibold text-brand group-hover:underline">
            {post.title}
          </h2>

          {post.description && (
            <p className="text-body text-fg-muted line-clamp-3">{post.description}</p>
          )}
        </div>
      </Link>
    </li>
  )
}

export default async function BlogIndexPage() {
  const [posts, locale] = await Promise.all([getBlogIndex(), getRequestLocale()])

  return (
    <div className="mx-auto w-full max-w-[72rem] px-5 py-12 md:py-16">
      <header className="mb-10 max-w-[42rem]">
        <h1 className="text-hero font-bold text-brand">Blog</h1>
        <p className="mt-3 text-body text-fg-muted">
          Guides, tips and advice on insurance, your home and your everyday finances.
        </p>
      </header>

      {posts === null ? (
        // The query failed. Say so rather than implying there is nothing to read
        // — a silent empty grid is how the sitemap bug went unnoticed for weeks.
        <p className="rounded-[var(--ot-radius-surface)] border border-fg/10 bg-surface p-6 text-body text-fg-muted">
          The article list could not be loaded right now. Please try again shortly.
        </p>
      ) : posts.length === 0 ? (
        <p className="rounded-[var(--ot-radius-surface)] border border-fg/10 bg-surface p-6 text-body text-fg-muted">
          No articles have been published yet.
        </p>
      ) : (
        <ul className="grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map(post => (
            <ArticleCard key={post.key} post={post} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  )
}
