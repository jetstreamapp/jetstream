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
  if (error || (res.statusCode ?? 0) >= 500) {
    return 'error';
  }
  return 'info';
}
