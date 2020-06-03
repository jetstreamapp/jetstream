import * as express from 'express';
import { logRoute } from './route.middleware';
import { sendJson } from '../utils/response.handlers';
import * as request from 'superagent';
import Router from 'express-promise-router';
import { resolve } from 'path';
import { UserFacingError } from '../utils/error-handler';

console.log('resolve', resolve(process.cwd(), '.env'));

const MAILCHIMP_USER = process.env.MAILCHIMP_USER;
const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
const MAILCHIMP_AUDIENCE_ID = process.env.MAILCHIMP_AUDIENCE_ID;

export const routes: express.Router = Router();

routes.use(logRoute);

routes.post('/sign-up/notify', async (req: express.Request, res: express.Response) => {
  try {
    const email = req.body.email;
    if (!email) {
      console.log('[ERROR][SIGN-UP-NOTIFY] A valid email was not included with the request');
    }

    const url = `https://us10.api.mailchimp.com/3.0/lists/${MAILCHIMP_AUDIENCE_ID}/members/`;
    const response = await request.post(url).auth(MAILCHIMP_USER, MAILCHIMP_API_KEY, { type: 'basic' }).send({
      // eslint-disable-next-line @typescript-eslint/camelcase
      email_address: email,
      status: 'subscribed',
    });

    if (response.ok) {
      console.log('[SUCCESS][SIGN-UP-NOTIFY]', email);
      return sendJson(res);
    } else {
      console.log('[ERROR][SIGN-UP-NOTIFY]', response.error, response.body);
      throw new Error('There was an error subscribing the request');
    }
  } catch (ex) {
    console.log('[ERROR][SIGN-UP-NOTIFY][EX]', ex.status, ex.response?.body);
    const error = ex.response?.body?.detail || 'There was an error subscribing the request';

    throw new UserFacingError(error);
  }
});

export default routes;
