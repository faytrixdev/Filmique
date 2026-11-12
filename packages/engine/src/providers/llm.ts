export type LlmOptions = {
  system?: string;
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
};

export interface LlmProvider {
  readonly name: string;
  generateText(prompt: string, opts?: LlmOptions): Promise<string>;
}

const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash';
const DEFAULT_ANTHROPIC_MODEL = 'claude-3-5-sonnet-latest';
const DEFAULT_MAX_TOKENS = 4096;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

const errorSnippet = async (res: Response): Promise<string> => {
  const text = await res.text().catch(() => '');
  return text.slice(0, 300);
};

export class GeminiProvider implements LlmProvider {
  readonly name = 'gemini';

  constructor(
    private readonly apiKey: string,
    private readonly model?: string,
  ) {}

  async generateText(prompt: string, opts: LlmOptions = {}): Promise<string> {
    const model = this.model ?? process.env.GEMINI_MODEL ?? DEFAULT_GEMINI_MODEL;
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
        responseMimeType: opts.json ? 'application/json' : undefined,
      },
    };
    if (opts.system !== undefined) body.systemInstruction = { parts: [{ text: opts.system }] };

    const res = await fetch(`${GEMINI_URL}/${model}:generateContent?key=${this.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.status !== 200) {
      throw new Error(`Gemini request failed: HTTP ${res.status} ${await errorSnippet(res)}`);
    }

    const payload = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? '')
      .join('');
    if (!text) throw new Error('Gemini returned no text');
    return text;
  }
}

export class AnthropicProvider implements LlmProvider {
  readonly name = 'anthropic';

  constructor(
    private readonly apiKey: string,
    private readonly model?: string,
  ) {}

  async generateText(prompt: string, opts: LlmOptions = {}): Promise<string> {
    const model = this.model ?? process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL;
    const body: Record<string, unknown> = {
      model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    };
    if (opts.system !== undefined) body.system = opts.system;

    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (res.status !== 200) {
      throw new Error(`Anthropic request failed: HTTP ${res.status} ${await errorSnippet(res)}`);
    }

    const payload = (await res.json()) as { content?: { text?: string }[] };
    const text = (payload.content ?? []).map((block) => block.text ?? '').join('');
    if (!text) throw new Error('Anthropic returned no text');
    return text;
  }
}

export class OpenAiCompatProvider implements LlmProvider {
  readonly name: string;

  constructor(
    name: string,
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model?: string,
  ) {
    this.name = name;
  }

  async generateText(prompt: string, opts: LlmOptions = {}): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (opts.system !== undefined) messages.push({ role: 'system', content: opts.system });
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: opts.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: opts.temperature,
      messages,
    };
    if (opts.json) body.response_format = { type: 'json_object' };

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });
    if (res.status !== 200) {
      throw new Error(`OpenAI-compatible request failed (${this.name}): HTTP ${res.status} ${await errorSnippet(res)}`);
    }

    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = payload.choices?.[0]?.message?.content ?? '';
    if (!text) throw new Error(`OpenAI-compatible provider returned no text (${this.name})`);
    return text;
  }
}

export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';

  readonly queue: string[];
  private readonly fallback: string;

  constructor(queue: string[] = [], fallback = '') {
    this.queue = [...queue];
    this.fallback = fallback;
  }

  async generateText(): Promise<string> {
    return this.queue.shift() ?? this.fallback;
  }
}

export function getLlmProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const choice = (env.LLM_PROVIDER ?? 'gemini').toLowerCase();
  if (choice === 'mock') return new MockLlmProvider();
  if (choice === 'anthropic') {
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY environment variable');
    return new AnthropicProvider(apiKey, env.ANTHROPIC_MODEL);
  }
  if (choice === 'groq') {
    const apiKey = env.GROQ_API_KEY;
    if (!apiKey) throw new Error('Missing GROQ_API_KEY environment variable');
    return new OpenAiCompatProvider('groq', apiKey, 'https://api.groq.com/openai/v1', env.GROQ_MODEL ?? 'openai/gpt-oss-120b');
  }
  if (choice === 'nim') {
    const apiKey = env.NIM_API_KEY;
    if (!apiKey) throw new Error('Missing NIM_API_KEY environment variable');
    return new OpenAiCompatProvider('nim', apiKey, 'https://integrate.api.nvidia.com/v1', env.NIM_MODEL ?? 'meta/llama-3.3-70b-instruct');
  }
  if (choice === 'openai') {
    const apiKey = env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('Missing OPENAI_API_KEY environment variable');
    return new OpenAiCompatProvider('openai', apiKey, env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1', env.OPENAI_MODEL ?? 'gpt-4o-mini');
  }
  if (choice === 'gemini') {
    const apiKey = env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('Missing GEMINI_API_KEY environment variable');
    return new GeminiProvider(apiKey, env.GEMINI_MODEL);
  }
  throw new Error(`Unknown LLM_PROVIDER "${env.LLM_PROVIDER}" (expected gemini, anthropic or mock)`);
}

export function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  const candidate = (fenced ? fenced[1] : trimmed).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        throw new Error('Could not parse JSON from model output');
      }
    }
    throw new Error('Could not parse JSON from model output');
  }
}
