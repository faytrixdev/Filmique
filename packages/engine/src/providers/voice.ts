import type { Words } from '../schema';

export interface VoiceProvider {
  synthesize(text: string, voiceId: string): Promise<{ audio: Uint8Array; words: Words }>;
}

const DEFAULT_BASE_URL = 'https://api.cartesia.ai';
const DEFAULT_MODEL_ID = 'sonic-2';
const CARTESIA_VERSION = '2024-11-13';

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

export class CartesiaVoice implements VoiceProvider {
  constructor(
    private readonly apiKey: string,
    private readonly options: { baseUrl?: string; modelId?: string } = {},
  ) {}

  private get baseUrl(): string {
    return this.options.baseUrl ?? process.env.CARTESIA_BASE_URL ?? DEFAULT_BASE_URL;
  }

  private get modelId(): string {
    return this.options.modelId ?? process.env.CARTESIA_MODEL_ID ?? DEFAULT_MODEL_ID;
  }

  private get headers(): Record<string, string> {
    return {
      'X-API-Key': this.apiKey,
      'Cartesia-Version': CARTESIA_VERSION,
      'Content-Type': 'application/json',
    };
  }

  private body(text: string, voiceId: string): Record<string, unknown> {
    return {
      model_id: this.modelId,
      voice: { mode: 'id', id: voiceId },
      data: { text },
      language: 'fr',
    };
  }

  async synthesize(text: string, voiceId: string): Promise<{ audio: Uint8Array; words: Words }> {
    const body = this.body(text, voiceId);

    const audioRes = await fetch(`${this.baseUrl}/tts/bytes`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (audioRes.status !== 200) {
      throw new Error(`Cartesia audio request failed: HTTP ${audioRes.status} ${await errorSnippet(audioRes)}`);
    }
    const audio = new Uint8Array(await audioRes.arrayBuffer());

    const stampRes = await fetch(`${this.baseUrl}/tts/with-timestamps`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({ ...body, output_format: 'raw' }),
    });
    if (stampRes.status !== 200) {
      throw new Error(`Cartesia timestamps request failed: HTTP ${stampRes.status} ${await errorSnippet(stampRes)}`);
    }
    const raw = await stampRes.text();

    let words: Words = [];
    try {
      words = parseCartesiaWords(JSON.parse(raw));
    } catch {
      words = parseCartesiaWordsFromJsonLines(raw);
    }

    return { audio, words };
  }
}

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
