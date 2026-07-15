import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from './generated/prisma/internal/prismaNamespace';

/**
 * This is generally here for reference of all the error codes that Prisma might throw.
 *
 * https://github.com/prisma/prisma/issues/18871
 *
 * The subclasses below are intentionally empty marker classes — they exist only so callers can
 * `instanceof` a specific error code. They deliberately do NOT redeclare `code`: the base
 * constructor already carries the original error's `code` through, and `errorCodeToClass` is the
 * single source of truth mapping a code to its class. Redeclaring `code` as a field forced an
 * `override` modifier whose validity flipped between build configs (TS4113 vs TS4114), since the
 * generated Prisma client types `code` inconsistently across environments. No field, no conflict.
 */
export class PrismaError extends PrismaClientKnownRequestError {
  constructor(error: PrismaClientKnownRequestError) {
    super(error.message, {
      code: error.code,
      clientVersion: error.clientVersion,
      meta: error.meta,
      batchRequestIdx: error.batchRequestIdx,
    });
  }
}

export class PrismaAuthenticationFailedError extends PrismaError {}

export class PrismaDatabaseUnreachableError extends PrismaError {}

export class PrismaDatabaseTimeoutError extends PrismaError {}

export class PrismaDatabaseDoesNotExistError extends PrismaError {}

export class PrismaOperationTimeoutError extends PrismaError {}

export class PrismaDatabaseAlreadyExistsError extends PrismaError {}

export class PrismaUserAccessDeniedError extends PrismaError {}

export class PrismaTlsConnectionError extends PrismaError {}

export class PrismaSchemaValidationError extends PrismaError {}

export class PrismaInvalidDatabaseStringError extends PrismaError {}

export class PrismaUnderlyingModelError extends PrismaError {}

export class PrismaUnsupportedDatabaseVersionError extends PrismaError {}

export class PrismaIncorrectParametersError extends PrismaError {}

export class PrismaServerClosedConnectionError extends PrismaError {}

export class PrismaValueTooLongError extends PrismaError {}

export class PrismaRecordDoesNotExistError extends PrismaError {}

export class PrismaUniqueConstraintError extends PrismaError {}

export class PrismaForeignKeyConstraintError extends PrismaError {}

export class PrismaDatabaseConstraintError extends PrismaError {}

export class PrismaInvalidFieldValueError extends PrismaError {}

export class PrismaInvalidValueError extends PrismaError {}

export class PrismaDataValidationError extends PrismaError {}

export class PrismaQueryParsingError extends PrismaError {}

export class PrismaQueryValidationError extends PrismaError {}

export class PrismaRawQueryFailedError extends PrismaError {}

export class PrismaNullConstraintViolationError extends PrismaError {}

export class PrismaMissingRequiredValueError extends PrismaError {}

export class PrismaMissingRequiredArgumentError extends PrismaError {}

export class PrismaRelationViolationError extends PrismaError {}

export class PrismaRelatedRecordNotFoundError extends PrismaError {}

export class PrismaQueryInterpretationError extends PrismaError {}

export class PrismaRecordsNotConnectedError extends PrismaError {}

export class PrismaConnectedRecordsNotFoundError extends PrismaError {}

export class PrismaInputError extends PrismaError {}

export class PrismaValueOutOfRangeError extends PrismaError {}

export class PrismaTableDoesNotExistError extends PrismaError {}

export class PrismaColumnDoesNotExistError extends PrismaError {}

export class PrismaInconsistentColumnDataError extends PrismaError {}

export class PrismaConnectionPoolTimeoutError extends PrismaError {}

export class PrismaOperationFailedError extends PrismaError {}

export class PrismaUnsupportedFeatureError extends PrismaError {}

export class PrismaDatabaseQueryExecutionErrors extends PrismaError {}

export class PrismaTransactionApiError extends PrismaError {}

export class PrismaFulltextIndexNotFoundError extends PrismaError {}

export class PrismaMongoDBReplicaSetError extends PrismaError {}

export class PrismaNumberOutOfRangeError extends PrismaError {}

export class PrismaTransactionConflictError extends PrismaError {}

export class PrismaDatabaseCreationFailedError extends PrismaError {}

export class PrismaMigrationDestructiveChangesError extends PrismaError {}

export class PrismaMigrationRollbackError extends PrismaError {}

export class PrismaMigrationFormatChangedError extends PrismaError {}

