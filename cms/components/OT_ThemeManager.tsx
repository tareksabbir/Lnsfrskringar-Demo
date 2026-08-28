import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { buildThemeCSS } from '@/lib/optimizely'
import ThemePreviewContent from '@/components/theme/ThemePreviewContent'

type Props = { content: any }

// Scope the token overrides to the preview container so they don't bleed
// into the surrounding CMS shell. CSS custom properties cascade into all
// descendants, so bg-brand / text-brand / bloom tokens all update correctly.
function buildScopedPreviewCSS(settings: any): string {
  const css = buildThemeCSS(settings)
  if (!css) return ''
  return css
    .replace(/:root\s*\{/g, '#ot-theme-preview {')
    .replace(/\[data-theme="light"\]\s*\{/g, '#ot-theme-preview[data-theme="light"] {')
}

export default function OT_ThemeManagerAdapter({ content }: Props) {
  const { pa } = getPreviewUtils(content)
  const defaultMode = (content?.defaultMode as string | undefined) === 'light' ? 'light' : 'dark'
  const previewCSS  = buildScopedPreviewCSS(content)

  return (
    <div
      id="ot-theme-preview"
      {...pa(content.__composition)}
      className="min-h-screen bg-canvas"
      data-theme={defaultMode}
    >
      {previewCSS && (
        <style dangerouslySetInnerHTML={{ __html: previewCSS }} />
      )}
      <div className="border-b border-fg/10 px-md py-sm bg-surface flex items-center gap-md">
        <span className="text-label tracking-label uppercase font-semibold text-brand">Theme Manager Preview</span>
        <span className="text-label text-fg-muted">Updates when you save in the CMS editor</span>
        <span className="ml-auto text-label text-fg-muted/60 font-mono capitalize">{defaultMode} mode</span>
      </div>
      <ThemePreviewContent settings={content} />
    </div>
  )
}
