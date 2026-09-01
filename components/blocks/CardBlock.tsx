import Image from "next/image";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import { ICON_REGISTRY } from "@/components/icons/iconRegistry";
import { RichText } from '@optimizely/cms-sdk/react/richText'

// ─── Style option types ───────────────────────────────────────────────────────

export type CardFill       = "ghost" | "surface" | "brand" | "light" | "glass";
export type CardBorder     = "none" | "subtle" | "brand";
export type CardImageStyle = "top" | "background" | "side" | "float";
export type CardImageSide  = "left" | "right";
export type CardHover      = "none" | "lift" | "glow" | "tilt" | "border";
export type CardDensity    = "compact" | "default" | "spacious";

export type CardAspectRatio      = "auto" | "square" | "portrait" | "landscape" | "wide" | "cinema";
export type CardImageAspectRatio = "auto" | "square" | "portrait" | "landscape" | "wide";
export type CardMinHeight        = "none" | "xs" | "sm" | "md" | "lg";

/**
 * Tile variants, added to reproduce LF's two flat tile shapes without touching
 * the content model (a display-template setting lives in the composition, so it
 * needs no content-type push and no Graph re-index):
 *   stacked — icon centred above a centred label. LF's 8 product tiles.
 *   inline  — icon left, label, arrow far right. Popularly / Quick links / Contact.
 * "none" keeps the normal card (image, body copy, CTA button).
 */
export type CardTile = "none" | "stacked" | "inline";

export type CardStyleOptions = {
  tile?:             CardTile;
  icon?:             string;
  fill?:             CardFill;
  border?:           CardBorder;
  imageStyle?:       CardImageStyle;
  imageSide?:        CardImageSide;
  hover?:            CardHover;
  density?:          CardDensity;
  noise?:            boolean;
  accentLine?:       "none" | "top";
  maxHeight?:        "none" | "sm" | "md" | "lg";
  minHeight?:        CardMinHeight;
  aspectRatio?:      CardAspectRatio;
  imageAspectRatio?: CardImageAspectRatio;
};

export type CardBlockProps = {
  heading:       string;
  headingLevel?: "h2" | "h3" | "h4";
  eyebrow?:      string;
  description?:  Parameters<typeof RichText>[0]['content'] | null;
  image?:        { src: string; alt: string };
  cta?:          { label: string; href: string };
  className?:    string;
  styleOptions?: CardStyleOptions;
  pa?: (prop?: string | { key: string }) => Record<string, string | undefined>;
};

// ─── Color scheme ─────────────────────────────────────────────────────────────

type Scheme = "dark" | "brand" | "light";

function resolveScheme(fill: CardFill, imageStyle: CardImageStyle): Scheme {
  if (imageStyle === "background") return "dark";
  if (fill === "brand") return "brand";
  if (fill === "light") return "light";
  return "dark";
}

// Typography classes keyed by scheme.
// "light" scheme stays a fixed light surface regardless of page theme (a light
// card on a dark section ground): canvas/fg tokens flip with the theme, so they
// can't be used here. Instead the fixed lightness/chroma are kept while the HUE
// is pulled from --ot-brand via relative color syntax — so a CMS rebrand re-tints
// the neutral without flipping it. At the default teal brand (h=195) these
// resolve to the original literals exactly.
const T = {
  eyebrow: {
    dark:  "text-label font-semibold tracking-label uppercase text-fg-muted",
    brand: "text-label font-semibold tracking-label uppercase text-fg-on-brand/60",
    light: "text-label font-semibold tracking-label uppercase text-brand",
  },
  heading: {
    dark:  "text-title font-semibold leading-title tracking-title text-fg",
    brand: "text-title font-semibold leading-title tracking-title text-fg-on-brand",
    // Was a near-black derived from the brand hue; LF sets card titles in the
    // brand navy itself.
    light: "text-title font-semibold leading-title tracking-title text-brand",
  },
  description: {
    dark:  "text-body leading-body text-fg-muted",
    brand: "text-body leading-body text-fg-on-brand/80",
    light: "text-body leading-body text-[oklch(from_var(--ot-brand)_0.20_0.022_h)]",
  },
  cta: {
    dark:  "brand" as const,
    brand: "ghost"  as const,
    light: "brand" as const,
  },
} as const;

// ─── Fill and border helpers ──────────────────────────────────────────────────

const FILL_CLASS: Record<CardFill, string> = {
  ghost:   "bg-transparent",
  surface: "bg-surface",
  brand:   "bg-brand",
  light:   "bg-[oklch(from_var(--ot-brand)_0.97_0.005_h)]",
  // True glassmorphism: bg-glass provides the exact recipe (rgba white tint, blur+saturate,
  // full border, box-shadow with inset shimmer, and ::before surface sheen).
  glass:   "bg-glass",
};

