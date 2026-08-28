/**
 * OKLCH ↔ sRGB-hex conversion (Björn Ottosson's OKLab matrices).
 *
 * Used by the theme playground's hybrid color control: the OKLCH string stays the
 * source of truth (full P3 gamut, matches the token system), while hex is a
 * convenience for the native <input type="color"> swatch. Round-tripping through
 * hex clamps to sRGB, so the OKLCH field — not the picker — is authoritative.
 *
 * No runtime dependency: the math is small and exact enough for a preview tool.
 */

export type Oklch = { l: number; c: number; h: number } // l is 0–1

// ── Parsing / formatting ──────────────────────────────────────────────────────

function parsePart(raw: string, isLightness: boolean): number | null {
  const s = raw.trim()
  if (s.endsWith('%')) {
    const v = parseFloat(s)
    return Number.isNaN(v) ? null : v / 100
  }
  const v = parseFloat(s)
  if (Number.isNaN(v)) return null
  // Lightness without a unit is 0–1; CMS authors it as a percentage, so a bare
  // value > 1 is almost certainly a percent that lost its sign.
  if (isLightness && v > 1) return v / 100
  return v
}

/** Parse an `oklch(L% C H)` string (or a #rrggbb hex) into normalized components. */
export function parseOklch(input: string): Oklch | null {
  const trimmed = input.trim()
  const m = trimmed.match(/^oklch\(\s*([^)]+)\)$/i)
  if (!m) {
    if (/^#?[0-9a-f]{6}$/i.test(trimmed)) return hexToOklchObj(trimmed)
    return null
  }
  const parts = m[1].split('/')[0].trim().split(/[\s,]+/) // drop any "/ alpha"
  if (parts.length < 3) return null
  const l = parsePart(parts[0], true)
  const c = parsePart(parts[1], false)
  const h = parsePart(parts[2], false)
  if (l == null || c == null || h == null) return null
  return { l, c, h }
}

const trim = (n: number) => String(parseFloat(n.toFixed(4)))

export function formatOklch({ l, c, h }: Oklch): string {
  return `oklch(${trim(l * 100)}% ${trim(c)} ${trim(h)})`
}

// ── Conversion ────────────────────────────────────────────────────────────────

const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const toGamma = (x: number) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055)
const toLinear = (x: number) => (x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))

function oklchToLinearSrgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180
  const a = c * Math.cos(hr)
  const b = c * Math.sin(hr)

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.291485548 * b

  const L = l_ ** 3
  const M = m_ ** 3
  const S = s_ ** 3

  return [
    4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
    -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
    -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S,
  ]
}

function hexToOklchObj(hex: string): Oklch {
  const h = hex.replace('#', '')
  const r = toLinear(parseInt(h.slice(0, 2), 16) / 255)
  const g = toLinear(parseInt(h.slice(2, 4), 16) / 255)
  const b = toLinear(parseInt(h.slice(4, 6), 16) / 255)

  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_

  const c = Math.sqrt(A * A + B * B)
  let hue = (Math.atan2(B, A) * 180) / Math.PI
  if (hue < 0) hue += 360
  return { l: L, c, h: hue }
}

/** OKLCH string → #rrggbb (clamped to sRGB). Returns null if the input won't parse. */
export function oklchToHex(input: string): string | null {
  const o = parseOklch(input)
  if (!o) return null
  const [r, g, b] = oklchToLinearSrgb(o)
  const channel = (v: number) =>
    Math.round(clamp01(toGamma(v)) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

/** #rrggbb → `oklch(L% C H)` string. */
export function hexToOklch(hex: string): string {
  return formatOklch(hexToOklchObj(hex))
}
