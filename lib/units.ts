/**
 * Unit conversion + formatting helpers.
 *
 * Invariant: every persisted value (profiles.weight_kg, profiles.height_cm,
 * hydration in ml) is stored in SI. Conversion happens only at the input
 * and display boundaries — never in business logic.
 */

export type UnitPreference = 'metric' | 'imperial';

const KG_PER_LB = 0.45359237;
const CM_PER_INCH = 2.54;
const CM_PER_FOOT = 30.48;
const ML_PER_FL_OZ = 29.5735;

/* ─── Weight ─────────────────────────────────────────────── */

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

/* ─── Height ─────────────────────────────────────────────── */

export function cmToInches(cm: number): number {
  return cm / CM_PER_INCH;
}

/** Convert cm to a {feet, inches} pair, with inches rounded to nearest whole. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToInches(cm);
  let feet = Math.floor(totalInches / 12);
  let inches = Math.round(totalInches - feet * 12);
  // Normalize 12 inches → 1 foot
  if (inches === 12) {
    feet += 1;
    inches = 0;
  }
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return feet * CM_PER_FOOT + inches * CM_PER_INCH;
}

/* ─── Volume ─────────────────────────────────────────────── */

export function mlToFlOz(ml: number): number {
  return ml / ML_PER_FL_OZ;
}

export function flOzToMl(flOz: number): number {
  return flOz * ML_PER_FL_OZ;
}

/* ─── Display formatters ─────────────────────────────────── */

export function formatWeight(kg: number | null | undefined, unit: UnitPreference): string {
  if (kg == null || !Number.isFinite(kg)) return '–';
  if (unit === 'imperial') return `${kgToLb(kg).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

export function formatHeight(cm: number | null | undefined, unit: UnitPreference): string {
  if (cm == null || !Number.isFinite(cm)) return '–';
  if (unit === 'imperial') {
    const { feet, inches } = cmToFeetInches(cm);
    return `${feet}′ ${inches}″`;
  }
  return `${Math.round(cm)} cm`;
}

/** Volume for "today's water" pill etc. Picks L vs fl oz scale. */
export function formatVolume(ml: number | null | undefined, unit: UnitPreference): string {
  if (ml == null || !Number.isFinite(ml)) return '–';
  if (unit === 'imperial') return `${Math.round(mlToFlOz(ml))} fl oz`;
  // Metric: show liters with one decimal once we cross 1L, ml below
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} L`;
  return `${Math.round(ml)} ml`;
}

export function unitLabel(unit: UnitPreference): string {
  return unit === 'imperial' ? 'lb / ft·in' : 'kg / cm';
}

/* ─── Water quick-add sizes ──────────────────────────────── */

/**
 * Quick-add water sizes in SI (ml), labeled per unit system.
 * Imperial picks 8 fl oz (≈237 ml) and 16 fl oz (≈473 ml) — the standard
 * US cup and pint sizes. Metric picks the existing 250 ml glass + 500 ml bottle.
 */
export function getWaterQuickAdds(unit: UnitPreference): Array<{ ml: number; label: string }> {
  if (unit === 'imperial') {
    return [
      { ml: Math.round(flOzToMl(8)), label: '8 oz' },
      { ml: Math.round(flOzToMl(16)), label: '16 oz' },
    ];
  }
  return [
    { ml: 250, label: '250 ml' },
    { ml: 500, label: '500 ml' },
  ];
}

/* ─── Locale default ─────────────────────────────────────── */

/**
 * Best-effort locale-based default. en-US, en-LR, my-MM use imperial — all
 * others get metric. Uses the Hermes-native Intl API, no extra dependency.
 */
export function detectDefaultUnit(): UnitPreference {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale ?? '';
    const lower = locale.toLowerCase();
    if (lower.startsWith('en-us') || lower.startsWith('en-lr') || lower.startsWith('my-mm')) {
      return 'imperial';
    }
    return 'metric';
  } catch {
    return 'metric';
  }
}
