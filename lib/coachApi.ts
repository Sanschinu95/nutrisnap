/**
 * Coach chat API. Separate from lib/groq.ts (which is vision/scan).
 * Uses llama-3.3-70b-versatile via the same Groq OpenAI-compatible endpoint.
 *
 * Extracts the ACTION: <one-liner> trailing line per the system prompt
 * convention so the UI can render it as a pinnable card.
 */

import { getNextCoachKey, markKeyCooling } from './coachKeyPool';

export interface CoachMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CoachResponse {
  text: string;
  action: string | null;
}

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const COACH_MODEL = 'llama-3.3-70b-versatile';

export async function sendCoachMessage(
  systemPrompt: string,
  conversationHistory: CoachMessage[],
  userMessage: string,
  retries: number = 3,
): Promise<CoachResponse> {
  const messages: CoachMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  let lastError: unknown = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    let key: string;
    try {
      key = getNextCoachKey();
    } catch {
      throw new Error('COACH_BUSY');
    }

    try {
      const response = await fetch(GROQ_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: COACH_MODEL,
          messages,
          max_tokens: 800,
          temperature: 0.7,
          top_p: 0.9,
        }),
      });

      if (response.status === 429) {
        markKeyCooling(key, 60_000);
        continue;
      }

      if (!response.ok) {
        markKeyCooling(key, 30_000);
        lastError = new Error(`Groq API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const fullText: string = data?.choices?.[0]?.message?.content ?? '';

      // Pull the ACTION: line (case-insensitive). Last match wins, in case the
      // model accidentally produces multiple.
      const actionRegex = /ACTION:\s*(.+)/gi;
      let actionMatch: RegExpExecArray | null = null;
      let m: RegExpExecArray | null;
      while ((m = actionRegex.exec(fullText)) !== null) actionMatch = m;

      const action = actionMatch ? actionMatch[1].trim() : null;
      const text = fullText.replace(/\n?ACTION:\s*.+/gi, '').trim();

      return { text, action };
    } catch (error) {
      lastError = error;
      markKeyCooling(key, 30_000);
    }
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error('COACH_UNAVAILABLE');
}
