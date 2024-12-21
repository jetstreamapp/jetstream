export function getExceptionLog(error: unknown, includeStack = false) {
  const status = (error as any) /** UserFacingError */?.apiRequestError?.status || (error as any) /** ApiRequestError */?.status;
  if (error instanceof Error) {
    return {
      error: error.message,
      status,
      stack: includeStack ? error.stack : undefined,
    };
  }
  return {
    error,
  };
}