export class PrismaSystemDatabaseAlterationError extends PrismaError {}

export class PrismaNonEmptySchemaError extends PrismaError {}

export class PrismaFailedMigrationError extends PrismaError {}

export class PrismaPreviewFeaturesBlockedError extends PrismaError {}

export class PrismaMigrationAlreadyAppliedError extends PrismaError {}

export class PrismaFailedMigrationsError extends PrismaError {}

export class PrismaMigrationNameTooLongError extends PrismaError {}

export class PrismaMigrationNotFoundForRollbackError extends PrismaError {}

export class PrismaMigrationNotInFailedStateError extends PrismaError {}

export class PrismaProviderArraysNotSupportedError extends PrismaError {}

export class PrismaShadowDatabaseCreationError extends PrismaError {}

export class PrismaMigrationFileNotFoundError extends PrismaError {}

export class PrismaDatabaseResetFallbackFailedError extends PrismaError {}

export class PrismaMigrationNotFoundError extends PrismaError {}

export class PrismaMigrationFailedToApplyError extends PrismaError {}

export class PrismaProviderMismatchError extends PrismaError {}

export class PrismaShadowDatabaseDisabledError extends PrismaError {}

export class PrismaNoForeignKeysError extends PrismaError {}

export class PrismaNoDirectDdlError extends PrismaError {}

export class PrismaIntrospectionFailedError extends PrismaError {}

export class PrismaEmptyIntrospectedDatabaseError extends PrismaError {}

export class PrismaInconsistentIntrospectedSchemaError extends PrismaError {}

export class PrismaDataProxyRequestError extends PrismaError {}

export class PrismaDataProxyRetryRequestError extends PrismaError {}

export class PrismaDataProxyInvalidDatasourceError extends PrismaError {}

export class PrismaDataProxyResourceNotFoundError extends PrismaError {}

export class PrismaDataProxyFeatureNotImplementedError extends PrismaError {}

export class PrismaDataProxySchemaUploadError extends PrismaError {}

export class PrismaDataProxyUnknownServerError extends PrismaError {}

export class PrismaDataProxyUnauthorizedError extends PrismaError {}

export class PrismaDataProxyUsageExceededError extends PrismaError {}

export class PrismaDataProxyRequestTimeoutError extends PrismaError {}

export class PrismaDataProxyFetchError extends PrismaError {}

export class PrismaDataProxyInvalidRequestParametersError extends PrismaError {}

export class PrismaDataProxyUnsupportedEngineVersionError extends PrismaError {}

export class PrismaDataProxyEngineStartupError extends PrismaError {}

export class PrismaDataProxyUnknownEngineStartupError extends PrismaError {}

export class PrismaDataProxyInteractiveTransactionError extends PrismaError {}

