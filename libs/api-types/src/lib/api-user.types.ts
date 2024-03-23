import { ensureBoolean } from '@jetstream/shared/utils';
import { z } from 'zod';

export const EmailSupportRequestSchema = z.object({
  emailBody: z.string().min(1),
});
export type EmailSupportRequest = z.infer<typeof EmailSupportRequestSchema>;

export const UpdateProfileRequestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean().optional().transform(ensureBoolean),
  picture: z.string().optional(),
  username: z.string(),
  nickname: z.string().optional(),
  identities: z.any().array(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  preferences: z
    .object({
      skipFrontdoorLogin: z.boolean().optional(),
    })
    .optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
