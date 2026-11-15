import React from 'react';
import { Composition } from 'remotion';
import './brand';
import '@what-if/engine/src/fonts';
import { STUDIO } from './studio.config';
import { EPISODES } from './episodes';
import { CastSheet } from './CastSheet';
import { FORMAT_DEMOS, LOOK_IDS, LookEpisode, FormatEpisode, formatDims } from './Looks';

// Every episode gets two compositions: <Id> (the film) and <Id>Board (one frame per shot, at its key frame, for the
// storyboard). Cast renders the cast sheet.
//   npx remotion studio src/index.ts --port 3430

export const Root: React.FC = () => {
  const common = { width: STUDIO.width, height: STUDIO.height, fps: STUDIO.fps };
  return (
    <>
      {EPISODES.map((e) => (
        <React.Fragment key={e.id}>
          <Composition id={e.id} component={e.Main} durationInFrames={Math.max(1, e.total)} {...common} />
          <Composition id={`${e.id}Board`} component={e.Board} durationInFrames={Math.max(1, e.shotCount)} {...common} />
        </React.Fragment>
      ))}
      <Composition id="Cast" component={CastSheet} durationInFrames={1} {...common} />
      {LOOK_IDS.map((id) => (
        <Composition
          key={id}
          id={`Look-${id}`}
          component={LookEpisode}
          durationInFrames={1500}
          defaultProps={{ themeId: id }}
          {...common}
        />
      ))}
      {FORMAT_DEMOS.map((d) => {
        const [width, height] = formatDims[d.format];
        return (
          <Composition
            key={d.id}
            id={d.id}
            component={FormatEpisode}
            durationInFrames={1500}
            defaultProps={{ format: d.format, captions: d.captions, focal: d.focal }}
            width={width}
            height={height}
            fps={STUDIO.fps}
          />
        );
      })}
    </>
  );
};
