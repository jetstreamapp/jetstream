import { z } from 'zod';

export const SalesforceApiRequestSchema = z.object({
  url: z.string().min(1),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  isTooling: z.boolean().optional(),
  body: z.any().optional(),
  headers: z.record(z.string()).optional(),
  options: z
    .object({
      responseType: z.string().optional(),
      noContentResponse: z.any().optional(),
    })
    .optional(),
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
  ids: z.string().array().optional(),
  records: z.any().optional(),
});
export type RecordOperationRequest = z.infer<typeof RecordOperationRequestSchema>;
