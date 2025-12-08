import { ENV, getExceptionLog, logger } from '@jetstream/api-config';
import { getApiAddressFromReq } from '@jetstream/auth/server';
import { HTTP } from '@jetstream/shared/constants';
import express from 'express';
import z from 'zod';
import { cleanupFeedbackAttachments, handleUserFeedbackEmail, UserFeedbackPayloadSchema } from '../services/user-feedback.service';

/**
 * Controller to handle user feedback submission
 * This is used for all platforms which is why it doesn't go through route helpers
 */
export const sendUserFeedbackEmail = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  try {
    const user = req.externalAuth?.user || req.session.user;

    if (!user) {
      await cleanupFeedbackAttachments(req, { userEmail: 'unknown', userId: 'unknown', requestId: res.locals?.requestId });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const ipAddress = getApiAddressFromReq(req);

    const parsedPayload = UserFeedbackPayloadSchema.safeParse({
      ...req.body,
      deviceId: req.get(HTTP.HEADERS.X_EXT_DEVICE_ID),
      ipAddress,
      requestId: res.locals?.requestId,
      serverVersion: ENV.VERSION,
      userAgent: req.headers['user-agent'],
      userEmail: user.email,
      userId: user.id,
    });

    if (!parsedPayload.success) {
      await cleanupFeedbackAttachments(req, { userEmail: user.email, userId: user.id, requestId: res.locals?.requestId });
      return res.status(400).json({ error: 'Invalid payload', details: z.treeifyError(parsedPayload.error) });
    }

    await handleUserFeedbackEmail(parsedPayload.data, req);

    res.json({ success: true });
  } catch (error) {
    await cleanupFeedbackAttachments(req, { userEmail: 'unknown', userId: 'unknown', requestId: res.locals?.requestId });
    (res.log || logger).error({ ...getExceptionLog(error) }, 'Error processing feedback submission');
    next(error);
  }
};
