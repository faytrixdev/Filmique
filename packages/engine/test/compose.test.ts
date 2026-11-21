import { describe, expect, it } from 'vitest';
import { MockLlmProvider, extractJson } from '../src/providers';
import { EpisodeJsonZ } from '../src/schema';
import { CLIPS, MUSIC } from '../src/sound/clips';
import { composeEpisode, composeScript, composeFromScript, draftScript, draftScience, draftSound, ScriptDraftZ, ScriptDraft, adaptStoryboard, hardenStoryboard, StoryboardDraftZ, type StoryboardDraft } from '../src/compose';
import { resolveSettings, scriptCharBudget, SCRIPT_CHAR_MAX, SCRIPT_CHAR_MIN } from '../src/settings';
import { SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON, padScript } from '../src/compose-mock';

const mockSteps = (...jsons: string[]) => new MockLlmProvider(jsons);

describe('draftScript', () => {
  it('canned json → passes the script draft zod', async () => {
    const draft = await draftScript({ topic: 'Et si le pain tombait du ciel ?' }, mockSteps(SCRIPT_JSON));
    expect(ScriptDraftZ.safeParse(draft).success).toBe(true);
    expect(draft.title[0]).contain('PAIN');
    expect(draft.script.length).toBeGreaterThanOrEqual(4);
  });

  it('retries once on a non-json reply', async () => {
    const draft = await draftScript({ topic: 'x' }, mockSteps('pas du json du tout', SCRIPT_JSON));
    expect(draft.accent).toBeTypeOf('string');
  });

  it('sanity: script length far from the 16 chars/s budget throws', async () => {
    const short = JSON.stringify({ title: ['TROP COURT'], script: [{ beat: 'hook', text: 'Trop court, ça.' }, { beat: 'premise', text: 'Vraiment trop court.' }, { beat: 'twist', text: 'Court quand même.' }, { beat: 'question', text: 'Court?' }] });
    await expect(draftScript({ topic: 'x' }, mockSteps(short, short, short, short))).rejects.toThrow(/trop court/);
  });

  it('a 24 s script is rejected when 60 s is asked (the duration bug)', async () => {
    // SCRIPT_JSON totals 345 chars: valid for 24 s, far below the 912-char
    // budget of a 60 s film — the old 8.5 chars/s gate used to accept it.
    await expect(draftScript({ topic: 'x', durationS: 60 }, mockSteps(SCRIPT_JSON, SCRIPT_JSON, SCRIPT_JSON, SCRIPT_JSON))).rejects.toThrow(/trop court/);
  });

  it('a too-long draft re-enters the retry loop instead of failing the compose', async () => {
    const long = JSON.stringify({ title: ['TROP LONG'], script: Array.from({ length: 4 }, (_, i) => ({ beat: ['hook', 'premise', 'twist', 'question'][i], text: 'x'.repeat(300) })) });
    const draft = await draftScript({ topic: 'x' }, mockSteps(long, SCRIPT_JSON));
    expect(ScriptDraftZ.safeParse(draft).success).toBe(true);
  });

  it('the length gate itself is bounded (spot check)', async () => {
    const draft = ScriptDraftZ.parse(extractJson(SCRIPT_JSON)) as ScriptDraft;
    const chars = draft.script.reduce((n, b) => n + b.text.length, 0);
    const target = scriptCharBudget(24);
    expect(chars).toBeGreaterThanOrEqual(target * SCRIPT_CHAR_MIN);
    expect(chars).toBeLessThanOrEqual(target * SCRIPT_CHAR_MAX);
  });
});

