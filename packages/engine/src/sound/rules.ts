import type { SoundDraft } from './clips';
import { CLIPS, MUSIC } from './clips';
import { EditZ, FxZ, ShotZ, SoundZ, type KindOf } from '../schema';

type ShotRow = KindOf<typeof ShotZ>;
type EditRow = KindOf<typeof EditZ>;
type FxRow = KindOf<typeof FxZ>;
type SoundOut = KindOf<typeof SoundZ>;

// Deterministic sound design: the storyboard already knows the beats, so the SFX pass
// composes itself from the catalogue — title card gets a boom, a cheer gets a yay,
// landing piles get coin repeats, a walk-in gets steps. Anchors are frames (f:N) built
// from the shot keys; word-accurate s: anchors get rebased during the voice pass.

export type RuleInput = {
  shots: readonly ShotRow[];
  edit: readonly EditRow[];
  fx: readonly FxRow[];
  tone?: string;
  tailS?: number;
  fps?: number;
};

const AMBIENCE: Record<string, string> = {
  kitchen: 'room_tone',
  study: 'room_tone',
  classroom: 'class_murmur',
  rooftop: 'roof_wind',
  schematic: 'room_tone',
  bedroom: 'room_tone',
};

const f = (n: number) => Math.max(0, Math.round(n));

/** Resolves an fx anchor (f:/s:/S# grammar) into an absolute frame if we can. */
export const anchorFrames = (anchor: string, starts: number[], fps: number): number | null => {
  const fis = /^f:(\d+)$/.exec(anchor);
  if (fis) return Number(fis[1]);
  const sis = /^s:(\d+(?:\.\d+)?)$/.exec(anchor);
  if (sis) return Math.round(Number(sis[1]) * fps);
  const shi = /^([Ss])(?:h)?(\d+)(?:([+-]\d+))?$/.exec(anchor);
  if (shi) {
    const idx = Number(shi[2]) - 1;
    const base = idx >= 0 && idx < starts.length ? starts[idx] : 0;
    return base + (shi[3] ? Math.round(Number(shi[3])) : 0);
  }
  return null;
};

export const soundRules = (input: RuleInput): SoundDraft => {
  const fps = input.fps ?? 30;
  const starts: number[] = [];
  let acc = 0;
  for (const s of input.shots) {
    starts.push(acc);
    acc += Math.max(1, s.key);
  }
  const total = acc + f((input.tailS ?? 1.2) * fps);

  const events: SoundOut['events'] = [];
  const repeats: SoundOut['repeats'] = [];
  const used = new Set<string>();

  // ambience: the first shot's set carries the room tone through the first half
  const amb = AMBIENCE[input.shots[0]?.set?.toLowerCase() ?? 'kitchen'] ?? 'room_tone';
  events.push(['f:0', amb, 0.12, 'onset', `f:${f(total * 0.55)}`]);
  used.add(amb);

  const add = (clip: string, gain: number, at: number, ...tags: string[]) => {
    events.push([`f:${f(at)}`, clip, gain, ...tags] as (typeof events)[number]);
    used.add(clip);
  };

  input.shots.forEach((s, i) => {
    const base = starts[i];
    const len = Math.max(1, s.key);
    const a = (s.archetypeProps ?? {}) as { mood?: string };
    switch (s.archetype) {
      case 'titleReveal':
        add('title_boom', 0.35, base + 10, 'peak');
        break;
      case 'wideRoom':
        if (a.mood === 'cheer') add('yay', 0.3, base + 8);
        break;
      case 'phoneJump':
        add('chime', 0.3, base + 8, 'peak');
        add('sparkle', 0.2, base + 8);
        break;
      case 'phoneDrain':
        add('buzzer', 0.2, base + Math.floor(len * 0.6));
        break;
      case 'phoneRestore':
        add('chime', 0.3, base + Math.floor(len / 2), 'peak');
        add('pop', 0.28, base + Math.floor(len / 2) + 4);
        break;
      case 'tagObject':
        add('ding', 0.28, base + 12);
        break;
      case 'pilesLand':
        repeats.push({ at: `f:${f(base + 4)}`, clip: 'coin', n: Math.min(6, Math.max(2, Math.floor(len / 6))), every: 5, gain: [0.06, 0.16], pitch: [0.85, 1.2], note: s.id });
        used.add('coin');
        break;
      case 'objectRain':
        add('laugh', 0.3, base + Math.floor(len / 2));
        repeats.push({ at: `f:${f(base + 3)}`, clip: 'coin', n: 5, every: 6, gain: [0.06, 0.14], pitch: [0.9, 1.25], note: s.id });
        used.add('coin');
        break;
      case 'arrivalWalk':
        repeats.push({ at: `f:${f(base)}`, clip: 'steps', n: 5, every: 7, gain: [0.1, 0.2], pitch: [0.85, 1.1], note: s.id });
        used.add('steps');
        break;
      case 'closeUpTurn':
        add('drone_hit', 0.2, base + Math.floor(len / 2));
        break;
      case 'schematicClaim':
      case 'schematicBar':
        add('counter_tick', 0.15, base + 6);
        break;
      case 'ghostFlicker':
        add('glitch', 0.25, base + Math.floor(len / 3));
        break;
      case 'plantGrid':
      case 'copySwarm':
      case 'pasteStack':
        add('bulb_pop', 0.2, base + Math.floor(len / 2));
        break;
      case 'selectCopy':
      case 'selectCharacter':
        add('copy_click', 0.25, base + 6);
        break;
      case 'pastePop':
        add('paste_pop', 0.25, base + 6);
        break;
      case 'wrongAnswer':
        add('buzzer', 0.28, base + 8);
        break;
      default:
        break;
    }
  });

  // fx pass: visual flashes get a sparkle; unresolvable anchors are skipped on purpose
  for (const fx of input.fx) {
    if (fx.kind !== 'flash') continue;
    const at = anchorFrames(fx.at, starts, fps);
    if (at === null) continue;
    add('sparkle', 0.2, at);
  }

  const looks = input.edit.map((e) => e?.look ?? '').join('|');
  const reverseLooks = /million|red/.test(looks) ? ['million'] : [];

  const musicClip = input.tone && MUSIC[input.tone] ? input.tone : 'playful';
  used.add(musicClip);

  // clips dict: only the names actually used, resolved against the catalogue
  const clips: SoundOut['clips'] = {};
  for (const name of used) {
    const spec = name === musicClip ? MUSIC[musicClip] : CLIPS[name];
    if (!spec) throw new Error(`soundRules: unknown clip '${name}' in catalogue`);
    clips[name] = spec as unknown as [string, number];
  }

  return {
    clips,
    events: events as SoundOut['events'],
    repeats: repeats as SoundOut['repeats'],
    music: {
      clip: musicClip,
      until: `f:${f(total / 2)}`,
      reverse_looks: reverseLooks,
    },
    levels: { sfx_lu: 1.5, music_lu: -9.5 },
  } satisfies SoundOut;
};
