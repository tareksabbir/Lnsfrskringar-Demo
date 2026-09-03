import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Point next-intl at our server config so getLocale() works in any
// server component or route handler without the [locale] folder pattern.
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Derive the CMS hostname from the configured URL so next/image can fetch
// media assets from that origin without relying solely on the wildcard pattern.
function cmsHostname(): string | undefined {
  const url = process.env.OPTIMIZELY_CMS_URL ?? ''
  try {
    return url ? new URL(url).hostname : undefined
  } catch {
    return undefined
  }
}

const cms = cmsHostname()

const nextConfig: NextConfig = {
  images: {
    // Use a custom loader so image delivery does NOT depend on Vercel's
    // Image Optimization quota (which returns HTTP 402 when capped). See
    // lib/imageLoader.ts. remotePatterns below are retained as documentation
    // of the expected source hosts; they are not consulted by a custom loader.
    loader: "custom",
    loaderFile: "./lib/imageLoader.ts",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        // Wildcard covers any Optimizely SaaS CMS subdomain
        protocol: "https",
        hostname: "*.cms.optimizely.com",
      },
      {
        // DAM / CDN assets that may use a non-cms. subdomain
        protocol: "https",
        hostname: "*.optimizely.com",
      },
      {
        // DAM (CMP) image CDN — images3.cmp.optimizely.com and siblings. Needs
        // its own entry: Next's `*` matches a SINGLE label, so
        // `*.optimizely.com` above does not cover a two-label subdomain.
        protocol: "https",
        hostname: "*.cmp.optimizely.com",
      },
      // Explicitly allow the exact CMS app hostname when available
      ...(cms ? [{ protocol: "https" as const, hostname: cms }] : []),
    ],
  },
  async headers() {
    return [
      {
        // Who is allowed to put this app in an iframe.
        //
        //   *.cms.optimizely.com  — SaaS CMS, for the Visual Builder canvas
        //   *.cmp.optimizely.com  — CMP, for the content preview pane
        //   *.welcomesoftware.com — CMP's legacy origin; some tenants still
        //                           serve the app from it, and a preview from
        //                           there fails silently without this entry
        //
        // A `*` matches ONE label, so these three do not overlap. Anything not
        // listed here gets a blank pane and a console error the editor in CMP
        // never sees, so keep the list in step with Optimizely's published
        // domain allowlist.
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.cms.optimizely.com "
              + "https://*.cmp.optimizely.com https://*.welcomesoftware.com",
          },
        ],
      },
    ]
  },
};

export default withNextIntl(nextConfig);
