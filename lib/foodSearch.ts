/**
 * Manual-entry food search backed by Open Food Facts (world.openfoodfacts.org).
 *
 * Why OFF: free, no API key (nothing baked into the bundle), very large
 * packaged-food coverage including Indian brands. Returns multiple options for
 * a typed name so the user picks the right one — verified label data instead
 * of a single AI guess. The AI estimate remains as a fallback for home-cooked
 * dishes the database doesn't know.
 */

export interface FoodSearchResult {
  /** Product name, possibly with brand appended for disambiguation. */
  name: string;
  brand: string | null;
  /** Human label for what the values describe, e.g. "1 serving (55 g)" or "per 100 g". */
  servingLabel: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

interface OffNutriments {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  'energy-kcal_serving'?: number;
  proteins_serving?: number;
  carbohydrates_serving?: number;
  fat_serving?: number;
}

interface OffProduct {
  product_name?: string;
  brands?: string;
  serving_size?: string;
  nutriments?: OffNutriments;
}

const SEARCH_URL = 'https://world.openfoodfacts.org/cgi/search.pl';
const FIELDS = 'product_name,brands,serving_size,nutriments';
const TIMEOUT_MS = 7000;

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toResult(p: OffProduct): FoodSearchResult | null {
  const name = p.product_name?.trim();
  const n = p.nutriments;
  if (!name || !n) return null;

  const brand = p.brands?.split(',')[0]?.trim() || null;

  // Prefer per-serving values when the product declares a serving size;
  // otherwise fall back to per-100g so every result is still comparable.
  const perServing = num(n['energy-kcal_serving']);
  if (perServing !== null && p.serving_size) {
    return {
      name,
      brand,
      servingLabel: `1 serving (${p.serving_size})`,
      calories: Math.round(perServing),
      protein_g: Math.round(num(n.proteins_serving) ?? 0),
      carbs_g: Math.round(num(n.carbohydrates_serving) ?? 0),
      fat_g: Math.round(num(n.fat_serving) ?? 0),
    };
  }

  const per100 = num(n['energy-kcal_100g']);
  if (per100 === null) return null;
  return {
    name,
    brand,
    servingLabel: 'per 100 g',
    calories: Math.round(per100),
    protein_g: Math.round(num(n.proteins_100g) ?? 0),
    carbs_g: Math.round(num(n.carbohydrates_100g) ?? 0),
    fat_g: Math.round(num(n.fat_100g) ?? 0),
  };
}

/**
 * Search Open Food Facts for a food name. Returns up to `limit` options,
 * most-scanned first. Fails soft: any network/parse problem returns [].
 */
export async function searchFoods(query: string, limit = 8): Promise<FoodSearchResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    search_terms: q,
    search_simple: '1',
    action: 'process',
    json: '1',
    page_size: String(limit * 2), // fetch extra; some rows lack usable data
    fields: FIELDS,
    sort_by: 'unique_scans_n',
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        // OFF asks API users to identify themselves.
        'User-Agent': 'Nyurix/1.0 (support@nyurix.app)',
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OffProduct[] };

    const seen = new Set<string>();
    const results: FoodSearchResult[] = [];
    for (const p of data.products ?? []) {
      const r = toResult(p);
      if (!r) continue;
      const key = `${r.name.toLowerCase()}|${(r.brand ?? '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(r);
      if (results.length >= limit) break;
    }
    return results;
  } catch {
    return []; // offline / timeout / OFF hiccup — the AI fallback still works
  } finally {
    clearTimeout(timer);
  }
}
