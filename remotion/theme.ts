/**
 * Brand tokens for the Polynuts demo composition.
 *
 * Remotion renders in its own webpack bundle with NO access to the app's
 * Tailwind config or CSS custom properties, so every color/size the video
 * uses is hardcoded here. Values mirror the dark-theme tokens defined in
 * `tailwind.config.ts` + `src/app/globals.css` so the video reads as a real
 * screen-capture of the app, not a separate design.
 */
export const C = {
  // Surfaces — exact dark tokens from globals.css [data-theme='dark']
  appBg: '#131720', // --bg  (deep slate, not black)
  windowBg: '#0e1119', // titlebar/frame backdrop (matches HeroAppPreview)
  card: '#1E2432', // --bg-elev (card surface)
  cardDeep: '#181C27', // --bg-subtle (section dividers / nested panels)
  surface: '#262D3D', // --surface (panels, inputs)
  surfaceHover: '#2F384B', // --surface-hover

  // Frame chrome lines — kept as subtle rgba over the dark bg to match the
  // landing's HeroAppPreview titlebar (border-white/[0.06] etc.).
  line: 'rgba(255,255,255,0.06)',
  lineStrong: 'rgba(255,255,255,0.09)',
  lineFaint: 'rgba(255,255,255,0.04)',

  // The app's real semantic --line (#323C51). Used by in-app surfaces
  // (market cards, trade panel, position card) so they match the real
  // `border-line` exactly rather than the lighter frame-chrome rgba.
  lineToken: '#323C51',

  // Text
  text: '#EDF0F6', // --text
  muted: '#A1AABC', // --text-muted
  dim: '#747C8E', // --text-dim

  // Accent + semantic — DARK-theme variants (the .dark / [data-theme='dark']
  // token values), so green/rose/violet read identically to the live app.
  accent: '#60A5FA', // brand-dark / blue-400
  pump: '#22C55E', // pump-dark
  dump: '#F43F5E', // dump-dark
  range: '#A78BFA', // range-dark
  gold: '#F59E0B', // gold

  // Tints for fills (direction-colored chips/bars)
  pumpFill: 'rgba(34,197,94,0.16)',
  pumpBorder: 'rgba(34,197,94,0.40)',
  dumpFill: 'rgba(244,63,94,0.16)',
  dumpBorder: 'rgba(244,63,94,0.40)',
  rangeFill: 'rgba(167,139,250,0.16)',
  rangeBorder: 'rgba(167,139,250,0.40)',
  accentFill: 'rgba(96,165,250,0.14)',
} as const;

export const RADIUS = {
  // Mirror the app's borderRadius scale (tailwind.config.ts):
  //   sm 6 · md 10 · lg 14 · xl 18 · 2xl 24
  window: 18, // rounded-xl — cards, panels, window frame
  lg: 14, // rounded-lg — hero payout box
  card: 10, // rounded-md — CTA pills, badges, inputs
  chip: 8,
  sm: 6,
  pill: 999,
} as const;
