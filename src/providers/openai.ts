import { config } from '../core/config.js';
import type { Provider } from '../core/types.js';

/**
 * OpenAI provider — real semantic embeddings + chat completions.
 * Uses fetch (Node 20+) so there is no SDK dependency to install.
 * Only used when PROVIDER=openai and OPENAI_API_KEY is set.
 */
export class OpenAIProvider implements Provider {
  private readonly base = 'https://api.openai.com/v1';

  private headers() {
    if (!config.openai.apiKey) {
      throw new Error('OPENAI_API_KEY is not set but PROVIDER=openai');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.openai.apiKey}`,
    };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.base}/embeddings`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ model: config.openai.embedModel, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embeddings failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as { data: { embedding: number[] }[] };
    return json.data.map((d) => d.embedding);
  }

  async chat(prompt: string): Promise<string> {
    const res = await fetch(`${this.base}/chat/completions`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        model: config.openai.chatModel,
        messages: [
          {
            role: 'system',
            content:
              'You are a financial research assistant. Answer ONLY from the ' +
              'provided context. If the answer is not in the context, say so. ' +
              'Never invent numbers.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0,
      }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI chat failed: ${res.status} ${await res.text()}`);
    }
    const json = (await res.json()) as {
      choices: { message: { content: string } }[];
    };
    return json.choices[0]?.message?.content ?? '';
  }
}
