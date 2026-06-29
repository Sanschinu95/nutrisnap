/**
 * Single source of truth for the Route graph data shape.
 *
 * The Route concept is "cumulative calories over the day":
 *   - X: normalized time-of-day position (0..1) based on when the meal was eaten
 *   - Y: normalized cumulative calorie total (0..1) — the curve only goes UP
 *   - meta: the original meal so the renderer can show thumbnails / labels
 *
 * Both the in-app NutritionRouteChart spline mode and the share-story Route
 * graph import from here so the two views always show the same shape.
 *
 * Note on chronology: we sort ASC by occurred_at_utc defensively even though
 * the store query is supposed to return ASC. A bad order would put the latest
 * meal in the middle of the curve — that was the production bug.
 */

export interface RouteMealInput {
  /** Stable id (meal_id) — used as a React key by callers. */
  id: string;
  /** ISO timestamp the meal was eaten. */
  occurredAt: string;
  /** Calories for this single meal. */
  calories: number;
  /** Optional photo URL for the node. */
  thumbnailUrl?: string;
}

export interface RoutePoint {
  /** 0..1, position along the time axis. */
  x: number;
  /** 0..1, position on the cumulative-calorie axis. */
  y: number;
  id: string;
  occurredAt: string;
  /** This meal's own calorie count (for labels, debugging). */
  calories: number;
  /** Running total at this meal (for labels). */
  cumulative: number;
  thumbnailUrl?: string;
}

function timestampMs(value: string): number {
  const n = new Date(value).getTime();
  if (Number.isFinite(n)) return n;
  // Fallback for "08:00" style strings used by mock data.
  const match = value.match(/^(\d{1,2}):(\d{2})/);
  if (match) {
    const today = new Date();
    today.setHours(Number(match[1]), Number(match[2]), 0, 0);
    return today.getTime();
  }
  return 0;
}

export function computeRoutePoints(meals: RouteMealInput[]): RoutePoint[] {
  if (meals.length === 0) return [];

  // Defensive sort — never trust upstream ordering.
  const sorted = [...meals].sort(
    (a, b) => timestampMs(a.occurredAt) - timestampMs(b.occurredAt),
  );

  const times = sorted.map((m) => timestampMs(m.occurredAt));
  const minTime = times[0];
  const maxTime = times[times.length - 1];
  const timeRange = maxTime - minTime || 1;

  let running = 0;
  const cumulative = sorted.map((m) => {
    running += Math.max(0, m.calories);
    return running;
  });
  const maxCumulative = cumulative[cumulative.length - 1] || 1;

  return sorted.map((meal, i) => ({
    x: sorted.length === 1 ? 0.5 : (times[i] - minTime) / timeRange,
    y: cumulative[i] / maxCumulative,
    id: meal.id,
    occurredAt: meal.occurredAt,
    calories: meal.calories,
    cumulative: cumulative[i],
    thumbnailUrl: meal.thumbnailUrl,
  }));
}
