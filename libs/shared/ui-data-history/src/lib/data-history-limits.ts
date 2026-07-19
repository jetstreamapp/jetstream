import { DataHistorySettings } from '@jetstream/types';
import { isBrowserExtensionApp, isCanvasApp, isDesktopApp } from './platform';

/**
 * Tiered storage limits (decision: history is available to ALL users; only quota/retention
 * differs by plan). Mirrors the load-file-size tiering in `SelectObjectAndFile` where desktop,
 * browser extension, and canvas always get the top tier.
 */

const MB = 1024 * 1024;
const GB = 1024 * MB;

export interface DataHistoryTierLimits {
  maxTotalBytes: number;
  retentionDaysMax: number;
  defaultRetentionDays: number;
}

export const DATA_HISTORY_FREE_TIER_LIMITS: DataHistoryTierLimits = {
  maxTotalBytes: 500 * MB,
  retentionDaysMax: 60,
  defaultRetentionDays: 60,
};

export const DATA_HISTORY_PAID_TIER_LIMITS: DataHistoryTierLimits = {
  maxTotalBytes: 10 * GB,
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
    maxTotalBytes: tier.maxTotalBytes,
  };
}

/** User-chosen settings can never exceed the tier's ceiling */
export function clampSettingsToTier(settings: DataHistorySettings, tier: DataHistoryTierLimits): DataHistorySettings {
  return {
    enabled: settings.enabled,
    retentionDays: Math.min(Math.max(1, settings.retentionDays), tier.retentionDaysMax),
    maxTotalBytes: Math.min(Math.max(1 * MB, settings.maxTotalBytes), tier.maxTotalBytes),
  };
}
