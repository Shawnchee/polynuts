import type { MetadataRoute } from 'next';

// Public marketing + market pages are indexable. API routes (including the
// dynamic /api/win-card share-image renderer) and the geo-block landing page
// add no SEO value and are kept out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/not-available'],
    },
    host: 'https://polynuts.xyz',
    sitemap: 'https://polynuts.xyz/sitemap.xml',
  };
}
