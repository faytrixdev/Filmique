import { describe, expect, it } from 'vitest';
import { MockLlmProvider, extractJson } from '../src/providers';
import { EpisodeJsonZ } from '../src/schema';
import { CLIPS, MUSIC } from '../src/sound/clips';
import { composeEpisode, draftScript, draftScience, draftSound, ScriptDraftZ, ScriptDraft, adaptStoryboard, StoryboardDraftZ, type StoryboardDraft } from '../src/compose';
import { SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON } from '../src/compose-mock';

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

  it('sanity: script length far from ~8.5 chars/s throws', async () => {
    const short = JSON.stringify({ title: ['TROP COURT'], script: [{ beat: 'hook', text: 'Trop court, ça.' }, { beat: 'premise', text: 'Vraiment trop court.' }, { beat: 'twist', text: 'Court quand même.' }, { beat: 'question', text: 'Court?' }] });
    await expect(draftScript({ topic: 'x' }, mockSteps(short, short, short))).rejects.toThrow(/script length/);
  });

  it('a too-long draft re-enters the retry loop instead of failing the compose', async () => {
    const long = JSON.stringify({ title: ['TROP LONG'], script: Array.from({ length: 4 }, (_, i) => ({ beat: ['hook', 'premise', 'twist', 'question'][i], text: 'x'.repeat(300) })) });
    const draft = await draftScript({ topic: 'x' }, mockSteps(long, SCRIPT_JSON));
    expect(ScriptDraftZ.safeParse(draft).success).toBe(true);
  });

  it('the length gate itself is bounded (spot check)', async () => {
    const draft = ScriptDraftZ.parse(extractJson(SCRIPT_JSON)) as ScriptDraft;
    const chars = draft.script.reduce((n, b) => n + b.text.length, 0);
    expect(chars).toBeGreaterThan(24 * 8.5 * 0.7);
    expect(chars).toBeLessThan(24 * 8.5 * 1.3);
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

  it('keeps an unknown archetype out but keeps the shot', async () => {
    const sb = StoryboardDraftZ.parse(extractJson(STORYBOARD_JSON)) as StoryboardDraft;
    const bad = { ...sb, shots: sb.shots.map((s, i) => (i === 2 ? { ...s, archetype: 'nonexistent' } : s)) };
    const adapted = await adaptStoryboard(bad, undefined);
    expect(adapted.shots[2].archetype).toBeUndefined();
    expect(adapted.shots.length).toBe(6);
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

describe('composeEpisode (whole pipeline, mocked)', () => {
  it('produces an episode json that parses, with the sound, the edits', async () => {
    const { episode } = await composeEpisode({ topic: 'Et si le pain tombait du ciel ?', tone: 'playful' }, mockSteps(SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON));
    expect(episode.title.join(' ')).toContain('PAIN');
    expect(episode.science.length).toBeGreaterThan(0);
    expect(episode.shots.length).toBe(6);
    expect(episode.sound.events.length).toBeGreaterThan(3);
    expect(episode.sound.music.clip).toBe('playful');
    expect(EpisodeJsonZ.safeParse(episode).success).toBe(true);
    // storyboard untouched by duration (no durationS given): keys = 271 + tail 1.0s*30 = 301
    const sum = episode.shots.reduce((n: number, s: { key: number }) => n + s.key, 0);
    expect(sum + 30).toBe(301);
    expect(JSON.parse(JSON.stringify(episode)).fx).toEqual([{ at: 's:2.2', kind: 'flash' }]);
  });

  it('keeps science forcasting from unlikely claims out (snapshot)', async () => {
    const { episode } = await composeEpisode({ topic: 'Et si le pain tombait du ciel ?', tone: 'playful' }, mockSteps(SCRIPT_JSON, SCIENCE_JSON, STORYBOARD_JSON));
    expect(episode).toMatchSnapshot();
  });
});
