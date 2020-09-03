import { UserProfile } from '../types';

// decoded JWT
export interface UserAuthJwt {
  sub: string;
  name: string;
  email: string;
  email_verified: true;
  ver: number;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  jti: string;
  amr: string[];
  idp: string;
  nonce: string;
  preferred_username: string;
  auth_time: number;
  at_hash: string;
}

export interface UserAuthSession {
  access_token: string;
  id_token: string;
  refresh_token: string;
  userId: string;
  username: string;
  userAuth: UserAuthJwt;
  user: UserProfile;
}