describe('draftScience', () => {
  it('science passes and supports the quoted figures', async () => {
    const draft = ScriptDraftZ.parse(extractJson(SCRIPT_JSON)) as ScriptDraft;
    const sc = await draftScience(draft, mockSteps(SCIENCE_JSON));
    expect(sc.length).toBeGreaterThan(0);
    expect(sc[0].claim).toBeTypeOf('string');
    expect(sc[0].source).toContain('Urbanisme');
  });

  it('an empty science with digits triggers a retry then throws', async () => {
    const draft = ScriptDraftZ.parse(extractJson(SCRIPT_JSON)) as ScriptDraft;
    await expect(draftScience(draft, mockSteps('{"science":[]}', '{"science":[]}', '{"science":[]}'))).rejects.toThrow(/draftScience|failed/);
  });

  it('science stays valid without digits', async () => {
    const draft: ScriptDraft = { ...ScriptDraftZ.parse(extractJson(SCRIPT_JSON)) as ScriptDraft, script: [{ beat: 'hook', text: 'Sans chiffres.' }] };
    expect((await draftScience(draft, mockSteps('{"science":[]}'))).length).toBe(0);
  });
});

describe('adaptStoryboard', () => {
  it('round-trips the storyboard draft through the storyboard gate', async () => {
    const sb = StoryboardDraftZ.parse(extractJson(STORYBOARD_JSON)) as StoryboardDraft;
    const adapted = await adaptStoryboard(sb, 12);
    expect(adapted.shots.map((s) => s.id)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6']);
    const sum = adapted.shots.reduce((n, s) => n + s.key, 0);
    expect(Math.abs(sum - (12 * 30 - 30))).toBeLessThanOrEqual(8);
    // edit pointing at a dropped id is filtered
    expect(adapted.edit.map((e) => e.shot)).toEqual(['S1']);
    expect(adapted.tail).toBe(1);
  });

  it('falls back to the generic scene on an unknown archetype but keeps the shot', async () => {
    const sb = StoryboardDraftZ.parse(extractJson(STORYBOARD_JSON)) as StoryboardDraft;
    const bad = { ...sb, shots: sb.shots.map((s, i) => (i === 2 ? { ...s, archetype: 'nonexistent' } : s)) };
    const adapted = await adaptStoryboard(bad, undefined);
    expect(adapted.shots[2].archetype).toBe('scene');
    expect(adapted.shots.length).toBe(6);
  });

  it('falls back to the generic scene when an archetype misses the props it needs', async () => {
    const sb = StoryboardDraftZ.parse(extractJson(STORYBOARD_JSON)) as StoryboardDraft;
    const bad = { ...sb, shots: sb.shots.map((s, i) => (i === 0 ? { ...s, archetype: 'phoneJump', archetypeProps: {} } : s)) };
    const adapted = await adaptStoryboard(bad, undefined);
    expect(adapted.shots[0].archetype).toBe('scene');
  });

  it('gives the generic scene the set the plan asked for', async () => {
    const sb = StoryboardDraftZ.parse(extractJson(STORYBOARD_JSON)) as StoryboardDraft;
    const bad = { ...sb, shots: sb.shots.map((s, i) => (i === 0 ? { ...s, archetype: 'scene', set: 'cantine', archetypeProps: {} } : s)) };
    const adapted = await adaptStoryboard(bad, undefined);
    expect(adapted.shots[0].archetypeProps).toMatchObject({ set: 'cantine' });
  });

  it('coerces drifted props (string numbers, invented enums) instead of dropping them', async () => {
    const sb = StoryboardDraftZ.parse(extractJson(STORYBOARD_JSON)) as StoryboardDraft;
    const bad = { ...sb, shots: sb.shots.map((s, i) => (i === 0 ? { ...s, archetype: 'wideRoom', archetypeProps: { mood: 'curieux', glow: '0,15', buzz: 'true' } } : s)) };
    const adapted = await adaptStoryboard(bad, undefined);
    expect(adapted.shots[0].archetypeProps).toMatchObject({ mood: 'curious', glow: 0.15, buzz: true });
  });
});

describe('draftSound (deterministic from the storyboard)', () => {
  it('title plan gets a boom, everything resolves in the clip catalogue', async () => {
    const sb = (await import('../src/compose')).StoryboardDraftZ.parse(extractJson(STORYBOARD_JSON)) as StoryboardDraft;
    const sound = draftSound(sb);
    expect(sound.clips.title_boom).toBeDefined();
    expect(sound.events.some(([, clip, gain]) => clip === 'title_boom' && gain > 0.2)).toBe(true);
    expect(sound.repeats.some((r) => r.clip === 'coin')).toBe(true);
    for (const [name] of Object.entries(sound.clips)) expect(Object.keys({ ...CLIPS, ...MUSIC })).toContain(name);
    expect(sound.levels).toEqual({ sfx_lu: 1.5, music_lu: -9.5 });
    expect(/^\d+\.?\d*$/.test(sound.music.until ?? '') || sound.music.until?.startsWith('f:')).toBe(true);
  });
});

describe('hardenStoryboard (the rules the model breaks)', () => {
  const title = ['CANTINE GRATUITE', 'UN REVE'];
  const pizza = [{ beat: 'question', text: 'Qui finira par payer la pizza qui tourne au plafond ?' }];
  const shot = (id: string, archetype: string, archetypeProps: Record<string, unknown>) => ({ id, archetype, archetypeProps, key: 40, set: 'rooftop', size: 'wide', note: '' });

  it('moves the title shot to the end of the film', () => {
    const out = hardenStoryboard(
      [shot('S1', 'titleReveal', { lines: ['CANTINE GRATUITE', 'UN REVE'] }), shot('S2', 'closeUpTurn', {})] as StoryboardDraft['shots'],
      title,
      pizza,
    );
    expect(out.map((s) => s.archetype)).toEqual(['closeUpTurn', 'titleReveal']);
  });

  it('labels the object with the beat noun when the label names nothing in the beat', () => {
    const object = { kind: 'ticket', label: 'FINIRA', x: 0.72, y: 0.55, s: 1, rot: 0, at: 2, anim: 'pop' };
    const out = hardenStoryboard([shot('S1', 'scene', { objects: [object] })] as StoryboardDraft['shots'], title, pizza);
    expect((out[0].archetypeProps as { objects: { label: string }[] }).objects[0].label).toBe('PIZZA');
  });

  it('keeps a label the beat already supports', () => {
    const object = { kind: 'tray', label: 'PLATEAU', x: 0.72, y: 0.55, s: 1, rot: 0, at: 2, anim: 'pop' };
    const beats = [{ beat: 'hook', text: 'Léa attrape un plateau, un sourire aux lèvres.' }];
    const out = hardenStoryboard([shot('S1', 'scene', { objects: [object] })] as StoryboardDraft['shots'], title, beats);
    expect((out[0].archetypeProps as { objects: { label: string }[] }).objects[0].label).toBe('PLATEAU');
  });
});

describe('composeEpisode (whole pipeline, mocked)', () => {
  it('produces an episode json that parses, with the sound, the edits', async () => {
    const { episode } = await composeEpisode({ topic: 'Et si le pain tombait du ciel ?', tone: 'playful' }, mockSteps(SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON));
    expect(episode.title.join(' ')).toContain('PAIN');
    expect(episode.science.length).toBeGreaterThan(0);
    expect(episode.shots.length).toBe(6);
    expect(episode.sound.events.length).toBeGreaterThan(3);
    expect(episode.sound.music.clip).toBe('playful');
    expect(EpisodeJsonZ.safeParse(episode).success).toBe(true);
    // the plan is rescaled to fill the requested duration (settings default: 24 s at 30 fps)
    const sum = episode.shots.reduce((n: number, s: { key: number }) => n + s.key, 0);
    expect(sum + Math.round(episode.tail * 30)).toBe(720);
    expect(JSON.parse(JSON.stringify(episode)).fx).toEqual([{ at: 's:2.2', kind: 'flash' }]);
  });

  it('keeps science forcasting from unlikely claims out (snapshot)', async () => {
    const { episode } = await composeEpisode({ topic: 'Et si le pain tombait du ciel ?', tone: 'playful' }, mockSteps(SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON));
    expect(episode).toMatchSnapshot();
  });
});

describe('project settings', () => {
  it('fills the defaults for an episode written without settings', () => {
    expect(resolveSettings()).toEqual({
      format: '16:9',
      durationS: 24,
      tone: 'playful',
      narration: 'conteur',
      rhythm: 'standard',
      world: 'maison',
      theme: 'base',
      captions: 'none',
    });
  });

  it('keeps the user values and drops the unknown ones', () => {
    const s = resolveSettings({ durationS: 45, world: 'urbain', nope: true } as never);
    expect(s.durationS).toBe(45);
    expect(s.world).toBe('urbain');
    expect((s as Record<string, unknown>).nope).toBeUndefined();
  });

  it('the episode carries the settings, and the duration drives the script budget', async () => {
    const { episode } = await composeEpisode(
      { topic: 'Et si le pain tombait du ciel ?', settings: { durationS: 45, tone: 'tense' } },
      mockSteps(JSON.stringify(padScript(JSON.parse(SCRIPT_JSON), scriptCharBudget(45))), SCIENCE_JSON, STORYBOARD_JSON),
    );
    expect(episode.settings?.durationS).toBe(45);
    expect(episode.settings?.tone).toBe('tense');
    expect(episode.sound.music.clip).toBe('tense');
  });

  it('a top-level durationS (compose-cli --secs) is persisted into episode.settings', async () => {
    const script = ScriptDraftZ.parse(extractJson(SCRIPT_JSON)) as ScriptDraft;
    const { episode } = await composeFromScript(
      { topic: 'Et si le pain tombait du ciel ?', durationS: 60 },
      script,
      mockSteps(SCIENCE_JSON, STORYBOARD_JSON),
    );
    expect(episode.settings?.durationS).toBe(60);
    expect(episode.shots.reduce((n, s) => n + s.key, 0) + Math.round(episode.tail * 30)).toBe(60 * 30);
  });

  it('the film look is stored with the episode', async () => {
    const { episode } = await composeEpisode(
      { topic: 'Et si le pain tombait du ciel ?', settings: { theme: 'nuit' } },
      mockSteps(SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON),
    );
    expect(episode.settings?.theme).toBe('nuit');
  });

  it('the second cast survives the storyboard gate', async () => {
    const sb: StoryboardDraft = {
      cast: ['doc', 'ado', 'meme', 'agent'],
      shots: [
        { id: 'S1', size: 'wide', set: 'kitchen', key: 30, note: 'a', archetype: 'wideRoom', archetypeProps: {} },
        { id: 'S2', size: 'wide', set: 'kitchen', key: 30, note: 'b', archetype: 'wideRoom', archetypeProps: {} },
      ],
      edit: [{ shot: 'S1', at: 'un' }],
      fx: [],
      tail: 1,
    };
    const adapted = await adaptStoryboard(sb);
    expect(adapted.cast).toEqual(['doc', 'ado', 'meme', 'agent']);
  });
});

describe('script-first compose', () => {
  it('phase 1 returns the beats only, phase 2 turns them into an episode', async () => {
    const script = await composeScript({ topic: 'Et si le pain tombait du ciel ?' }, mockSteps(SCRIPT_JSON));
    expect(script.script.length).toBeGreaterThanOrEqual(4);

    const { episode } = await composeFromScript(
      { topic: 'Et si le pain tombait du ciel ?' },
      script,
      mockSteps(SCIENCE_JSON, STORYBOARD_JSON),
    );
    expect(episode.script).toEqual(script.script);
    expect(episode.shots.length).toBe(6);
    expect(EpisodeJsonZ.safeParse(episode).success).toBe(true);
  });
});
