'use client';

import React, { useMemo, useState } from 'react';
import { Player } from '@remotion/player';
import { useCurrentFrame } from 'remotion';
import { buildShotMap, composeTimeline, Episode, type EpisodeJson } from '@what-if/engine';
import { synthWords } from '@/lib/demo-words';
import { STUDIO_LOOKS } from '@/lib/looks';

const fps = 30;

// The whole episode as one Remotion component, over its own data.
// Audio arrives with real TTS; today the SaaS edit is silent.
export const SaaSEpisode: React.FC<{ episode: EpisodeJson }> = ({ episode }) => {
  const words = useMemo(() => synthWords(episode.script), [episode.script]);
  const timeline = useMemo(() => composeTimeline(episode, words, { fps }), [episode, words]);
  const shots = useMemo(() => buildShotMap(episode), [episode]);
  return <Episode timeline={timeline} shots={shots} looks={STUDIO_LOOKS} />;
};

type Beat = { beat: string; text: string };

export default function EditorClient({ episode }: { episode: EpisodeJson }) {
  const [tab, setTab] = useState<'script' | 'shots' | 'audio'>('script');
  const words = useMemo(() => synthWords(episode.script), [episode.script]);
  const timeline = useMemo(() => composeTimeline(episode, words, { fps }), [episode, words]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 420px', gap: 16, padding: 16, minHeight: '100vh', fontFamily: 'system-ui' }}>
      <div>
        <h1 style={{ margin: '0 0 8px', fontSize: 22 }}>{episode.title.join(' ')}</h1>
        {/* 1920x1080 preview scaled; true 9:16 crop is a post-render job on Lambda (MVP) */}
        <Player
          component={SaaSEpisode}
          inputProps={{ episode }}
          durationInFrames={timeline.total}
          fps={fps}
          compositionWidth={1920}
          compositionHeight={1080}
          controls
          loop
          style={{ width: '100%', aspectRatio: '16 / 9', background: '#0E0C1E' }}
        />
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.7 }}>
          {timeline.total} frames · {timeline.shots.length} plans · piste démo (0,35 s/mot — le re-TTS Cartesia arrive)
        </div>
      </div>

      <aside style={{ borderLeft: '1px solid #E5E0F0', paddingLeft: 16 }}>
        <nav style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
          {(['script', 'shots', 'audio'] as const).map((tabName) => (
            <button key={tabName} onClick={() => setTab(tabName)} style={{ fontWeight: tab === tabName ? 700 : 400 }}>
              {tabName}
            </button>
          ))}
        </nav>
        {tab === 'script' ? (
          <div>
            {(episode.script as Beat[]).map((b, i) => (
              <details key={i} style={{ marginBottom: 8 }}>
                <summary style={{ cursor: 'pointer', fontSize: 14 }}>{b.beat}</summary>
                <p style={{ fontSize: 13, margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{b.text}</p>
              </details>
            ))}
            <p style={{ fontSize: 12, opacity: 0.6 }}>L&apos;édition des beats (et leur re-TTS) arrive avec la prochaine étape.</p>
          </div>
        ) : tab === 'shots' ? (
          <ul style={{ fontSize: 13, paddingLeft: 16 }}>
            {timeline.shots.map((s) => (
              <li key={s.id}>
                <b>{s.id}</b> · {s.size} · key {s.key} · {s.len}f
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: 13, opacity: 0.6 }}>Onglet audio : voix + musique + gains (Task 13).</p>
        )}
      </aside>
    </div>
  );
}
