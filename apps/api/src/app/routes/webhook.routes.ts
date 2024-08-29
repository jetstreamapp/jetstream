import { WebhookEvent } from '@clerk/nextjs/server';
import { ENV, logger } from '@jetstream/api-config';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import express, { Router } from 'express';
import { Webhook } from 'svix';
import { deleteUserAndOrgs } from '../db/transactions.db';
import { createOrUpdateUser } from '../db/user.db';

const routes: express.Router = Router();

const validateSvixSignature = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.method !== 'POST') {
    return res.status(405);
  }

  // Get the Svix headers for verification
  const svix_id = String(req.headers['svix-id']);
  const svix_timestamp = String(req.headers['svix-timestamp']);
  const svix_signature = String(req.headers['svix-signature']);

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return res.status(400).json({ error: 'Missing required headers' });
  }

  if (!req.rawBody || !(req.rawBody instanceof Buffer)) {
    return res.status(400).json({ error: 'Missing request body' });
  }

  const webhook = new Webhook(ENV.CLERK_WEBHOOK_SECRET);
  let event: WebhookEvent;

  // Attempt to verify the incoming webhook
  // If successful, the payload will be available from 'evt'
  // If the verification fails, error out and  return error code
  try {
    event = webhook.verify(req.rawBody.toString('utf8'), {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), '[WEBHOOK] Error verifying webhook');
    return res.status(400).json({ Error: ex });
  }

  next();
};

routes.post(
  '/clerk',
  validateSvixSignature,
  async (req: express.Request<unknown, unknown, WebhookEvent>, res: express.Response<unknown>) => {
    try {
      const event = req.body;
      res.log.info('[WEBHOOK][CLERK] Handling event %s', event.type);

      switch (event.type) {
        case 'user.created': {
          await createOrUpdateUser(event.data);
          break;
        }
        case 'user.deleted': {
          if (event.data.id) {
            await deleteUserAndOrgs({ id: event.data.id });
          } else {
            logger.warn('No user id provided in event data');
          }
          break;
        }
        case 'user.updated': {
          await createOrUpdateUser(event.data);
          break;
        }
      }

      res.status(200).json({ response: 'Success' });
    } catch (ex) {
      res.status(400).json({ Error: ex });
    }
  }
);

export default routes;
