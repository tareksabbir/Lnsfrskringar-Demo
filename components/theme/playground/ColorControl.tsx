'use client'

import { useMemo } from 'react'
import { oklchToHex, hexToOklch } from '@/lib/oklch'

// One editable color: a native hex picker (quick grab, sRGB-clamped) sitting
// next to the authoritative OKLCH text field. The picker writes a clean oklch()
// string back; the text field accepts any value and lets CSS validate it.
export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (next: string) => void
}) {
  const hex = useMemo(() => oklchToHex(value) ?? '#808080', [value])
  const id = `color-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`

  return (
    <div className="flex items-center gap-sm">
      <label htmlFor={id} className="text-label text-fg-muted flex-1 min-w-0 truncate">
        {label}
      </label>

      {/* Native picker — styled as a small square chip. Shows the true OKLCH
          value as its border-backing so out-of-sRGB colors still read right. */}
      <span
        className="relative h-7 w-7 shrink-0 overflow-hidden rounded-ot-control border border-fg/15"
        style={{ backgroundColor: value }}
        aria-hidden
      >
        <input
          id={id}
          type="color"
          value={hex}
          onChange={(e) => onChange(hexToOklch(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          title={`Pick ${label} color`}
        />
      </span>

      <input
        type="text"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        className="w-44 shrink-0 bg-canvas border border-fg/15 rounded-input px-sm py-1 font-mono text-[0.7rem] text-fg focus:border-brand focus:outline-none"
        aria-label={`${label} OKLCH value`}
      />
    </div>
  )
}
