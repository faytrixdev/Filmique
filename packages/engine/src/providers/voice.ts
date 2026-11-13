import type { Words } from '../schema';

export interface VoiceProvider {
  synthesize(text: string, voiceId: string): Promise<{ audio: Uint8Array; words: Words; mime?: string }>;
}

const DEFAULT_BASE_URL = 'https://api.cartesia.ai';
const DEFAULT_MODEL_ID = 'sonic-latest';
const CARTESIA_VERSION = '2026-08-14';
const SAMPLE_RATE = 44100;

/** Minimal WebSocket surface, so the provider can be tested with a fake socket. */
export type WsSocket = {
  send(data: string): void;
  close(): void;
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): void;
};

export type WsFactory = (url: string, headers: Record<string, string>) => WsSocket;

const defaultWsFactory: WsFactory = (url, headers) => {
  const Ctor = (globalThis as unknown as { WebSocket?: new (u: string, o?: unknown) => WsSocket }).WebSocket;
  if (!Ctor) throw new Error('WebSocket is not available in this runtime');
  return new Ctor(url, { headers });
};

/** PCM (s16le, mono) to a WAV container - playable by browsers and Remotion. */
export const pcmToWav = (pcm: Uint8Array, sampleRate = SAMPLE_RATE, channels = 1): Uint8Array => {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);
  const writeStr = (offset: number, value: string): void => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  const bytesPerSample = 2;
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + pcm.byteLength, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, pcm.byteLength, true);
  const out = new Uint8Array(44 + pcm.byteLength);
  out.set(new Uint8Array(header), 0);
  out.set(pcm, 44);
  return out;
};

const errorSnippet = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '');
  return text.slice(0, 300);
};

const firstString = (source: Record<string, unknown>, keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string') return value;
  }
  return undefined;
};

const firstNumber = (source: Record<string, unknown>, keys: string[]): number | undefined => {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return undefined;
};

const parseWordFromAliases = (entry: unknown): Words[number] | undefined => {
  if (typeof entry !== 'object' || entry === null) return undefined;
  const source = entry as Record<string, unknown>;
  const w = firstString(source, ['word', 'text', 'w']);
  const s = firstNumber(source, ['start', 'start_time', 's']);
  const e = firstNumber(source, ['end', 'end_time', 'e']);
  if (w === undefined || s === undefined || e === undefined) return undefined;
  return { w, s, e, p: firstString(source, ['phoneme', 'p']) ?? '' };
};

const parseWordsFromEntries = (entries: unknown[]): Words => {
  const words: Words = [];
  for (const entry of entries) {
    const word = parseWordFromAliases(entry);
    if (word) words.push(word);
  }
  return words;
};

const parseWordsFromWordsArray = (payload: unknown): Words => {
  if (typeof payload !== 'object' || payload === null) return [];
  const list = (payload as Record<string, unknown>).words;
  return Array.isArray(list) ? parseWordsFromEntries(list) : [];
};

const parseWordsFromDirectArray = (payload: unknown): Words =>
  Array.isArray(payload) ? parseWordsFromEntries(payload) : [];

export const parseCartesiaWords = (payload: unknown): Words => {
  if (Array.isArray(payload)) return parseWordsFromDirectArray(payload);
  return parseWordsFromWordsArray(payload);
};

export const parseCartesiaWordsFromJsonLines = (raw: string): Words => {
  const words: Words = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      words.push(...parseCartesiaWords(JSON.parse(trimmed)));
    } catch {
      continue;
    }
  }
  return words;
};

/** Cartesia TTS over the v2 WebSocket API: one call returns the PCM audio AND
 * the word timestamps (the old HTTP endpoints /tts/bytes + /tts/with-timestamps
 * are gone, and the bytes endpoint no longer exposes timestamps). */
export class CartesiaVoice implements VoiceProvider {
  constructor(
    private readonly apiKey: string,
    private readonly options: { baseUrl?: string; modelId?: string; wsFactory?: WsFactory } = {},
  ) {}

