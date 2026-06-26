// Shared admin-console palette. Kept in a plain module (no 'use client', no
// server-only imports) so both the server shell and the client dashboard can
// import it without dragging either graph into the other's bundle.
//
// The admin console deliberately wears the landing page's dark palette rather
// than the consumer app theme — it reads as a separate internal surface and
// stays legible regardless of the user's light/dark preference.
export const ADMIN_ACCENT = '#60a5fa';
