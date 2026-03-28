import { ApiConnection } from '@jetstream/salesforce-api';
import { logger } from '@jetstream/shared/client-logger';
import { SoqlQueryFormatOptionsSchema } from '@jetstream/types';
import { z } from 'zod';
import { createRoute, handleErrorResponse, handleJsonResponse, RouteValidator } from './route.utils';

// Namespace-qualified API names for the managed package custom setting fields
const NS = 'jetstream__';
const SOBJECT = `${NS}UserPreferences__c`;
const FIELD = {
  skipFrontdoorLogin: `${NS}SkipFrontdoorLogin__c`,
  recordSyncEnabled: `${NS}RecordSyncEnabled__c`,
  numIndent: `${NS}NumIndent__c`,
  fieldMaxLineLength: `${NS}FieldMaxLineLength__c`,
  subqueryParensOnOwnLine: `${NS}SubqueryParensOnOwnLine__c`,
  whereClauseOpsIndented: `${NS}WhereClauseOpsIndented__c`,
  newLineAfterKeywords: `${NS}NewLineAfterKeywords__c`,
} as const;

const ALL_FIELDS = Object.values(FIELD).join(', ');

const PreferencesBodySchema = z.object({
  preferences: z.object({
    skipFrontdoorLogin: z.boolean().optional(),
    recordSyncEnabled: z.boolean().optional(),
    soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.optional(),
  }),
});

export const routeDefinition = {
  getPreferences: {
    controllerFn: () => getPreferences,
    validators: {
      hasSourceOrg: true,
    } satisfies RouteValidator,
  },
  savePreferences: {
    controllerFn: () => savePreferences,
    validators: {
      hasSourceOrg: true,
      body: PreferencesBodySchema,
    } satisfies RouteValidator,
  },
};

interface CustomSettingRecord {
  Id: string;
  [key: string]: unknown;
}

/** Maps a Salesforce custom setting record to our app preferences shape */
function recordToPreferences(record: CustomSettingRecord) {
  return {
    skipFrontdoorLogin: record[FIELD.skipFrontdoorLogin] as boolean | undefined,
    recordSyncEnabled: record[FIELD.recordSyncEnabled] as boolean | undefined,
    soqlQueryFormatOptions: {
      numIndent: record[FIELD.numIndent] as number | undefined,
      fieldMaxLineLength: record[FIELD.fieldMaxLineLength] as number | undefined,
      fieldSubqueryParensOnOwnLine: record[FIELD.subqueryParensOnOwnLine] as boolean | undefined,
      whereClauseOperatorsIndented: record[FIELD.whereClauseOpsIndented] as boolean | undefined,
      newLineAfterKeywords: record[FIELD.newLineAfterKeywords] as boolean | undefined,
    },
  };
}

/** Maps our app preferences to Salesforce custom setting field values */
function preferencesToFieldValues(preferences: z.infer<typeof PreferencesBodySchema>['preferences']) {
  const fields: Record<string, unknown> = {};
  if (preferences.skipFrontdoorLogin !== undefined) {
    fields[FIELD.skipFrontdoorLogin] = preferences.skipFrontdoorLogin;
  }
  if (preferences.recordSyncEnabled !== undefined) {
    fields[FIELD.recordSyncEnabled] = preferences.recordSyncEnabled;
  }
  if (preferences.soqlQueryFormatOptions) {
    const opts = preferences.soqlQueryFormatOptions;
    if (opts.numIndent !== undefined) {
      fields[FIELD.numIndent] = opts.numIndent;
    }
    if (opts.fieldMaxLineLength !== undefined) {
      fields[FIELD.fieldMaxLineLength] = opts.fieldMaxLineLength;
    }
    if (opts.fieldSubqueryParensOnOwnLine !== undefined) {
      fields[FIELD.subqueryParensOnOwnLine] = opts.fieldSubqueryParensOnOwnLine;
    }
    if (opts.whereClauseOperatorsIndented !== undefined) {
      fields[FIELD.whereClauseOpsIndented] = opts.whereClauseOperatorsIndented;
    }
    if (opts.newLineAfterKeywords !== undefined) {
      fields[FIELD.newLineAfterKeywords] = opts.newLineAfterKeywords;
    }
  }
  return fields;
}

async function queryExistingRecord(conn: ApiConnection) {
  const userId = window.sr.context.user.userId;
  const soql = `SELECT Id, ${ALL_FIELDS} FROM ${SOBJECT} WHERE SetupOwnerId = '${userId}' LIMIT 1`;
  const { queryResults } = await conn.query.query<CustomSettingRecord>(soql);
  return queryResults;
}

const getPreferences = createRoute(routeDefinition.getPreferences.validators, async ({ jetstreamConn }) => {
  try {
    const queryResults = await queryExistingRecord(jetstreamConn!);

    if (queryResults.totalSize > 0) {
      const preferences = recordToPreferences(queryResults.records[0]);
      return handleJsonResponse(preferences);
    }

    return handleJsonResponse({});
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});

const savePreferences = createRoute(routeDefinition.savePreferences.validators, async ({ body, jetstreamConn }) => {
  try {
    const fieldValues = preferencesToFieldValues(body.preferences);
    const apiVersion = jetstreamConn!.sessionInfo.apiVersion;

    // Check if a record already exists for this user
    let existingRecordId: string | null = null;
    try {
      const queryResults = await queryExistingRecord(jetstreamConn!);
      if (queryResults.totalSize > 0) {
        existingRecordId = queryResults.records[0].Id;
      }
    } catch (ex) {
      logger.warn('Failed to query existing preferences record', ex);
    }

    if (existingRecordId) {
      await jetstreamConn!.request.manualRequest({
        method: 'PATCH',
        url: `/services/data/v${apiVersion}/sobjects/${SOBJECT}/${existingRecordId}`,
        body: fieldValues,
      });
    } else {
      const userId = window.sr.context.user.userId;
      await jetstreamConn!.request.manualRequest({
        method: 'POST',
        url: `/services/data/v${apiVersion}/sobjects/${SOBJECT}`,
        body: {
          SetupOwnerId: userId,
          ...fieldValues,
        },
      });
    }

    // Return the merged preferences by re-reading the record
    const updatedResults = await queryExistingRecord(jetstreamConn!);
    if (updatedResults.totalSize > 0) {
      return handleJsonResponse(recordToPreferences(updatedResults.records[0]));
    }
    return handleJsonResponse(body.preferences);
  } catch (ex) {
    return handleErrorResponse(ex);
  }
});
