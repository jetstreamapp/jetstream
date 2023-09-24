export interface TokenIntrospection {
  active: boolean;
  client_id: string;
  username: string;
  token_type: 'Bearer';
  exp: number;
  iat: number;
  nbf: number;
  sub: string;
  aud: string[];
  iss: 'http://localhost:8000';
}

export interface CasdoorUserProfile {
  sub: string;
  iss: string;
  aud: string;
  preferred_username: string;
  name: string;
  email: string;
  picture: string;
}

export interface AuthResponseError {
  status: 'error';
  msg: string;
  data: any;
  data2: any;
}

export interface QueryColumnsSfdc {
  columnMetadata: QueryColumnMetadata[];
  entityName: string;
  groupBy: boolean;
  idSelected: boolean;
  keyPrefix: string;
}

export interface QueryColumnMetadata {
  aggregate: boolean;
  apexType: string;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName?: any;
  insertable: boolean;
  joinColumns: QueryColumnMetadata[];
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
}
