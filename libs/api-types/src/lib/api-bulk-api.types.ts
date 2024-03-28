import { z } from 'zod';

export const CreateJobRequestSchema = z
  .object({
    type: z.enum(['INSERT', 'UPDATE', 'UPSERT', 'DELETE', 'QUERY', 'QUERY_ALL']),
    sObject: z.string(),
    serialMode: z.boolean().nullish(),
    externalId: z.string().nullish(),
  })
  .refine((data) => (data.type === 'UPSERT' ? !!data.externalId : true), 'ExternalId is required for Upsert');
export type CreateJobRequest = z.infer<typeof CreateJobRequestSchema>;

export const CreateQueryJobRequestSchema = z.object({
  query: z.string(),
  queryAll: z.boolean().nullish(),
});
export type CreateQueryJobRequest = z.infer<typeof CreateQueryJobRequestSchema>;
