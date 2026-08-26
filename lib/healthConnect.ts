/**
 * Health Connect (Android) step reader.
 *
 * Reads the day's aggregated step total from Android's Health Connect — the
 * system health store that fitness apps (Google Fit, Samsung Health, Fitbit,
 * the phone's built-in tracker) write to. Far more reliable than the raw
 * hardware step-counter sensor.
 *
 * The native module is required lazily and every call is guarded, so the app
 * keeps working (falling back to the pedometer) on iOS, on any build that
 * predates this module, or when Health Connect isn't installed/available.
 */

import { Platform } from 'react-native';

type HCModule = typeof import('react-native-health-connect');

function load(): HCModule | null {
  if (Platform.OS !== 'android') return null;
  try {
    return require('react-native-health-connect') as HCModule;
  } catch {
    return null;
  }
}

// From react-native-health-connect's SdkAvailabilityStatus: SDK_AVAILABLE = 3.
const SDK_AVAILABLE = 3;

let initialized = false;
async function ensureInit(HC: HCModule): Promise<boolean> {
  if (initialized) return true;
  try {
    initialized = await HC.initialize();
    return initialized;
  } catch {
    return false;
  }
}

async function hasStepPermission(HC: HCModule): Promise<boolean> {
  try {
    const granted = await HC.getGrantedPermissions();
    return granted.some((p) => (p as { recordType?: string; accessType?: string }).recordType === 'Steps'
      && (p as { accessType?: string }).accessType === 'read');
  } catch {
    return false;
  }
}

/** Whether Health Connect is installed and usable on this device. */
export async function isHealthConnectAvailable(): Promise<boolean> {
  const HC = load();
  if (!HC) return false;
  try {
    return (await HC.getSdkStatus()) === SDK_AVAILABLE;
  } catch {
    return false;
  }
}

/**
 * Whether read-steps permission is ALREADY granted. Uses getGrantedPermissions
 * only — never the permission-request launcher, which crashes on Expo builds
 * (the native launcher isn't registered by the generated MainActivity:
 * "lateinit property requestPermission has not been initialized"). Because of
 * that, we don't request in-app; users grant via the Health Connect app, which
 * openHealthConnectSettings() below deep-links to.
 */
export async function hasHealthConnectStepPermission(): Promise<boolean> {
  const HC = load();
  if (!HC) return false;
  if (!(await ensureInit(HC))) return false;
  return hasStepPermission(HC);
}

/** Today's total steps from Health Connect, or null if unavailable/denied. */
export async function getTodayStepsFromHealthConnect(): Promise<number | null> {
  const HC = load();
  if (!HC) return null;
  if (!(await ensureInit(HC))) return null;
  if (!(await hasStepPermission(HC))) return null;
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    const res = await HC.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: { operator: 'between', startTime: start.toISOString(), endTime: end.toISOString() },
    });
    const total = (res as { COUNT_TOTAL?: number }).COUNT_TOTAL;
    const n = typeof total === 'number' ? total : Number(total);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return null;
  }
}

/** Opens the system Health Connect settings (e.g. to grant/manage access). */
export function openHealthConnectSettings(): void {
  const HC = load();
  try {
    HC?.openHealthConnectSettings?.();
  } catch {
    /* noop */
  }
}