function resolveBorder(fill: CardFill, border: CardBorder): string {
  // Glass: bg-glass already sets a token-derived border (--ot-fg @ 0.20) and the inset shimmer.
  // Don't add a Tailwind border that would fight it — only allow brand border override.
  if (fill === "glass") {
    return border === "brand" ? "border-brand" : "";
  }

  if (border === "none") return "";
  if (border === "brand") {
    return fill === "brand" ? "border border-fg-on-brand/30" : "border border-brand";
  }
  // subtle — adapts to fill context
  if (fill === "brand") return "border border-fg-on-brand/20";
  if (fill === "light") return "border border-canvas/10";
  return "border border-fg/10"; // ghost + surface
}

// ─── Hover ────────────────────────────────────────────────────────────────────

// Lift/glow classes reference .card-hover-lift and .card-hover-glow in globals.css
// which use --ot-bloom-brand and --ot-bloom-accent so they follow the CMS theme override.
const HOVER_CLASS: Record<CardHover, string> = {
  none:   "",
  lift:   "card-hover-lift",
  glow:   "card-hover-glow",
  tilt:   "card-hover-tilt",
  // Colours the existing hairline to brand and lifts the ground a touch. It
  // recolours a border that is already there rather than adding one, so nothing
  // reflows on hover — adding a border on hover would shift every card by 1px.
  border: "card-hover-border",
};

// ─── Density ─────────────────────────────────────────────────────────────────

const DENSITY_CLASS: Record<CardDensity, string> = {
  compact:  "p-md",
  default:  "p-lg",
  spacious: "p-xl",
};

const MIN_H_CLASS: Record<CardMinHeight, string> = {
  none: "",
  xs:   "min-h-[200px]",
  sm:   "min-h-[280px]",
  md:   "min-h-[380px]",
  lg:   "min-h-[480px]",
};

const ASPECT_CLASS: Record<CardAspectRatio, string> = {
  auto:      "",
  square:    "aspect-square",
  portrait:  "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  wide:      "aspect-video",
  cinema:    "aspect-[21/9]",
};

const IMG_ASPECT_CLASS: Record<CardImageAspectRatio, string> = {
  auto:      "",
  square:    "aspect-square",
  portrait:  "aspect-[3/4]",
  landscape: "aspect-[4/3]",
  wide:      "aspect-video",
};

// ─── Noise texture ────────────────────────────────────────────────────────────

// SVG feTurbulence grain — rendered at a fixed tile size and tiled via background-repeat.
// mix-blend-mode: overlay adds grain without darkening or lightening the surface.
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")";

// ─── Component ───────────────────────────────────────────────────────────────

const IMG_SIZES = "(min-width: 1024px) 400px, (min-width: 768px) 50vw, 100vw";

/** The thin navy arrow LF puts at the right edge of every link tile. */
function ArrowRightIcon() {
  const Arrow = ICON_REGISTRY["arrowRight"];
  return Arrow
    ? <Arrow className="h-5 w-5 shrink-0 text-brand transition-transform duration-150 ease-quick group-hover:translate-x-0.5" strokeWidth={1.5} aria-hidden />
    : null;
}

