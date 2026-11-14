import React, { useMemo } from 'react';
import { buildShotMap, composeTimeline, Episode, type EpisodeJson } from '@what-if/engine';
import { themeById } from '@what-if/engine/theme';
import { synthWords } from '../lib/demo-words';
import { STUDIO_LOOKS } from '../lib/looks';
import type { TtsResult } from '../lib/api-tts';

// Shared by the editor's <Player> and the Lambda export bundle: the whole
// episode as one Remotion component over its own data — real TTS words when a
// voice job exists, the deterministic demo cadence otherwise. Audio URLs must
// be absolute (staticFile passes those through) so a Lambda render can stream
// them from S3.

export const fpsSaaS = 30;

export const SaaSEpisode: React.FC<{ episode: EpisodeJson; tts: TtsResult | null }> = ({ episode, tts }) => {
  const words = useMemo(() => tts?.words ?? synthWords(episode.script), [tts, episode.script]);
  const audio = useMemo(() => (tts ? { voice: tts.audioUrl, voiceVol: 1 } : {}), [tts]);
  const timeline = useMemo(() => composeTimeline(episode, words, { fps: fpsSaaS, audio }), [episode, words, audio]);
  const shots = useMemo(() => buildShotMap(episode), [episode]);
  const theme = useMemo(() => themeById(episode.settings?.theme), [episode.settings?.theme]);
  return <Episode timeline={timeline} shots={shots} looks={STUDIO_LOOKS} theme={theme} />;
};
