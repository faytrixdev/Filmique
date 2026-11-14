import { concatWav, wavDuration, type VoiceProvider } from '@what-if/engine/providers/voice';
import type { EpisodeJson } from '@what-if/engine/schema';
import { BEAT_GAP_S, episodeText, stitchBeats } from './tts-flow';
import { getEpisode, NotFoundError, type EpisodeRepo } from './episodes';
import type { TtsResult } from '../db/jobs-repo';
import { DEFAULT_VOICE_ID } from './voices';

export type { TtsResult };

// Pure TTS flow: ownership-checked episode read, per-beat synthesis, beat
// stitching, storage save, job audit. Provider/store/jobs are injected so the
// whole flow runs in tests DB-free and provider-free.

export type TtsJobsRepo = {
  recordDone(episodeId: string, spec: { voiceId: string; text: string }, value: TtsResult): Promise<string>;
  recordFailed(episodeId: string, spec: { voiceId: string; text: string }, error: string): Promise<string>;
  latestDone(episodeId: string): Promise<TtsResult | null>;
};

export type AudioStore = (bytes: Uint8Array, mime?: string) => Promise<string>;

export type TtsCtx = {
  episodeRepo: EpisodeRepo;
  jobs: TtsJobsRepo;
  voice: VoiceProvider;
  saveAudio: AudioStore;
  userId: string | null;
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** POST /api/episodes/:id/tts — re-voice the episode's CURRENT script. */
export const postTts = async (ctx: TtsCtx, id: string): Promise<Response> => {
  if (!ctx.userId) return json({ error: 'unauthorized' }, 401);
  const row = await getEpisode(ctx.episodeRepo, ctx.userId, id);
  if (!row) return json({ error: 'not_found' }, 404);
  const ep = row.episode as EpisodeJson;
  const voiceId = ep.voice?.id?.trim() || DEFAULT_VOICE_ID;
  const text = episodeText(ep.script);
  try {
    const results: Awaited<ReturnType<VoiceProvider['synthesize']>>['words'][] = [];
    const audioBytes: Uint8Array[] = [];
    const mimes: string[] = [];
    for (const beat of ep.script) {
      const { audio, words, mime } = await ctx.voice.synthesize(beat.text.trim(), voiceId);
      results.push(words);
      audioBytes.push(audio);
      mimes.push(mime ?? 'audio/mpeg');
    }
    // Measured durations keep the word track aligned with the audio that plays.
    const durations = audioBytes.map((bytes) => wavDuration(bytes) ?? 0);
    const { words, offsets } = stitchBeats(results, BEAT_GAP_S, durations);
    // One valid audio file: WAV parts are merged (headers dropped, breath gaps
    // inserted); anything else is concatenated as-is.
    const merged = concatWav(audioBytes, BEAT_GAP_S);
    const audio = merged ?? concatBytes(audioBytes);
    const mime = merged ? 'audio/wav' : mimes[0];
    // The timeline runs to the end of the last word: make sure it covers the
    // whole voice, trailing silence included.
    const audioDuration = wavDuration(audio) ?? (words.length > 0 ? words[words.length - 1].e : 0);
    if (words.length > 0 && audioDuration > words[words.length - 1].e) {
      words[words.length - 1] = { ...words[words.length - 1], e: audioDuration };
    }
    const audioUrl = await ctx.saveAudio(audio, mime);
    const value: TtsResult = { audioUrl, words, offsets, voiceId };
    await ctx.jobs.recordDone(id, { voiceId, text }, value);
    return json(value);
  } catch (e) {
    await ctx.jobs.recordFailed(id, { voiceId, text }, String(e instanceof Error ? e.message : e));
    return json({ error: 'tts_failed' }, 502);
  }
};

/** GET /api/episodes/:id/tts — the last successful voice pass (null before first one). */
export const getTts = async (ctx: TtsCtx, id: string): Promise<Response> => {
  if (!ctx.userId) return json({ error: 'unauthorized' }, 401);
  const row = await getEpisode(ctx.episodeRepo, ctx.userId, id);
  if (!row) return json({ error: 'not_found' }, 404);
  return json({ tts: await ctx.jobs.latestDone(id) });
};

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
};

export { NotFoundError };
