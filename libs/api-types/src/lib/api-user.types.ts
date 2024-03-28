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
  emailVerified: z.boolean().nullish().transform(ensureBoolean),
  picture: z.string().nullish(),
  username: z.string(),
  nickname: z.string().nullish(),
  identities: z.any().array(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  preferences: z
    .object({
      skipFrontdoorLogin: z.boolean().nullish(),
    })
    .nullish(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
