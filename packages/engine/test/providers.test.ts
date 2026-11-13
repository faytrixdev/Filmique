import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnthropicProvider,
  GeminiProvider,
  MockLlmProvider,
  OpenAiCompatProvider,
  extractJson,
  getLlmProvider,
} from '../src/providers/llm';
import { CartesiaVoice, MockVoice, type WsFactory } from '../src/providers/voice';

type FetchCall = { url: string; init: RequestInit | undefined };

const mockFetch = (
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
): FetchCall[] => {
  const calls: FetchCall[] = [];
  const stub = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return handler(url, init);
  });
  vi.stubGlobal('fetch', stub);
  return calls;
};

const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GeminiProvider', () => {
  it('posts to the generateContent endpoint and extracts the text', async () => {
    const calls = mockFetch(() =>
      jsonResponse({ candidates: [{ content: { parts: [{ text: 'Bonjour ' }, { text: 'monde' }] } }] }),
    );

    const provider = new GeminiProvider('secret-key', 'gemini-2.0-flash');
    const text = await provider.generateText('Salut', {
      system: 'Réponds en français',
      json: true,
      maxTokens: 256,
      temperature: 0.2,
    });

    expect(text).toBe('Bonjour monde');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=secret-key',
    );
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(body.contents).toEqual([{ role: 'user', parts: [{ text: 'Salut' }] }]);
    expect(body.systemInstruction).toEqual({ parts: [{ text: 'Réponds en français' }] });
    expect(body.generationConfig).toEqual({
      temperature: 0.2,
      maxOutputTokens: 256,
      responseMimeType: 'application/json',
    });
  });

  it('throws on a server error', async () => {
    mockFetch(() => new Response('upstream boom', { status: 500 }));
    const provider = new GeminiProvider('secret-key');
    await expect(provider.generateText('Salut')).rejects.toThrow(/500/);
  });

  it('throws when no text comes back', async () => {
    mockFetch(() => jsonResponse({ candidates: [{ content: { parts: [] } }] }));
    const provider = new GeminiProvider('secret-key');
    await expect(provider.generateText('Salut')).rejects.toThrow(/no text/i);
  });
});

describe('AnthropicProvider', () => {
  it('posts to the messages endpoint and extracts the text', async () => {
    const calls = mockFetch(() => jsonResponse({ content: [{ type: 'text', text: 'Ça marche' }] }));

    const provider = new AnthropicProvider('secret-key', 'claude-3-5-sonnet-latest');
    const text = await provider.generateText('Salut', { system: 'Court', maxTokens: 128 });

    expect(text).toBe('Ça marche');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.anthropic.com/v1/messages');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('secret-key');
    expect(headers['anthropic-version']).toBe('2023-06-01');
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(body.model).toBe('claude-3-5-sonnet-latest');
    expect(body.max_tokens).toBe(128);
    expect(body.system).toBe('Court');
    expect(body.messages).toEqual([{ role: 'user', content: 'Salut' }]);
  });

  it('throws on a server error', async () => {
    mockFetch(() => new Response('nope', { status: 500 }));
    const provider = new AnthropicProvider('secret-key');
    await expect(provider.generateText('Salut')).rejects.toThrow(/500/);
  });
});

describe('OpenAiCompatProvider (groq / nim / openai)', () => {
  it('posts to chat/completions with the bearer key, json mode and system message', async () => {
    const calls = mockFetch(() => jsonResponse({ choices: [{ message: { content: '{"ok":true}' } }] }));

    const provider = new OpenAiCompatProvider('groq', 'gsk-key', 'https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile');
    const text = await provider.generateText('Donne du JSON', { system: 'Tu es un storyboarder', json: true, temperature: 0.1, maxTokens: 512 });

    expect(text).toBe('{"ok":true}');
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.groq.com/openai/v1/chat/completions');
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer gsk-key');
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(body.model).toBe('llama-3.3-70b-versatile');
    expect(body.max_tokens).toBe(512);
    expect(body.temperature).toBe(0.1);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.messages).toEqual([
      { role: 'system', content: 'Tu es un storyboarder' },
      { role: 'user', content: 'Donne du JSON' },
    ]);
  });

  it('no json mode and no system message by default', async () => {
    const calls = mockFetch(() => jsonResponse({ choices: [{ message: { content: 'salut' } }] }));
    const provider = new OpenAiCompatProvider('nim', 'nv-key', 'https://integrate.api.nvidia.com/v1', 'meta/llama-3.3-70b-instruct');
    await provider.generateText('Salut');
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(body.response_format).toBeUndefined();
    expect(body.messages).toEqual([{ role: 'user', content: 'Salut' }]);
  });

  it('throws on a server error with the provider name', async () => {
    mockFetch(() => new Response('rate limit', { status: 429 }));
    const provider = new OpenAiCompatProvider('groq', 'gsk-key', 'https://api.groq.com/openai/v1');
    await expect(provider.generateText('Salut')).rejects.toThrow(/\(groq\).*429/);
  });

  it('throws when no text comes back', async () => {
    mockFetch(() => jsonResponse({ choices: [{ message: {} }] }));
    const provider = new OpenAiCompatProvider('openai', 'sk-key', 'https://api.openai.com/v1');
    await expect(provider.generateText('Salut')).rejects.toThrow(/no text/i);
  });
});

describe('MockLlmProvider', () => {
  it('serves queued responses then the default', async () => {
    const provider = new MockLlmProvider(['a', 'b'], 'fallback');
    expect(await provider.generateText('x')).toBe('a');
    expect(await provider.generateText('x')).toBe('b');
    expect(await provider.generateText('x')).toBe('fallback');
  });
});