  private get baseUrl(): string {
    return this.options.baseUrl ?? process.env.CARTESIA_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private get modelId(): string {
    return this.options.modelId ?? process.env.CARTESIA_MODEL_ID ?? DEFAULT_MODEL_ID;
  }

  private get wsUrl(): string {
    const base = this.baseUrl.replace(/^http/, 'ws');
    return `${base}/tts/websocket`;
  }

  private get headers(): Record<string, string> {
    return {
      'X-API-Key': this.apiKey,
      'Cartesia-Version': CARTESIA_VERSION,
    };
  }

  private request(text: string, voiceId: string): Record<string, unknown> {
    return {
      model_id: this.modelId,
      transcript: text,
      voice: voiceId,
      language: 'fr',
      output_format: { container: 'raw', encoding: 'pcm_s16le', sample_rate: SAMPLE_RATE },
      add_timestamps: true,
      continue: false,
      context_id: `tts_${Math.random().toString(36).slice(2, 12)}`,
    };
  }

  async synthesize(text: string, voiceId: string): Promise<{ audio: Uint8Array; words: Words; mime?: string }> {
    const factory = this.options.wsFactory ?? defaultWsFactory;
    const socket = factory(this.wsUrl, this.headers);
    const chunks: Uint8Array[] = [];
    const words: Words = [];

    const result = await new Promise<{ pcm: Uint8Array; words: Words }>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Cartesia synthesis timed out')), 60_000);
      const finish = (fn: () => void): void => {
        clearTimeout(timer);
        fn();
      };
      socket.addEventListener('open', () => {
        socket.send(JSON.stringify(this.request(text, voiceId)));
      });
      socket.addEventListener('message', (event) => {
        const raw = typeof event.data === 'string' ? event.data : String(event.data ?? '');
        let msg: {
          type?: string;
          data?: string;
          done?: boolean;
          title?: string;
          message?: string;
          word_timestamps?: { words?: unknown; start?: unknown; end?: unknown };
        };
        try {
          msg = JSON.parse(raw);
        } catch {
          return;
        }
        if (msg.type === 'chunk' && typeof msg.data === 'string') {
          chunks.push(new Uint8Array(Buffer.from(msg.data, 'base64')));
          return;
        }
        if (msg.type === 'timestamps' && msg.word_timestamps) {
          const wt = msg.word_timestamps;
          const ws_ = Array.isArray(wt.words) ? wt.words : [];
          const starts = Array.isArray(wt.start) ? wt.start : [];
          const ends = Array.isArray(wt.end) ? wt.end : [];
          for (let i = 0; i < ws_.length; i++) {
            const w = typeof ws_[i] === 'string' ? (ws_[i] as string) : firstString((ws_[i] ?? {}) as Record<string, unknown>, ['word', 'text', 'w']);
            if (!w) continue;
            words.push({ w, s: Number(starts[i] ?? 0), e: Number(ends[i] ?? 0), p: '' });
          }
          return;
        }
        if (msg.type === 'error') {
          finish(() => reject(new Error(`Cartesia error: ${msg.title ?? ''} ${msg.message ?? ''}`.trim())));
          return;
        }
        if (msg.type === 'done' && msg.done) {
          finish(() => resolve({ pcm: concatBytes(chunks), words }));
        }
      });
      socket.addEventListener('error', () => {
        finish(() => reject(new Error('Cartesia websocket error')));
      });
    });

    try {
      socket.close();
    } catch {
      /* already closed */
    }

    return { audio: pcmToWav(result.pcm), words: result.words, mime: 'audio/wav' };
  }
}

const concatBytes = (parts: Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, p) => sum + p.byteLength, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.byteLength;
  }
  return out;
};

export class MockVoice implements VoiceProvider {
  async synthesize(text: string): Promise<{ audio: Uint8Array; words: Words }> {
    const tokens = text.trim().split(/\s+/).filter(Boolean);
    const words: Words = tokens.map((token, index) => ({
      w: token,
      s: Number((index * 0.35).toFixed(2)),
      e: Number(((index + 1) * 0.35).toFixed(2)),
      p: '',
    }));
    return { audio: new Uint8Array([0, 1, 2, 3]), words };
  }
}
