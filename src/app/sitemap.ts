import type { MetadataRoute } from 'next';

// Base URL must match robots.ts (host: https://polynuts.xyz). Overridable so a
// preview/staging deploy can advertise its own origin.
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://polynuts.xyz';

// Public, indexable pages only — mirrors the allow-list in robots.ts. The
// geo-block landing page and API routes are intentionally excluded.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: { path: string; priority: number; changeFrequency: 'hourly' | 'daily' }[] = [
    { path: '', priority: 1, changeFrequency: 'hourly' },
    { path: '/leaderboard', priority: 0.7, changeFrequency: 'daily' },
    { path: '/portfolio', priority: 0.5, changeFrequency: 'daily' },
    { path: '/activity', priority: 0.5, changeFrequency: 'daily' },
  ];

  return routes.map(({ path, priority, changeFrequency }) => ({
    url: `${BASE_URL}${path}`,
    lastModified,
    changeFrequency,
    priority,
  }));
}
