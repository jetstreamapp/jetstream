import { DataHistorySettings } from '@jetstream/types';
import { isBrowserExtensionApp, isCanvasApp, isDesktopApp } from './platform';

/**
 * Tiered limits (decision: history is available to ALL users; only limits differ by plan).
 * Free plans are capped by ENTRY COUNT (15 most recent — easy to reason about); paid plans (and
 * desktop/extension/canvas, which always get the top tier) keep unlimited entries for up to a
 * year. `maxTotalBytes` is an internal safety backstop against runaway disk usage — it is NOT a
 * user-facing setting.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

export interface DataHistoryTierLimits {
  /** Internal size backstop — never surfaced as a user control */
  maxTotalBytes: number;
  /** Maximum stored entries (null = unlimited). The free-tier cap. */
  maxEntries: number | null;
  retentionDaysMax: number;
  defaultRetentionDays: number;
}

export const DATA_HISTORY_FREE_TIER_LIMITS: DataHistoryTierLimits = {
  maxTotalBytes: 500 * MB,
  maxEntries: 15,
  retentionDaysMax: 60,
  defaultRetentionDays: 60,
};

export const DATA_HISTORY_PAID_TIER_LIMITS: DataHistoryTierLimits = {
  maxTotalBytes: 10 * GB,
  maxEntries: null,
  retentionDaysMax: 365,
  defaultRetentionDays: 365,
};

/** Single-record actions at or below this JSON size are stored inline in the Dexie row */
export const DATA_HISTORY_INLINE_PAYLOAD_MAX_BYTES = 64 * 1024;

/** `in-progress` entries older than this are reclassified `incomplete` by the sweep */
export const DATA_HISTORY_STALE_IN_PROGRESS_MS = 24 * 60 * 60 * 1000;

export function getDataHistoryTierLimits({ hasPaidPlan }: { hasPaidPlan: boolean }): DataHistoryTierLimits {
  if (hasPaidPlan || isDesktopApp() || isBrowserExtensionApp() || isCanvasApp()) {
    return DATA_HISTORY_PAID_TIER_LIMITS;
  }
  return DATA_HISTORY_FREE_TIER_LIMITS;
}

export function getDefaultDataHistorySettings(tier: DataHistoryTierLimits): DataHistorySettings {
  return {
    enabled: true,
    retentionDays: tier.defaultRetentionDays,
  };
}

/** User-chosen settings can never exceed the tier's ceiling */
export function clampSettingsToTier(settings: DataHistorySettings, tier: DataHistoryTierLimits): DataHistorySettings {
  return {
    enabled: settings.enabled,
    retentionDays: Math.min(Math.max(1, settings.retentionDays), tier.retentionDaysMax),
  };
}
