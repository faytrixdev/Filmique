# composeTimeline — the recovered rules

`composeTimeline(ep, words, opts?)` in `src/timeline.ts` rebuilds the studio's
`timeline.json` from an `episode.json` + aligned `words.json`. It is the TypeScript
descendant of the lost `plan.py`; every rule below is golden-validated against the
three shipped episodes (`million16`, `rewind`, `copy-paste`).

## Rounding

All frames come from seconds via **banker's rounding** (`bankRound`): round-half-to-even,
like Python's `round()`. `w.s * fps === 51.5 → 52`, `52.5 → 52`, `53.5 → 54`.

## Cuts (anchors)

`ep.edit[k].at` resolves to a cut frame `a_k`. Anchor forms:

- `f:N` — absolute frame. `a = N` (no offset). Also used for `ep.end` (e.g. `f:560`).
- `s:S` — absolute seconds. `a = bankRound(S × fps)`.
- `mot[#n]` — the n-th word matching `mot` (1-based, default 1), searched across the
  whole `words` array but **skipping every word that starts before the monotone
  pointer**. The pointer starts at 0 and is advanced to `w.e` (seconds) of each
  matched anchor word. Candidate test: `w.s >= pointer − ε`.
  `a = max(0, bankRound(w.s × fps) − 2)` — the first cut of every episode lands on 0.

## Segments

- `a_k = cut[k]`, `b_k = cut[k+1]` (contiguous windows). Last `b` =
  `bankRound((words.last.e + ep.tail) × fps)` or the `ep.end` frame when present.
- Word membership is by **rounded start inside `[a, b)`**: `bankRound(w.s × fps)` —
  NOT the raw `w.s × fps` (off-by-frames differences matter, e.g. rewind k10/k12).
- `line` = `words.map(w => w.w + (w.p ?? '')).join(' ')` over the window members,
  always present (empty string when no word rounds into the window).
- Timing override: normal → `t0 = 0`, `t1 = b − a`. Reverse (`reverse: true`) →
  `t0 = from ?? t1` **of the previous segment of the SAME shot** (falls back to 0
  when none), `t1 = to ?? 0`. Then the value is stored for that shot for later.
- `look` passes through.

## Shots

One per `ep.shots` entry:
`len = max(b − a)`, `first = min(a)` over its segments,
`line = line` of the shot's **first** segment (which may be `""`).

## fx

`ep.fx[].at` resolves:
- `f:N` → frame N
- `s:S` → `bankRound(S × fps)`
- `S<n>[+d]` → `segments.find(g => g.shot === 'S<n>').a + (d ?? 0)` — the cut frame of
  that shot, plus the `+d` offset (e.g. `S2+28` → `seg(S2).a + 28`; verified
  58, 156, 219, 286, 350, 620).

The resolved `f` replaces `at` (which is dropped). `kind/color/o` pass through.

## Known drift (documented, not a rule)

million16 segs 13/14: the word `la` (s=20.616, e=20.675) straddles the S15 cut at
frame 620 (anchor word `banque` starts 20.733), yet the shipped golden puts it in
S15's line. No window rule (start/mid/end) reproduces this; the golden line was
likely authored against an earlier TTS alignment. `composeTimeline` keeps the
deterministic rule (→ seg 13); the golden test pins the two affected lines.
