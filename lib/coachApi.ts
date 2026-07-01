/**
 * Coach chat API. Now proxied through the `coach-chat` Supabase Edge Function
 * so the Groq keys stay server-side. See supabase/functions/coach-chat/index.ts.
 *
 * The client still owns two presentation concerns:
 *   - ACTION: <one-liner> extraction (rendered as a pinnable card)
 *   - cleanCoachText post-processing (em dashes, markdown scrubbing)
 */

import { supabase } from './supabase';

export interface CoachMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CoachResponse {
  text: string;
  action: string | null;
}

export async function sendCoachMessage(
  systemPrompt: string,
  conversationHistory: CoachMessage[],
  userMessage: string,
): Promise<CoachResponse> {
  const { data, error } = await supabase.functions.invoke<{
    content?: string;
    error?: string;
  }>('coach-chat', {
    body: {
      systemPrompt,
      history: conversationHistory,
      userMessage,
    },
  });

  if (error) {
    // supabase-js wraps HTTP errors in a FunctionsHttpError whose `context`
    // holds the underlying Response. Peek at the body to surface a stable
    // error code for the store.
    const status = (error as { context?: { status?: number } }).context?.status;
    if (status === 401) throw new Error('COACH_AUTH');
    if (status === 429) throw new Error('COACH_LIMIT');
    if (status === 503) throw new Error('COACH_BUSY');
    throw new Error('COACH_UNAVAILABLE');
  }

  const content = data?.content ?? '';
  if (!content) throw new Error('COACH_EMPTY');

  // Pull the ACTION: line (case-insensitive). Last match wins in case the
  // model accidentally produces multiple.
  const actionRegex = /ACTION:\s*(.+)/gi;
  let actionMatch: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = actionRegex.exec(content)) !== null) actionMatch = m;

  const rawAction = actionMatch ? actionMatch[1].trim() : null;
  const rawText = content.replace(/\n?ACTION:\s*.+/gi, '').trim();

  return {
    text: cleanCoachText(rawText),
    action: rawAction ? cleanCoachText(rawAction) : null,
  };
}

/**
 * Strip robotic-looking formatting: em dashes, markdown bold, bullets, headers.
 * Belt-and-suspenders on top of the prompt rule against em dashes.
 */
function cleanCoachText(text: string): string {
  return text
    .replace(/—/g, ', ')
    .replace(/--/g, ', ')
    .replace(/\*\*/g, '')
    .replace(/#{1,3}\s/g, '')
    .replace(/^\s*[-•]\s/gm, '')
    .replace(/,\s*,/g, ',')
    .trim();
}
