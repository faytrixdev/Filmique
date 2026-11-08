import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  AnthropicProvider,
  GeminiProvider,
  MockLlmProvider,
  extractJson,
  getLlmProvider,
} from '../src/providers/llm';
import { CartesiaVoice, MockVoice } from '../src/providers/voice';

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

  it('selects the mock provider', () => {
    const provider = getLlmProvider({ LLM_PROVIDER: 'mock' });
    expect(provider.name).toBe('mock');
    expect(provider).toBeInstanceOf(MockLlmProvider);
  });

  it('fails loudly when the api key is missing', () => {
    expect(() => getLlmProvider({ LLM_PROVIDER: 'gemini' })).toThrow(/GEMINI_API_KEY/);
    expect(() => getLlmProvider({ LLM_PROVIDER: 'anthropic' })).toThrow(/ANTHROPIC_API_KEY/);
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

describe('CartesiaVoice', () => {
  it('downloads audio and parses word timestamps', async () => {
    const calls = mockFetch((url) => {
      if (url.endsWith('/tts/bytes')) {
        return new Response(new Uint8Array([1, 2, 3, 4]));
      }
      return jsonResponse({ words: [{ word: 'Bonjour', start: 0, end: 0.4, phoneme: 'bo' }] });
    });

    const voice = new CartesiaVoice('secret-key');
    const result = await voice.synthesize('Bonjour', 'voice-1');

    expect(result.audio.length).toBe(4);
    expect(result.words).toEqual([{ w: 'Bonjour', s: 0, e: 0.4, p: 'bo' }]);
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.cartesia.ai/tts/bytes',
      'https://api.cartesia.ai/tts/with-timestamps',
    ]);
    const headers = calls[0].init?.headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('secret-key');
    expect(headers['Cartesia-Version']).toBe('2024-11-13');
    const body = JSON.parse(String(calls[0].init?.body)) as Record<string, unknown>;
    expect(body.model_id).toBe('sonic-2');
    expect(body.voice).toEqual({ mode: 'id', id: 'voice-1' });
    expect(body.data).toEqual({ text: 'Bonjour' });
    expect(body.language).toBe('fr');
    const stampBody = JSON.parse(String(calls[1].init?.body)) as Record<string, unknown>;
    expect(stampBody.output_format).toBe('raw');
  });

  it('accepts the alternate timestamp shapes', async () => {
    mockFetch((url) => {
      if (url.endsWith('/tts/bytes')) return new Response(new Uint8Array([9]));
      return jsonResponse([{ w: 'Salut', s: 0.1, e: 0.5, p: 'sa' }]);
    });
    const voice = new CartesiaVoice('secret-key');
    const result = await voice.synthesize('Salut', 'voice-1');
    expect(result.words).toEqual([{ w: 'Salut', s: 0.1, e: 0.5, p: 'sa' }]);
  });

  it('accepts a json-lines timestamp stream', async () => {
    mockFetch((url) => {
      if (url.endsWith('/tts/bytes')) return new Response(new Uint8Array([9]));
      return new Response(
        '{"words":[{"word":"Bonjour","start":0,"end":0.4}]}\n{"words":[{"word":"monde","start":0.4,"end":0.8}]}',
      );
    });
    const voice = new CartesiaVoice('secret-key');
    const result = await voice.synthesize('Bonjour monde', 'voice-1');
    expect(result.words).toEqual([
      { w: 'Bonjour', s: 0, e: 0.4, p: '' },
      { w: 'monde', s: 0.4, e: 0.8, p: '' },
    ]);
  });

  it('keeps the audio when the timestamp shape is unexpected', async () => {
    mockFetch((url) => {
      if (url.endsWith('/tts/bytes')) return new Response(new Uint8Array([7]));
      return jsonResponse({ unexpected: true });
    });
    const voice = new CartesiaVoice('secret-key');
    const result = await voice.synthesize('Bonjour', 'voice-1');
    expect(result.audio.length).toBe(1);
    expect(result.words).toEqual([]);
  });

  it('throws on a server error', async () => {
    mockFetch(() => new Response('quota exceeded', { status: 500 }));
    const voice = new CartesiaVoice('secret-key');
    await expect(voice.synthesize('Bonjour', 'voice-1')).rejects.toThrow(/500/);
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
