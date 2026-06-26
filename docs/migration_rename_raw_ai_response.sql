-- Rename food_entries.raw_gemini_response → raw_ai_response
-- Matches the lib/groq.ts rename: the provider is no longer Gemini.
-- food_entries is the legacy V0 table; addEntry() in stores/daily.store.ts
-- still falls back to it when the V1 (meals + food_items + scan_feedback)
-- insert fails. The V1 scan_feedback table already uses the
-- provider-agnostic raw_model_prediction column — no change there.

alter table public.food_entries
  rename column raw_gemini_response to raw_ai_response;