export default function CardBlock({
  heading,
  headingLevel   = "h3",
  eyebrow,
  description,
  image,
  cta,
  className,
  styleOptions = {},
  pa = () => ({}),
}: CardBlockProps) {
  const {
    fill             = "surface",
    border           = "none",
    tile             = "none",
    icon             = "none",
    imageStyle       = "top",
    imageSide        = "left",
    hover            = "none",
    density          = "default",
    noise            = false,
    accentLine       = "none",
    maxHeight        = "none",
    minHeight        = "none",
    aspectRatio      = "auto",
    imageAspectRatio = "auto",
  } = styleOptions;

  const s        = resolveScheme(fill, imageStyle);
  const Tag      = headingLevel;
  const isBg     = imageStyle === "background";
  const isSide   = imageStyle === "side";
  const isFloat  = imageStyle === "float";
  const isHover  = hover !== "none";
  const padding  = DENSITY_CLASS[density];

  const MAX_H: Record<NonNullable<CardStyleOptions["maxHeight"]>, string> = {
    none: "",
    sm:   "max-h-[320px]",
    md:   "max-h-[480px]",
    lg:   "max-h-[640px]",
  };

  // Accent line uses --ot-accent so it follows the CMS theme override.
  const accentStyle = accentLine === "top"
    ? { borderTop: fill === "brand" ? "3px solid oklch(from var(--ot-fg-on-brand) l c h / 0.4)" : "3px solid var(--ot-accent)" }
    : undefined;

  // Float content needs an explicit background to visually slide over the image.
  // Ghost/glass fall back to canvas so text stays readable.
  const floatContentBg = (fill === "ghost" || fill === "glass") ? "bg-canvas" : FILL_CLASS[fill];

  const rootClass = cn(
    // Corner Style axis (surface radius). Sharp = 0px default → unchanged today.
    // overflow-hidden already clips the image/scrim to the rounded corner.
    "relative h-full overflow-hidden rounded-ot-surface",
    FILL_CLASS[fill],
    resolveBorder(fill, border),
    isHover && "group cursor-pointer",
    HOVER_CLASS[hover],
    isSide
      ? cn("flex flex-col md:flex-row", imageSide === "right" && "md:flex-row-reverse")
      : "flex flex-col",
    isBg && "min-h-[320px]",
    MAX_H[maxHeight],
    MIN_H_CLASS[minHeight],
    ASPECT_CLASS[aspectRatio],
    className
  );

  // Image zoom on hover: motion-safe prefix respects prefers-reduced-motion
  const imgClass = cn(
    "object-cover",
    isHover && !isBg && "motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-[var(--ease-kinetic)] motion-safe:group-hover:scale-105"
  );

  // HOVER_CLASS belongs here too. The tile variants short-circuit the full card
  // and build their own root, so they silently ignored the Hover effect setting —
  // an editor could pick one and nothing at all would happen.
  const tileRoot = cn(
    "relative w-full rounded-ot-surface no-underline",
    FILL_CLASS[fill],
    resolveBorder(fill, border),
    HOVER_CLASS[hover],
    className,
  );

  // ── Tile variants ─────────────────────────────────────────────────────────
  // Short-circuit the full card. A tile is a bordered box with an icon and a
  // label — no image, no body copy, no CTA button. The whole box is the link.
  if (tile !== "none") {
    const Icon = icon && icon !== "none" ? ICON_REGISTRY[icon] : undefined;
    const href = cta?.href ?? "#";

    if (tile === "stacked") {
      return (
        <a
          href={href}
          className={cn(tileRoot, "group flex flex-col items-center justify-center gap-sm px-md py-lg text-center min-h-[7.5rem]")}
        >
          {Icon && <Icon className="h-8 w-8 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />}
          <span className="text-[0.9375rem] font-semibold leading-snug text-brand" {...pa('Heading')}>
            {heading}
          </span>
        </a>
      );
    }

    // inline
    return (
      <a
        href={href}
        className={cn(tileRoot, "group flex flex-row items-center gap-sm px-md py-md")}
      >
        {Icon && <Icon className="h-5 w-5 shrink-0 text-brand" strokeWidth={1.5} aria-hidden />}
        <span className="flex-1 text-[0.9375rem] font-semibold leading-snug text-brand" {...pa('Heading')}>
          {heading}
        </span>
        <ArrowRightIcon />
      </a>
    );
  }

  return (
    // data-theme="dark" on background-image cards: the dark scrim is always dark,
    // so text tokens must resolve to light values regardless of the page theme.
    <div className={rootClass} style={accentStyle} {...(isBg ? { 'data-theme': 'dark' } : {})}>

      {/* ── Noise grain overlay ───────────────────────────────────────────────── */}
      {noise && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 mix-blend-overlay opacity-[0.07]"
          style={{ backgroundImage: NOISE_BG }}
        />
      )}

      {/* ── Background image + scrim ─────────────────────────────────────────── */}
      {isBg && image && (
        <>
          <div className="absolute inset-0" {...pa('image')}>
            <Image
              src={image.src}
              alt={image.alt}
              fill
              sizes={IMG_SIZES}
              className="object-cover"
            />
          </div>
          {/* Grounding gradient: a gentle full-card wash so the bottom edge isn't a
              hard photo cut. The legibility floor is the .card-bg-frost panel behind
              the text (below) — this layer just compounds with it. */}
          <div
            className="absolute inset-0 z-1"
            style={{
              background:
                "linear-gradient(to top, oklch(from var(--ot-canvas) l c h / 0.6) 0%, oklch(from var(--ot-canvas) l c h / 0.22) 50%, transparent 100%)",
            }}
          />
        </>
      )}

      {/* ── Top image ─────────────────────────────────────────────────────────── */}
      {imageStyle === "top" && image && (
        <div className={cn("relative w-full shrink-0 overflow-hidden", imageAspectRatio !== "auto" ? IMG_ASPECT_CLASS[imageAspectRatio] : "aspect-4/3 max-h-100")} {...pa('image')}>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={IMG_SIZES}
            className={imgClass}
          />
        </div>
      )}

      {/* ── Float image ───────────────────────────────────────────────────────── */}
      {isFloat && image && (
        <div className={cn("relative w-full shrink-0 overflow-hidden", imageAspectRatio !== "auto" ? IMG_ASPECT_CLASS[imageAspectRatio] : "aspect-3/2 max-h-90")} {...pa('image')}>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes={IMG_SIZES}
            className={imgClass}
          />
        </div>
      )}

      {/* ── Side image ────────────────────────────────────────────────────────── */}
      {isSide && image && (
        <div className={cn("relative w-full md:aspect-auto md:w-2/5 shrink-0 overflow-hidden", imageAspectRatio !== "auto" ? IMG_ASPECT_CLASS[imageAspectRatio] : "aspect-[4/3]")} {...pa('image')}>
          <Image
            src={image.src}
            alt={image.alt}
            fill
            sizes="(min-width: 768px) 200px, 100vw"
            className={imgClass}
          />
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────────── */}
      {isBg ? (
        // Background: content box sizes to its content and anchors to the bottom
        // (mt-auto). The frost panel fills this box only — the legibility tint
        // hugs the text, leaving the upper photo crisp. Text wrapper is relative
        // so it paints above the frost.
        <div className={cn("relative z-2 mt-auto flex flex-col", padding)}>
          <div aria-hidden className="absolute inset-0 card-bg-frost" />
          <div className="relative flex flex-col gap-sm">
            {eyebrow && <p className={T.eyebrow[s]} {...pa('Eyebrow')}>{eyebrow}</p>}
            <Tag className={T.heading[s]} {...pa('Heading')}>{heading}</Tag>
            {/* Brighter than the muted dark-scheme body: text sits over a photo,
                so it needs more luminance to clear AA against the frosted floor. */}
            {description && <div className="card-rich text-body leading-body text-fg/85" {...pa('Description')}><RichText content={description} /></div>}
            {cta && (
              <div className="pt-xs" {...pa('ctaLabel')}>
                <Button variant={T.cta[s]} size="sm" href={cta.href}>{cta.label}</Button>
              </div>
            )}
          </div>
        </div>
      ) : isFloat ? (
        // Float: content panel is horizontally inset (mx-md) so card fill is visible on
        // the sides and bottom, making the panel read as a distinct elevated surface.
        // Border + shadow are fully bloom-token derived so they follow CMS theme overrides.
        // The inset top-edge shimmer (same pattern as bg-glass) reads as a raised surface.
        <div
          className={cn("relative z-10 flex flex-col flex-1 -mt-16 mx-md mb-md rounded-ot-surface", floatContentBg, padding)}
          style={{
            border: `1px solid ${s === 'brand' ? 'oklch(from var(--ot-fg-on-brand) l c h / 0.18)' : 'var(--ot-bloom-brand-border)'}`,
            boxShadow: '0 -12px 36px var(--ot-bloom-brand-faint), 0 -2px 6px var(--ot-bloom-brand-border), 0 8px 24px var(--ot-bloom-brand-faint), 0 2px 6px var(--ot-bloom-brand-border), inset 0 1px 0 oklch(from var(--ot-fg) l c h / 0.10)',
          }}
        >
          <div className="flex flex-col gap-sm flex-1">
            {eyebrow && <p className={T.eyebrow[s]} {...pa('Eyebrow')}>{eyebrow}</p>}
            <Tag className={T.heading[s]} {...pa('Heading')}>{heading}</Tag>
            {description && <div className={cn("card-rich", T.description[s])} data-scheme={s} {...pa('Description')}><RichText content={description} /></div>}
          </div>
          {cta && (
            <div className="mt-md" {...pa('ctaLabel')}>
              <Button variant={T.cta[s]} size="sm" href={cta.href}>{cta.label}</Button>
            </div>
          )}
        </div>
      ) : (
        // Top / Side: content group expands; CTA stays at the bottom
        <div className={cn("flex flex-col flex-1", padding)}>
          <div className="flex flex-col gap-sm flex-1">
            {eyebrow && <p className={T.eyebrow[s]} {...pa('Eyebrow')}>{eyebrow}</p>}
            <Tag className={T.heading[s]} {...pa('Heading')}>{heading}</Tag>
            {description && <div className={cn("card-rich", T.description[s])} data-scheme={s} {...pa('Description')}><RichText content={description} /></div>}
          </div>
          {cta && (
            <div className="mt-md" {...pa('ctaLabel')}>
              <Button variant={T.cta[s]} size="sm" href={cta.href}>{cta.label}</Button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
