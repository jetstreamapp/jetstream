import { Maybe } from '@jetstream/types';
import type pino from 'pino';

export function resolveLogLevel({
  logLevel,
  environment,
  nodeEnv,
}: {
  logLevel?: Maybe<pino.LevelWithSilent>;
  environment?: Maybe<string>;
  nodeEnv?: Maybe<string>;
}): pino.LevelWithSilent {
  if (logLevel) {
    return logLevel;
  }
  if (environment) {
    return environment === 'production' ? 'info' : 'debug';
  }
  if (nodeEnv) {
    return nodeEnv === 'production' ? 'info' : 'debug';
  }
  return 'info';
}

export function getHttpLogLevel(_: unknown, res: { statusCode?: number }, error?: Error): pino.LevelWithSilent {
  if ((res.statusCode ?? 0) >= 500) {
    // Emit the access-log line at error level for server errors. Previously this returned
    // 'silent', which suppressed the line entirely and lost request timing/url for exactly
    // the responses most worth inspecting (the error body is still logged separately by the
    // uncaught error handler).
    return 'error';
  }
  if (error) {
    return 'error';
  }
  return 'info';
}
