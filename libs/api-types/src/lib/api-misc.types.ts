import { z } from 'zod';

export const SalesforceApiRequestSchema = z.object({
  url: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  isTooling: z.boolean().nullish(),
  body: z.any().nullish(),
  headers: z.record(z.string()).nullish(),
  options: z
    .object({
      responseType: z.enum(['json', 'text']).nullish(),
      noContentResponse: z.any().nullish(),
    })
    .nullish(),
});
export type SalesforceApiRequest = z.infer<typeof SalesforceApiRequestSchema>;

export const SalesforceRequestManualRequestSchema = SalesforceApiRequestSchema.pick({
  url: true,
  method: true,
  body: true,
  headers: true,
});
export type SalesforceRequestManualRequest = z.infer<typeof SalesforceRequestManualRequestSchema>;

export const RecordOperationRequestSchema = z.object({
  ids: z.string().array().nullish(),
  records: z.any().nullish(),
});
export type RecordOperationRequest = z.infer<typeof RecordOperationRequestSchema>;
