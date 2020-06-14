import { UserAuthSession, UserProfile } from '@jetstream/types';
import * as express from 'express';
import { getUserDetails } from '../services/auth';
import { sendJson } from '../utils/response.handlers';

interface SfdcOauthState {
  loginUrl: string;
}

export async function getUserProfile(req: express.Request, res: express.Response) {
  const sessionAuth: UserAuthSession = req.session.auth;
  const userDetails = await getUserDetails(sessionAuth.userId);

  const userProfile: UserProfile = {
    id: userDetails.user.id,
    email: userDetails.user.email,
    username: userDetails.user.username,
    firstName: userDetails.user.firstName,
    lastName: userDetails.user.lastName,
    fullName: userDetails.user.fullName,
    active: userDetails.user.active,
    data: userDetails.user.data,
    passwordChangeRequired: userDetails.user.passwordChangeRequired,
    preferredLanguages: userDetails.user.preferredLanguages,
    timezone: userDetails.user.timezone,
    tenantId: userDetails.user.tenantId,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usernameStatus: userDetails.user.usernameStatus as any,
    verified: userDetails.user.verified,
  };
  sendJson(res, userProfile);
}
