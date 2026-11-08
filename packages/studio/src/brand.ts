import { STUDIO } from './studio.config';

// The engine reads the optional local title font from here, set before it loads.
(globalThis as { __WHAT_IF_TITLE_FONT__?: unknown }).__WHAT_IF_TITLE_FONT__ = STUDIO.titleFont ?? null;
