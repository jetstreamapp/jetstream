import { UserProfile } from '@jetstream/types';
import * as express from 'express';
import { sendJson } from '../utils/response.handlers';

interface SfdcOauthState {
  loginUrl: string;
}

export async function getUserProfile(req: express.Request, res: express.Response) {
  const user = req.user as UserProfile;
  sendJson(res, user._json);
}
