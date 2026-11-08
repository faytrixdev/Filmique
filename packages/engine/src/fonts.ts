import { loadFont } from '@remotion/fonts';
import { staticFile } from 'remotion';
import { loadFont as loadBricolage } from '@remotion/google-fonts/BricolageGrotesque';
import { loadFont as loadMono } from '@remotion/google-fonts/FragmentMono';
import { loadFont as loadHand } from '@remotion/google-fonts/Kalam';

// Three faces: a heavy display face for the title card, a mono for on-screen readouts (timers, labels, chips),
// and a handwriting face for chalk and notes. The Google faces load at render time (they need a connection);
// a local title face plugged by the host (globalThis.__WHAT_IF_TITLE_FONT__, see studio's brand.ts) loads from
// public/ and works offline.

type LocalFont = null | { family: string; file: string; weight: string };
const titleFont = (globalThis as { __WHAT_IF_TITLE_FONT__?: LocalFont }).__WHAT_IF_TITLE_FONT__ ?? null;

loadBricolage('normal', { weights: ['600', '700', '800'], subsets: ['latin'] });
loadMono('normal', { weights: ['400'], subsets: ['latin'] });
loadHand('normal', { weights: ['400', '700'], subsets: ['latin'] });
if (titleFont) loadFont({ family: titleFont.family, url: staticFile(titleFont.file), weight: titleFont.weight });

export const FONT = {
  title: titleFont ? titleFont.family : 'Bricolage Grotesque',
  ui: 'Fragment Mono',
  hand: 'Kalam',
};
