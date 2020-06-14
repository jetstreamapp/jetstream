// decoded JWT
export interface UserAuthJwt {
  aud: string;
  exp: number;
  iat: number;
  iss: 'getjetstream.app';
  sub: string;
  authenticationType: 'PASSWORD' | 'REFRESH_TOKEN' | 'SAMLv2';
  email: string;
  email_verified: boolean;
  applicationId: string;
  roles: string[];
}

export interface UserAuthSession {
  access_token: string;
  id_token: string;
  refresh_token: string;
  userId: string;
  user: UserAuthJwt;
}
