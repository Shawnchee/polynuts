import type { MetadataRoute } from 'next';

// Link-unfurl / social-card crawlers (X/Twitter, Facebook, Slack, Discord,
// LinkedIn, Telegram, WhatsApp) must be able to fetch the OG share image at
// `/api/win-card`. They honor robots.txt, so a blanket `disallow: ['/api/']`
// makes the card render title + description but a BLANK image (they read the
// page HTML but are told not to fetch the image URL). Give the known card bots
// an explicit group that allows the image route; everyday SEO crawlers still
// keep /api/ out of the index (no SEO value + avoids indexing the renderer).
const CARD_CRAWLERS = [
  'Twitterbot',
  'facebookexternalhit',
  'Facebot',
  'Slackbot-LinkExpanding',
  'Slackbot',
  'Discordbot',
  'LinkedInBot',
  'TelegramBot',
  'WhatsApp',
];

// Public marketing + market pages are indexable. Sensitive/private API routes,
// the admin panel, and the geo-block landing page add no SEO value and are kept
// out of the index. Note: a robots-compliant crawler obeys only its most
// specific matching user-agent group, so the card bots below use ONLY their own
// rules — the `*` group's /api/ block does not apply to them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin', '/not-available'],
      },
      {
        userAgent: CARD_CRAWLERS,
        // Allow the page HTML + the share-image route; still keep the private
        // endpoints and admin out of reach even for these bots.
        allow: ['/', '/api/win-card'],
        disallow: ['/api/admin', '/api/me', '/api/cron', '/admin', '/not-available'],
      },
    ],
    host: 'https://polynuts.xyz',
    sitemap: 'https://polynuts.xyz/sitemap.xml',
  };
}
