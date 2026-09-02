'use client'

/**
 * FaqAccordion — the LF product-page FAQ.
 *
 * Separate from AccordionBlock rather than another variant of it. That block's
 * three border styles all draw a bordered box around dark-on-light text, which
 * is a different pattern from what LF uses: each question is a white card on a
 * grey band, the question itself is brand blue and bold, and an open card keeps
 * a brand rule between its question and its answer. Bending AccordionBlock into
 * that shape would have meant a fourth border style plus colour overrides on
 * every part, for a look the other three never want.
 *
 * Built on Radix Accordion for the same reason AccordionBlock is: roving focus,
 * Home/End, aria-expanded and the trigger/panel wiring come for free and are
 * easy to get subtly wrong by hand.
 *
 * No item cap. AccordionBlock silently drops anything past twelve, which is a
 * quiet way to lose content; the LF FAQ has fifteen questions.
 */

import * as RadixAccordion from '@radix-ui/react-accordion'
import { cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

export type FaqItem = {
  question: string
  /** Blank lines split the answer into paragraphs. */
  answer: string
}

export type FaqAccordionStyleOptions = {
  color?: 'canvas' | 'surface' | 'brand'
  openMode?: 'single' | 'multiple'
  defaultOpen?: boolean
}

type Props = {
  eyebrow?: string
  headline?: string
  items: FaqItem[]
  styleOptions?: FaqAccordionStyleOptions
}

const sectionCva = cva('w-full px-md py-xl lg:px-lg', {
  variants: {
    color: {
      canvas: 'bg-canvas',
      surface: 'bg-surface',
      brand: 'bg-brand',
    },
  },
  defaultVariants: { color: 'surface' },
})

const headlineCva = cva(
  'text-headline font-bold leading-headline tracking-headline mb-lg',
  {
    variants: {
      color: {
        canvas: 'text-brand',
        surface: 'text-brand',
        brand: 'text-fg-on-brand',
      },
    },
    defaultVariants: { color: 'surface' },
  },
)

export default function FaqAccordion({
  eyebrow,
  headline,
  items,
  styleOptions = {},
}: Props) {
  const { color = 'surface', openMode = 'single', defaultOpen = false } = styleOptions

  if (!items.length) return null

  // Radix needs a stable value per item. The index is stable here because the
  // list is server-rendered from CMS order and never reordered client-side.
  const firstValue = 'faq-0'

  const rows = items.map((item, i) => (
    <RadixAccordion.Item
      key={`${item.question}-${i}`}
      value={`faq-${i}`}
      // A card per question, with the fill inside the radius. `overflow-hidden`
      // is load-bearing: without it the open trigger's rule and hover fill
      // square off the rounded corners.
      className="mb-sm overflow-hidden rounded-ot-surface bg-canvas last:mb-0"
    >
      <RadixAccordion.Header>
        <RadixAccordion.Trigger
          className={cn(
            'group flex w-full items-center justify-between gap-md',
            'px-lg py-md text-left',
            'text-brand font-bold leading-title',
            'transition-colors duration-150 ease-quick motion-reduce:transition-none',
            'hover:bg-brand/4',
            'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand',
            // The rule under an open question, exactly as the reference has it.
            'data-[state=open]:border-b-2 data-[state=open]:border-brand',
          )}
        >
          <span>{item.question}</span>
          {/* Chevron drawn from two borders rather than an icon import, so it
              inherits currentColor and scales with the text. Rotation is a
              transform — never a layout property — and is dropped under
              reduced motion. */}
          <span
            aria-hidden="true"
            className={cn(
              'size-[0.5em] shrink-0',
              'border-r-2 border-b-2 border-current',
              // Arbitrary values on purpose: 135deg is not in Tailwind's rotate
              // scale, and the negative variant does not exist at all.
              'rotate-[45deg]',
              'transition-transform duration-150 ease-quick motion-reduce:transition-none',
              'group-data-[state=open]:rotate-[-135deg]',
            )}
          />
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>

      <RadixAccordion.Content className="px-lg pt-md pb-md text-fg">
        {item.answer
          .split('\n\n')
          .map(p => p.trim())
          .filter(Boolean)
          .map((p, j) => (
            <p key={j} className="mb-md leading-body last:mb-0">
              {p}
            </p>
          ))}
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  ))

  return (
    <section className={sectionCva({ color })}>
      <div className="mx-auto w-full max-w-4xl">
        {eyebrow && (
          <p className="text-label font-semibold uppercase tracking-label text-brand mb-xs">
            {eyebrow}
          </p>
        )}
        {headline && <h2 className={headlineCva({ color })}>{headline}</h2>}

        {openMode === 'multiple' ? (
          <RadixAccordion.Root
            type="multiple"
            defaultValue={defaultOpen ? [firstValue] : []}
          >
            {rows}
          </RadixAccordion.Root>
        ) : (
          <RadixAccordion.Root
            type="single"
            collapsible
            defaultValue={defaultOpen ? firstValue : undefined}
          >
            {rows}
          </RadixAccordion.Root>
        )}
      </div>
    </section>
  )
}
