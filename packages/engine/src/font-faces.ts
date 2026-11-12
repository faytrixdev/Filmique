// Pure font constants — no remotion imports. The compose chain (LLM draft →
// storyboard archetypes) imports widgets, which needs FONT but must stay
// serverless-safe (Remotion's React.createContext is undefined in RSC bundles).
// Font loading lives in fonts.ts (render-time only).

type LocalFont = null | { family: string; file: string; weight: string };
const titleFont = (globalThis as { __WHAT_IF_TITLE_FONT__?: LocalFont }).__WHAT_IF_TITLE_FONT__ ?? null;

export const FONT = {
  title: titleFont ? titleFont.family : 'Bricolage Grotesque',
  ui: 'Fragment Mono',
  hand: 'Kalam',
};
