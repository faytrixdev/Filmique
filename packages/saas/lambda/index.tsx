import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { composeTimeline } from '@what-if/engine';
import type { EpisodeJson } from '@what-if/engine/schema';
import { fpsSaaS, SaaSEpisode } from '../src/components/saas-episode';
import { synthWords } from '../src/lib/demo-words';

// SaaS export bundle: benched by `remotion lambda functions deploy` and rendered
// with composition "saas-episode". inputProps: { episodeJson, tts: {audioUrl, words } }.

type SaaSProps = {
  episodeJson: EpisodeJson | null;
  tts: { audioUrl: string | null; words: unknown } | null;
};

const Component: React.FC<SaaSProps> = ({ episodeJson, tts }) => {
  if (!episodeJson) return null;
  return <SaaSEpisode episode={episodeJson} tts={tts as never} />;
};

registerRoot(() => (
  <Composition
    id="saas-episode"
    component={Component}
    width={1920}
    height={1080}
    fps={fpsSaaS}
    defaultProps={{ episodeJson: null, tts: null }}
    calculateMetadata={({ props }) => {
      const ep = props.episodeJson;
      if (!ep) return { durationInFrames: 1 };
      const words = (props.tts?.words as never) ?? synthWords(ep.script);
      const total = composeTimeline(ep, words, { fps: fpsSaaS }).total;
      return { durationInFrames: Math.max(1, total) };
    }}
  />
));
