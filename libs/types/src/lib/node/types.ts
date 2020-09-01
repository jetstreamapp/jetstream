// decoded JWT
export interface UserAuthJwt {
  at_hash: string;
  sub: string; // username
  aud: string;
  email_verified: true;
  token_use: 'id';
  auth_time: number;
  iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_BKTsg5Qef';
  name: string;
  'cognito:username': string;
  exp: number;
  iat: number;
  email: string;
}

export interface UserAuthSession {
  access_token: string;
  id_token: string;
  refresh_token: string;
  userId: string;
  user: UserAuthJwt;
}
