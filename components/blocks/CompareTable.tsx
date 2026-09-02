import { cva } from 'class-variance-authority'
import { Check, Minus } from 'lucide-react'

/**
 * CompareTable — a feature matrix: one row per feature, one column per plan.
 *
 * Separate from OT_ComparisonTableBlock because that block cannot be placed in a
 * composition at all. It holds arrays of components, which bars it from being
 * `elementEnabled`, and a `_component` is refused as a section's component. See
 * OT_CompareTable for the full reasoning.
 *
 * The grid arrives as a FLAT array in row-major order rather than a nested one,
 * for the same reason: an `elementEnabled` type may hold arrays of strings but
 * not arrays of components. `columnLabels.length` is what makes the flat list a
 * grid again.
 */

export type CompareTableStyleOptions = {
  color?: 'canvas' | 'surface'
}

type Props = {
  headline?: string
  intro?: string
  columnLabels: string[]
  rowLabels: string[]
  /** Row-major: cell (r, c) is cells[r * columnLabels.length + c]. */
  cells: string[]
  styleOptions?: CompareTableStyleOptions
}

const sectionCva = cva('w-full px-md py-xl lg:px-lg', {
  variants: {
    color: { canvas: 'bg-canvas', surface: 'bg-surface' },
  },
  defaultVariants: { color: 'surface' },
})

/**
 * "yes" / "no" render as marks; anything else prints as text, so a cell can say
 * "Optional" or "500 SEK" without needing another content type.
 */
function Cell({ value }: { value: string }) {
  const v = value.trim().toLowerCase()

  if (v === 'yes' || v === 'true' || v === '✓') {
    return (
      <>
        <Check aria-hidden="true" className="mx-auto size-5 text-brand" strokeWidth={2.5} />
        <span className="sr-only">Included</span>
      </>
    )
  }
  if (v === 'no' || v === 'false' || v === '-' || v === '') {
    return (
      <>
        <Minus aria-hidden="true" className="mx-auto size-5 text-fg-muted/40" strokeWidth={2.5} />
        <span className="sr-only">Not included</span>
      </>
    )
  }
  return <span className="text-body">{value}</span>
}

export default function CompareTable({
  headline,
  intro,
  columnLabels,
  rowLabels,
  cells,
  styleOptions = {},
}: Props) {
  const { color = 'surface' } = styleOptions
  const cols = columnLabels.length

  if (!cols || !rowLabels.length) return null

  return (
    <section className={sectionCva({ color })}>
      <div className="mx-auto w-full max-w-5xl">
        {headline && (
          <h2 className="text-headline font-bold leading-headline tracking-headline text-brand">
            {headline}
          </h2>
        )}
        {intro && <p className="mt-sm max-w-(--ot-measure) leading-body text-fg">{intro}</p>}

        {/* Horizontal scroll lives on the wrapper, not the page: a matrix this
            wide cannot reflow on a phone, and the alternative is a body that
            scrolls sideways. */}
        <div className="mt-lg overflow-x-auto rounded-ot-surface bg-canvas">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-fg/10">
                {/* Empty corner cell — the row labels have no column heading of
                    their own, and inventing one ("Feature") would show in every
                    screen reader's table summary. */}
                <th scope="col" className="px-md py-sm" />
                {columnLabels.map(label => (
                  <th
                    key={label}
                    scope="col"
                    className="px-md py-sm text-center text-label font-semibold leading-title text-brand"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rowLabels.map((rowLabel, r) => (
                <tr key={rowLabel} className="border-b border-fg/10 last:border-b-0">
                  <th
                    scope="row"
                    className="px-md py-sm text-left font-normal leading-title text-fg"
                  >
                    {rowLabel}
                  </th>
                  {Array.from({ length: cols }, (_, c) => (
                    <td key={c} className="px-md py-sm text-center">
                      {/* Missing cells read as "not included" rather than
                          throwing, so a short array degrades instead of
                          breaking the page. */}
                      <Cell value={cells[r * cols + c] ?? ''} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
