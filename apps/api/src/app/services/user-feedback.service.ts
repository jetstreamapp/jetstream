import { ENV, getExceptionLog, logger, rollbarServer } from '@jetstream/api-config';
import { sendUserFeedbackEmail } from '@jetstream/email';
import { Request } from 'express';
import fs from 'node:fs';
import z from 'zod';

export const UserFeedbackPayloadSchema = z.object({
  // Populated client-side
  canFeatureTestimonial: z
    .string()
    .optional()
    .transform((val) => val === 'true'),
  clientVersion: z.string().optional(),
  filenames: z.union([z.string().transform((val) => (val ? [val] : [])), z.string().array().default([])]).default([]),
  language: z.string().optional(),
  message: z.string().min(1, { error: 'Message is required' }).max(5000, { error: 'Message must be at most 5000 characters long' }),
  type: z.enum(['bug', 'feature', 'other', 'testimonial']).default('other'),
  url: z.string().optional(),
  // Populated server-side
  deviceId: z.string().optional(),
  ipAddress: z.string().optional(),
  requestId: z.string().optional(),
  serverVersion: z.string().optional(),
  userAgent: z.string().optional(),
  userEmail: z.email(),
  userId: z.uuid(),
});
type UserFeedbackPayload = z.infer<typeof UserFeedbackPayloadSchema>;

export async function handleUserFeedbackEmail(
  {
    canFeatureTestimonial,
    clientVersion,
    deviceId,
    filenames,
    ipAddress,
    language,
    message,
    requestId,
    serverVersion,
    type,
    userAgent,
    url,
    userEmail,
    userId,
  }: UserFeedbackPayload,
  req: Request,
) {
  // Build the email content with feedback details
  const feedbackContent: string[] = [
    `Feedback Type: ${type || 'Not specified'}`,
    `userEmail: ${userEmail}`,
    `clientVersion: ${clientVersion || 'unspecified'}`,
    `serverVersion: ${serverVersion || 'unspecified'}`,
    `userAgent: ${userAgent || 'unspecified'}`,
    `url: ${url || 'unspecified'}`,
    `ipAddress: ${ipAddress || 'unspecified'}`,
    `deviceId: ${deviceId || 'unspecified'}`,
    `language: ${language || 'unspecified'}`,
    `requestId: ${requestId || 'unspecified'}`,
  ];
  if (type === 'testimonial' && canFeatureTestimonial) {
    feedbackContent.push('✅ User has granted permission to feature this testimonial');
  }

  feedbackContent.push(message.trim());
  const files = (req.files as Express.Multer.File[] | undefined) || [];

  // Prepare attachments from uploaded files
  const attachments = files.map((file, i) => ({
    data: fs.createReadStream(file.path),
    filename: filenames?.[i] || file.originalname,
    contentType: file.mimetype,
  }));

  // Send email with feedback
  await sendUserFeedbackEmail(ENV.JETSTREAM_EMAIL_REPLY_TO, userId, feedbackContent, attachments);

  await cleanupFeedbackAttachments(req, {
    clientVersion,
    deviceId,
    filenames,
    serverVersion,
    type,
    userEmail,
    userId,
  });

  logger.info({ userId, feedbackType: type, hasAttachments: !!files?.length }, 'User feedback submitted');
}

export async function cleanupFeedbackAttachments(req: Request, loggerInfo: Record<string, unknown>) {
  try {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files?.length) {
      return;
    }
    const filePaths = files.map((file) => file.path);
    await Promise.allSettled(
      filePaths.map((path) => {
        return new Promise<void>((resolve, reject) => {
          // Clean up temp files
          return fs.unlink(path, (err) => {
            if (err) {
              logger.error({ message: err.message }, 'Error deleting temp feedback attachment file');
              reject(err);
              return;
            }
            resolve();
          });
        });
      }),
    );
    (req.log || logger).info({ filePaths, ...loggerInfo }, 'Temp feedback attachment files cleaned up');
  } catch (ex) {
    (req.log || logger).error({ ...getExceptionLog(ex), ...loggerInfo }, 'Error during cleanup of feedback attachments');
    rollbarServer.error('Error during cleanup of feedback attachments', {
      context: `user-feedback.service#cleanupFeedbackAttachments`,
      custom: {
        ...getExceptionLog(ex, true),
        ...loggerInfo,
      },
    });
  }
}
