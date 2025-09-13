import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
  PrismaClientValidationError,
} from './generated/prisma/runtime/library';

/**
 * This is generally here for reference of all the error codes that Prisma might throw.
 *
 * https://github.com/prisma/prisma/issues/18871
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

export class PrismaAuthenticationFailedError extends PrismaError {
  code = 'P1000';
}

export class PrismaDatabaseUnreachableError extends PrismaError {
  code = 'P1001';
}

export class PrismaDatabaseTimeoutError extends PrismaError {
  code = 'P1002';
}

export class PrismaDatabaseDoesNotExistError extends PrismaError {
  code = 'P1003';
}

export class PrismaOperationTimeoutError extends PrismaError {
  code = 'P1008';
}

export class PrismaDatabaseAlreadyExistsError extends PrismaError {
  code = 'P1009';
}

export class PrismaUserAccessDeniedError extends PrismaError {
  code = 'P1010';
}

export class PrismaTlsConnectionError extends PrismaError {
  code = 'P1011';
}

export class PrismaSchemaValidationError extends PrismaError {
  code = 'P1012';
}

export class PrismaInvalidDatabaseStringError extends PrismaError {
  code = 'P1013';
}

export class PrismaUnderlyingModelError extends PrismaError {
  code = 'P1014';
}

export class PrismaUnsupportedDatabaseVersionError extends PrismaError {
  code = 'P1015';
}

export class PrismaIncorrectParametersError extends PrismaError {
  code = 'P1016';
}

export class PrismaServerClosedConnectionError extends PrismaError {
  code = 'P1017';
}

export class PrismaValueTooLongError extends PrismaError {
  code = 'P2000';
}

export class PrismaRecordDoesNotExistError extends PrismaError {
  code = 'P2001';
}

export class PrismaUniqueConstraintError extends PrismaError {
  code = 'P2002';
}

export class PrismaForeignKeyConstraintError extends PrismaError {
  code = 'P2003';
}

export class PrismaDatabaseConstraintError extends PrismaError {
  code = 'P2004';
}

export class PrismaInvalidFieldValueError extends PrismaError {
  code = 'P2005';
}

export class PrismaInvalidValueError extends PrismaError {
  code = 'P2006';
}

export class PrismaDataValidationError extends PrismaError {
  code = 'P2007';
}

export class PrismaQueryParsingError extends PrismaError {
  code = 'P2008';
}

export class PrismaQueryValidationError extends PrismaError {
  code = 'P2009';
}

export class PrismaRawQueryFailedError extends PrismaError {
  code = 'P2010';
}

export class PrismaNullConstraintViolationError extends PrismaError {
  code = 'P2011';
}

export class PrismaMissingRequiredValueError extends PrismaError {
  code = 'P2012';
}

export class PrismaMissingRequiredArgumentError extends PrismaError {
  code = 'P2013';
}

export class PrismaRelationViolationError extends PrismaError {
  code = 'P2014';
}

export class PrismaRelatedRecordNotFoundError extends PrismaError {
  code = 'P2015';
}

export class PrismaQueryInterpretationError extends PrismaError {
  code = 'P2016';
}

export class PrismaRecordsNotConnectedError extends PrismaError {
  code = 'P2017';
}

export class PrismaConnectedRecordsNotFoundError extends PrismaError {
  code = 'P2018';
}

export class PrismaInputError extends PrismaError {
  code = 'P2019';
}

export class PrismaValueOutOfRangeError extends PrismaError {
  code = 'P2020';
}

export class PrismaTableDoesNotExistError extends PrismaError {
  code = 'P2021';
}

export class PrismaColumnDoesNotExistError extends PrismaError {
  code = 'P2022';
}

export class PrismaInconsistentColumnDataError extends PrismaError {
  code = 'P2023';
}

export class PrismaConnectionPoolTimeoutError extends PrismaError {
  code = 'P2024';
}

export class PrismaOperationFailedError extends PrismaError {
  code = 'P2025';
}

export class PrismaUnsupportedFeatureError extends PrismaError {
  code = 'P2026';
}

export class PrismaDatabaseQueryExecutionErrors extends PrismaError {
  code = 'P2027';
}

export class PrismaTransactionApiError extends PrismaError {
  code = 'P2028';
}

export class PrismaFulltextIndexNotFoundError extends PrismaError {
  code = 'P2030';
}

export class PrismaMongoDBReplicaSetError extends PrismaError {
  code = 'P2031';
}

export class PrismaNumberOutOfRangeError extends PrismaError {
  code = 'P2033';
}

export class PrismaTransactionConflictError extends PrismaError {
  code = 'P2034';
}

export class PrismaDatabaseCreationFailedError extends PrismaError {
  code = 'P3000';
}

export class PrismaMigrationDestructiveChangesError extends PrismaError {
  code = 'P3001';
}

export class PrismaMigrationRollbackError extends PrismaError {
  code = 'P3002';
}

export class PrismaMigrationFormatChangedError extends PrismaError {
  code = 'P3003';
}

export class PrismaSystemDatabaseAlterationError extends PrismaError {
  code = 'P3004';
}

export class PrismaNonEmptySchemaError extends PrismaError {
  code = 'P3005';
}

export class PrismaFailedMigrationError extends PrismaError {
  code = 'P3006';
}

export class PrismaPreviewFeaturesBlockedError extends PrismaError {
  code = 'P3007';
}

export class PrismaMigrationAlreadyAppliedError extends PrismaError {
  code = 'P3008';
}

export class PrismaFailedMigrationsError extends PrismaError {
  code = 'P3009';
}

export class PrismaMigrationNameTooLongError extends PrismaError {
  code = 'P3010';
}

export class PrismaMigrationNotFoundForRollbackError extends PrismaError {
  code = 'P3011';
}

export class PrismaMigrationNotInFailedStateError extends PrismaError {
  code = 'P3012';
}

export class PrismaProviderArraysNotSupportedError extends PrismaError {
  code = 'P3013';
}

export class PrismaShadowDatabaseCreationError extends PrismaError {
  code = 'P3014';
}

export class PrismaMigrationFileNotFoundError extends PrismaError {
  code = 'P3015';
}

export class PrismaDatabaseResetFallbackFailedError extends PrismaError {
  code = 'P3016';
}

export class PrismaMigrationNotFoundError extends PrismaError {
  code = 'P3017';
}

export class PrismaMigrationFailedToApplyError extends PrismaError {
  code = 'P3018';
}

export class PrismaProviderMismatchError extends PrismaError {
  code = 'P3019';
}

export class PrismaShadowDatabaseDisabledError extends PrismaError {
  code = 'P3020';
}

export class PrismaNoForeignKeysError extends PrismaError {
  code = 'P3021';
}

export class PrismaNoDirectDdlError extends PrismaError {
  code = 'P3022';
}

export class PrismaIntrospectionFailedError extends PrismaError {
  code = 'P4000';
}

export class PrismaEmptyIntrospectedDatabaseError extends PrismaError {
  code = 'P4001';
}

export class PrismaInconsistentIntrospectedSchemaError extends PrismaError {
  code = 'P4002';
}

export class PrismaDataProxyRequestError extends PrismaError {
  code = 'P5000';
}

export class PrismaDataProxyRetryRequestError extends PrismaError {
  code = 'P5001';
}

export class PrismaDataProxyInvalidDatasourceError extends PrismaError {
  code = 'P5002';
}

export class PrismaDataProxyResourceNotFoundError extends PrismaError {
  code = 'P5003';
}

export class PrismaDataProxyFeatureNotImplementedError extends PrismaError {
  code = 'P5004';
}

export class PrismaDataProxySchemaUploadError extends PrismaError {
  code = 'P5005';
}

export class PrismaDataProxyUnknownServerError extends PrismaError {
  code = 'P5006';
}

export class PrismaDataProxyUnauthorizedError extends PrismaError {
  code = 'P5007';
}

export class PrismaDataProxyUsageExceededError extends PrismaError {
  code = 'P5008';
}

export class PrismaDataProxyRequestTimeoutError extends PrismaError {
  code = 'P5009';
}

export class PrismaDataProxyFetchError extends PrismaError {
  code = 'P5010';
}

export class PrismaDataProxyInvalidRequestParametersError extends PrismaError {
  code = 'P5011';
}

export class PrismaDataProxyUnsupportedEngineVersionError extends PrismaError {
  code = 'P5012';
}

export class PrismaDataProxyEngineStartupError extends PrismaError {
  code = 'P5013';
}

export class PrismaDataProxyUnknownEngineStartupError extends PrismaError {
  code = 'P5014';
}

export class PrismaDataProxyInteractiveTransactionError extends PrismaError {
  code = 'P5015';
}

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

export function isPrismaError(
  error: unknown,
): error is PrismaClientKnownRequestError | PrismaClientUnknownRequestError | PrismaClientValidationError {
  return (
    error instanceof PrismaClientKnownRequestError ||
    error instanceof PrismaClientUnknownRequestError ||
    error instanceof PrismaClientValidationError
  );
}

export function toTypedPrismaError(error: PrismaClientKnownRequestError) {
  const code: ErrorCode = error.code as ErrorCode;
  const ErrorClass = errorCodeToClass[code];
  if (!ErrorClass) {
    return error;
  }
  return new ErrorClass(error);
}
