import S from 'fluent-json-schema';
import { EMAIL_JOB_TYPE, EMAIL_TYPES } from './jobs/email.job';

/**
 *
 * https://www.fastify.io/docs/latest/Validation-and-Serialization/
 * https://github.com/fastify/fluent-json-schema
 * https://www.fastify.io/docs/latest/Validation-and-Serialization/#validation
 *
 */

const JOB_TYPES = [EMAIL_JOB_TYPE];

export const POST_JOB_SCHEMA = S.object()
  .id('http://jetstream-worker/job')
  .title('Create Job')
  .prop('type', S.enum(JOB_TYPES).required())
  .definition(
    'payload',
    S.object()
      .id('#payload')
      .prop('type', S.enum(EMAIL_TYPES))
      .prop('userId', S.string())
      .prop('email', S.string())
      .required(['type', 'userId', 'email'])
  )
  .prop('payload', S.ref('#payload'))
  .required()
  .ifThen(S.object().prop('type', S.const(EMAIL_JOB_TYPE)), S.object().prop('payload', S.ref('#payload')).required());