describe('getLlmProvider', () => {
  it('selects gemini by default', () => {
    const provider = getLlmProvider({ GEMINI_API_KEY: 'k' });
    expect(provider.name).toBe('gemini');
    expect(provider).toBeInstanceOf(GeminiProvider);
  });

  it('selects anthropic when asked', () => {
    const provider = getLlmProvider({ LLM_PROVIDER: 'anthropic', ANTHROPIC_API_KEY: 'k' });
    expect(provider.name).toBe('anthropic');
    expect(provider).toBeInstanceOf(AnthropicProvider);
  });

  it('selects the openai-compatible providers (groq, nim, openai)', () => {
    const groq = getLlmProvider({ LLM_PROVIDER: 'groq', GROQ_API_KEY: 'k' });
    expect(groq.name).toBe('groq');
    expect(groq).toBeInstanceOf(OpenAiCompatProvider);

    const nim = getLlmProvider({ LLM_PROVIDER: 'nim', NIM_API_KEY: 'k' });
    expect(nim.name).toBe('nim');

    const openai = getLlmProvider({ LLM_PROVIDER: 'openai', OPENAI_API_KEY: 'k' });
    expect(openai.name).toBe('openai');
  });

  it('selects the mock provider', () => {
    const provider = getLlmProvider({ LLM_PROVIDER: 'mock' });
    expect(provider.name).toBe('mock');
    expect(provider).toBeInstanceOf(MockLlmProvider);
  });

  it('fails loudly when the api key is missing', () => {
    expect(() => getLlmProvider({ LLM_PROVIDER: 'gemini' })).toThrow(/GEMINI_API_KEY/);
    expect(() => getLlmProvider({ LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
    expect(() => getLlmProvider({ LLM_PROVIDER: 'groq' })).toThrow(/GROQ_API_KEY/);
    expect(() => getLlmProvider({ LLM_PROVIDER: 'nim' })).toThrow(/NIM_API_KEY/);
  });
});

describe('extractJson', () => {
  it('parses raw json', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('parses json wrapped in markdown fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('parses json prefixed by prose', () => {
    expect(extractJson('Voici la réponse : {"a":1} — bonne chance')).toEqual({ a: 1 });
  });

  it('throws when nothing parsable is found', () => {
    expect(() => extractJson('pas de json ici')).toThrow();
  });
});

/** Fake Cartesia websocket: emits chunks, word timestamps, then done. */
const fakeWs = (messages: { type: string; [k: string]: unknown }[]): WsFactory => () => {
  const listeners: Record<string, ((event: { data?: unknown }) => void)[]> = {};
  return {
    send: () => {
      setTimeout(() => {
        for (const msg of messages) {
          for (const listener of listeners['message'] ?? []) listener({ data: JSON.stringify(msg) });
        }
      }, 0);
    },
    close: () => {},
    addEventListener: (type: string, listener: (event: { data?: unknown }) => void) => {
      (listeners[type] ??= []).push(listener);
      if (type === 'open') setTimeout(() => listener({}), 0);
    },
  };
};

describe('CartesiaVoice', () => {
  it('returns wav audio and the word timestamps from the websocket', async () => {
    const voice = new CartesiaVoice('secret-key', {
      wsFactory: fakeWs([
        { type: 'chunk', data: Buffer.from([1, 2, 3, 4]).toString('base64') },
        { type: 'timestamps', word_timestamps: { words: ['Bonjour'], start: [0], end: [0.4] } },
        { type: 'done', done: true },
      ]),
    });
    const result = await voice.synthesize('Bonjour', 'voice-1');
    expect(result.mime).toBe('audio/wav');
    expect(result.audio.length).toBe(44 + 4);
    expect(String.fromCharCode(...result.audio.slice(0, 4))).toBe('RIFF');
    expect(result.words).toEqual([{ w: 'Bonjour', s: 0, e: 0.4, p: '' }]);
  });

  it('accumulates one timestamp message per word', async () => {
    const voice = new CartesiaVoice('secret-key', {
      wsFactory: fakeWs([
        { type: 'timestamps', word_timestamps: { words: ['Bonjour'], start: [0], end: [0.4] } },
        { type: 'timestamps', word_timestamps: { words: ['monde'], start: [0.4], end: [0.9] } },
        { type: 'done', done: true },
      ]),
    });
    const result = await voice.synthesize('Bonjour monde', 'voice-1');
    expect(result.words).toEqual([
      { w: 'Bonjour', s: 0, e: 0.4, p: '' },
      { w: 'monde', s: 0.4, e: 0.9, p: '' },
    ]);
  });

  it('rejects when the provider reports an error', async () => {
    const voice = new CartesiaVoice('secret-key', {
      wsFactory: fakeWs([{ type: 'error', title: 'Invalid model', message: 'bad model' }]),
    });
    await expect(voice.synthesize('Bonjour', 'voice-1')).rejects.toThrow(/Invalid model/);
  });
});
describe('MockVoice', () => {
  it('returns words timed at 0.35s each', async () => {
    const voice = new MockVoice();
    const result = await voice.synthesize('un deux trois');
    expect(result.audio.length).toBeGreaterThan(0);
    expect(result.words).toEqual([
      { w: 'un', s: 0, e: 0.35, p: '' },
      { w: 'deux', s: 0.35, e: 0.7, p: '' },
      { w: 'trois', s: 0.7, e: 1.05, p: '' },
    ]);
  });
});