import { UserAuthSession } from '@jetstream/types';
import * as express from 'express';
import { getUserDetails } from '../services/auth';
import { sendJson } from '../utils/response.handlers';

interface SfdcOauthState {
  loginUrl: string;
}

export async function getUserProfile(req: express.Request, res: express.Response) {
  const sessionAuth: UserAuthSession = req.session.auth;
  const userProfile = await getUserDetails(sessionAuth.access_token);

  sendJson(res, userProfile);
}
