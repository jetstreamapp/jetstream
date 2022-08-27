import { credentials, Metadata } from '@grpc/grpc-js';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import * as process from 'process';
import { logger } from './api-logger';
import { ENV } from './env-config';
import telemetryApi from '@opentelemetry/api';
import { UserProfileServer } from '@jetstream/types';

// Metadata is passed into to the tracer to provide both the dataset name and the API key required for Honeycomb.
//
// A dataset is basically a bucket where observability data goes.
// It's also a way to organize your data based on services or environments.
const metadata = new Metadata();
metadata.set('x-honeycomb-team', ENV.HONEYCOMB_API_KEY);
metadata.set('x-honeycomb-dataset', `JETSTREAM-${ENV.ENVIRONMENT}`.toUpperCase());

// Only enable tracing if the environment variable is set to true.
if (ENV.HONEYCOMB_ENABLED) {
  // The Trace Exporter exports the data to Honeycomb and uses
  // the previously-configured metadata and the Honeycomb endpoint.
  const traceExporter = new OTLPTraceExporter({
    url: 'grpc://api.honeycomb.io:443/',
    credentials: credentials.createSsl(),
    metadata,
  });

  // The service name is REQUIRED! It is a resource attribute, which means that it will be present on all observability data that your service generates.
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'JETSTREAM_API',
    }),
    traceExporter,

    // Instrumentations allow you to add auto-instrumentation packages
    instrumentations: [getNodeAutoInstrumentations()],
  });

  sdk
    .start()
    .then(() => logger.debug('[TELEMETRY] Tracing initialized'))
    .catch((error) => logger.error('[TELEMETRY] Error initializing tracing', error));

  process.on('SIGTERM', () => {
    sdk
      .shutdown()
      .then(() => logger.debug('[TELEMETRY] Tracing terminated'))
      .catch((error) => logger.error('[TELEMETRY] Error terminating tracing', error))
      .finally(() => process.exit(0));
  });
}

export function telemetryAddUserToAttributes(user?: UserProfileServer) {
  if (ENV.HONEYCOMB_ENABLED && (user?.user_id || user.id)) {
    try {
      telemetryApi.trace.getSpan(telemetryApi.context.active()).setAttribute('user.id', user.user_id || user.id);
    } catch (ex) {
      logger.warn('[TELEMETRY] Error adding user to attributes', ex);
    }
  }
}
