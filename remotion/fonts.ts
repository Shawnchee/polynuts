/**
 * Fonts for the demo, loaded via @remotion/google-fonts.
 *
 * loadFont() returns a CSS family name and blocks render until the font is
 * ready, so we call it at module scope and export the families. Mirrors the
 * app's type ramp:
 *   - Bricolage Grotesque → headings / wordmark
 *   - Inter              → body / UI labels
 *   - JetBrains Mono     → numbers (tabular) + URL pill / tx hash
 */
import { loadFont as loadBricolage } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadJetBrains } from '@remotion/google-fonts/JetBrainsMono';

const bricolage = loadBricolage('normal', {
  weights: ['600', '700', '800'],
  subsets: ['latin'],
});
const inter = loadInter('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});
const jetbrains = loadJetBrains('normal', {
  weights: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

export const FONT = {
  display: bricolage.fontFamily,
  body: inter.fontFamily,
  mono: jetbrains.fontFamily,
} as const;