const errorCodeToClass = {
  P1000: PrismaAuthenticationFailedError,
  P1001: PrismaDatabaseUnreachableError,
  P1002: PrismaDatabaseTimeoutError,
  P1003: PrismaDatabaseDoesNotExistError,
  P1008: PrismaOperationTimeoutError,
  P1009: PrismaDatabaseAlreadyExistsError,
  P1010: PrismaUserAccessDeniedError,
  P1011: PrismaTlsConnectionError,
  P1012: PrismaSchemaValidationError,
  P1013: PrismaInvalidDatabaseStringError,
  P1014: PrismaUnderlyingModelError,
  P1015: PrismaUnsupportedDatabaseVersionError,
  P1016: PrismaIncorrectParametersError,
  P1017: PrismaServerClosedConnectionError,
  P2000: PrismaValueTooLongError,
  P2001: PrismaRecordDoesNotExistError,
  P2002: PrismaUniqueConstraintError,
  P2003: PrismaForeignKeyConstraintError,
  P2004: PrismaDatabaseConstraintError,
  P2005: PrismaInvalidFieldValueError,
  P2006: PrismaInvalidValueError,
  P2007: PrismaDataValidationError,
  P2008: PrismaQueryParsingError,
  P2009: PrismaQueryValidationError,
  P2010: PrismaRawQueryFailedError,
  P2011: PrismaNullConstraintViolationError,
  P2012: PrismaMissingRequiredValueError,
  P2013: PrismaMissingRequiredArgumentError,
  P2014: PrismaRelationViolationError,
  P2015: PrismaRelatedRecordNotFoundError,
  P2016: PrismaQueryInterpretationError,
  P2017: PrismaRecordsNotConnectedError,
  P2018: PrismaConnectedRecordsNotFoundError,
  P2019: PrismaInputError,
  P2020: PrismaValueOutOfRangeError,
  P2021: PrismaTableDoesNotExistError,
  P2022: PrismaColumnDoesNotExistError,
  P2023: PrismaInconsistentColumnDataError,
  P2024: PrismaConnectionPoolTimeoutError,
  P2025: PrismaOperationFailedError,
  P2026: PrismaUnsupportedFeatureError,
  P2027: PrismaDatabaseQueryExecutionErrors,
  P2028: PrismaTransactionApiError,
  P2030: PrismaFulltextIndexNotFoundError,
  P2031: PrismaMongoDBReplicaSetError,
  P2033: PrismaNumberOutOfRangeError,
  P2034: PrismaTransactionConflictError,
  P3000: PrismaDatabaseCreationFailedError,
  P3001: PrismaMigrationDestructiveChangesError,
  P3002: PrismaMigrationRollbackError,
  P3003: PrismaMigrationFormatChangedError,
  P3004: PrismaSystemDatabaseAlterationError,
  P3005: PrismaNonEmptySchemaError,
  P3006: PrismaFailedMigrationError,
  P3007: PrismaPreviewFeaturesBlockedError,
  P3008: PrismaMigrationAlreadyAppliedError,
  P3009: PrismaFailedMigrationsError,
  P3010: PrismaMigrationNameTooLongError,
  P3011: PrismaMigrationNotFoundForRollbackError,
  P3012: PrismaMigrationNotInFailedStateError,
  P3013: PrismaProviderArraysNotSupportedError,
  P3014: PrismaShadowDatabaseCreationError,
  P3015: PrismaMigrationFileNotFoundError,
  P3016: PrismaDatabaseResetFallbackFailedError,
  P3017: PrismaMigrationNotFoundError,
  P3018: PrismaMigrationFailedToApplyError,
  P3019: PrismaProviderMismatchError,
  P3020: PrismaShadowDatabaseDisabledError,
  P3021: PrismaNoForeignKeysError,
  P3022: PrismaNoDirectDdlError,
  P4000: PrismaIntrospectionFailedError,
  P4001: PrismaEmptyIntrospectedDatabaseError,
  P4002: PrismaInconsistentIntrospectedSchemaError,
  P5000: PrismaDataProxyRequestError,
  P5001: PrismaDataProxyRetryRequestError,
  P5002: PrismaDataProxyInvalidDatasourceError,
  P5003: PrismaDataProxyResourceNotFoundError,
  P5004: PrismaDataProxyFeatureNotImplementedError,
  P5005: PrismaDataProxySchemaUploadError,
  P5006: PrismaDataProxyUnknownServerError,
  P5007: PrismaDataProxyUnauthorizedError,
  P5008: PrismaDataProxyUsageExceededError,
  P5009: PrismaDataProxyRequestTimeoutError,
  P5010: PrismaDataProxyFetchError,
  P5011: PrismaDataProxyInvalidRequestParametersError,
  P5012: PrismaDataProxyUnsupportedEngineVersionError,
  P5013: PrismaDataProxyEngineStartupError,
  P5014: PrismaDataProxyUnknownEngineStartupError,
  P5015: PrismaDataProxyInteractiveTransactionError,
} as const;

type ErrorCode = keyof typeof errorCodeToClass;

/**
 * Runtime type guard for errors thrown by generated Prisma client code. Returns `true` when `error`
 * is one of Prisma's known request, unknown request, or validation error types.
 */
export function isPrismaError(
  error: unknown,
): error is PrismaClientKnownRequestError | PrismaClientUnknownRequestError | PrismaClientValidationError {
  return (
    error instanceof PrismaClientKnownRequestError ||
    error instanceof PrismaClientUnknownRequestError ||
    error instanceof PrismaClientValidationError
  );
}

/**
 * Maps a Prisma known request error to its typed marker subclass based on the error code. If the
 * code has no mapping in `errorCodeToClass`, the original `PrismaClientKnownRequestError` is returned
 * unchanged, so callers should treat the return type as the union of both.
 */
export function toTypedPrismaError(error: PrismaClientKnownRequestError) {
  const code: ErrorCode = error.code as ErrorCode;
  const ErrorClass = errorCodeToClass[code];
  if (!ErrorClass) {
    return error;
  }
  return new ErrorClass(error);
}
