import type { AutomationMetadataType } from './types';

/**
 * Types for Automation Control history — a device-local log of every activation change deployed from
 * Automation Control, so changes can be rolled back or re-deployed after the browser was closed.
 *
 * Rows live in the local-only `automation_control_history` Dexie table (see
 * `automation-control-history.db.ts`). Only the activation state is recorded, never the metadata
 * body: a rollback or re-deploy re-reads the current metadata from Salesforce and changes nothing
 * but the active flag/version, exactly like a deploy from the editor.
 */

/**
 * - `deploy`   — changes made in the editor and deployed
 * - `rollback` — the Rollback button right after a deploy, or a rollback started from history
 * - `redeploy` — a previous deployment re-applied from history
 */
export type AutomationControlHistoryAction = 'deploy' | 'rollback' | 'redeploy';

/** What can be started from a history entry */
export type AutomationControlRestoreAction = Exclude<AutomationControlHistoryAction, 'deploy'>;

/**
 * `incomplete` = no result was received, e.g. the page was closed mid-deploy, so the change may or may not
 * have been applied in Salesforce
 */
export type AutomationControlHistoryItemStatus = 'success' | 'error' | 'incomplete';

export interface AutomationControlActivationState {
  isActive: boolean;
  /** Flows and Process Builders only — the active version, null when inactive */
  activeVersionNumber: number | null;
}

export interface AutomationControlHistoryItem {
  /**
   * Automation Control row key (`<type>_<Salesforce id>`). Built from Salesforce ids, so it identifies
   * the same automation across sessions and is how a restore finds the row to stage.
   */
  key: string;
  type: AutomationMetadataType;
  /** Metadata API fullName, used to build a deployable package for the entry */
  fullName: string;
  sobject: string;
  label: string;
  previous: AutomationControlActivationState;
  deployed: AutomationControlActivationState;
  status: AutomationControlHistoryItemStatus;
  errorMessage: string | null;
}

/** The history entry a rollback or re-deploy was started from */
export interface AutomationControlHistorySource {
  key: string;
  createdAt: Date;
}

export interface AutomationControlHistoryEntry {
  /** `ach_<uuid>` */
  key: string;
  /** Org uniqueId */
  org: string;
  action: AutomationControlHistoryAction;
  source: AutomationControlHistorySource | null;
  createdAt: Date;
  /** Distinct objects and automation types across `items`, used to load the editor for a restore */
  sobjects: string[];
  types: AutomationMetadataType[];
  successCount: number;
  errorCount: number;
  incompleteCount: number;
  items: AutomationControlHistoryItem[];
}
