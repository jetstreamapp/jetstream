import { z } from 'zod';

export const EmailSupportRequestSchema = z.object({
  emailBody: z.string().min(1),
});
export type EmailSupportRequest = z.infer<typeof EmailSupportRequestSchema>;
