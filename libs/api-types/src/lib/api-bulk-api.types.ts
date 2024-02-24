import { ensureBoolean } from '@jetstream/shared/utils';
import { z } from 'zod';

export const CreateJobRequestSchema = z
  .object({
    type: z.enum(['INSERT', 'UPDATE', 'UPSERT', 'DELETE', 'QUERY', 'QUERY_ALL']),
    sObject: z.string(),
    serialMode: z.string().optional().transform(ensureBoolean),
    externalId: z.string(),
  })
  .refine((data) => (data.type === 'UPSERT' ? !!data.externalId : true), 'ExternalId is required for Upsert');
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;
