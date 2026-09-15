import { isSupportedLocale } from '@/lib/i18n/config'
import { translatedPath } from '@/lib/i18n/translatedPath'

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const from = params.get('from'), to = params.get('to'), path = params.get('path')
  if (!isSupportedLocale(from) || !isSupportedLocale(to) || !path || path.length > 2048) {
    return Response.json({ error: 'Invalid language request.' }, { status: 400 })
  }
  try {
    const destination = await translatedPath(path, from, to)
    return destination
      ? Response.json({ path: destination })
      : Response.json({ error: 'This page is not available in that language.' }, { status: 404 })
  } catch {
    return Response.json({ error: 'Could not switch language. Please try again.' }, { status: 503 })
  }
}
