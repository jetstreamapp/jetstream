import {
  CompositeGraphRequest,
  CompositeGraphResponse,
  CompositeRequestBody,
  CompositeResponseItem,
  InsertUpdateUpsert,
  MapOf,
} from '@jetstream/types';
import { DescribeSObjectResult, Field } from 'jsforce';

export interface LoadMultiObjectDataError {
  property: Omit<keyof LoadMultiObjectData, 'errors'>;
  worksheet: string;
  location: string;
  message: string;
}

export interface LoadMultiObjectData {
  worksheet: string;
  sobject: string;
  operation: InsertUpdateUpsert;
  externalId?: string;
  data: any[];
  dataById: MapOf<any>;
  /** The heading used for the reference Id. it should be "reference id", but could be anything */
  referenceColumnHeader: string;
  headers: string[];
  /** Headers where these fields on every row is considered a related field */
  referenceHeaders: Set<string>;
  metadata: DescribeSObjectResult;
  fieldsByName: MapOf<Field>;
  errors: LoadMultiObjectDataError[];
}

export interface LoadMultiObjectRecord {
  sobject: string;
  operation: InsertUpdateUpsert;
  externalId?: string;
  referenceId: string;
  record: any;
  recordIdx: number;
  dependsOn: string[];
}

export interface LoadMultiObjectRequestWithResult {
  key: string;
  loading: boolean;
  started: Date | null;
  finished: Date | null;
  errorMessage?: string;
  /** Up to 500 records total */
  data: CompositeGraphRequest[];
  results: CompositeGraphResponse[] | null;
  // Same data as above, just grouped together by graph id
  dataWithResultsByGraphId: MapOf<{
    graphId: string;
    isSuccess: boolean | null;
    compositeRequest: CompositeRequestBody[];
    compositeResponse: CompositeResponseItem[] | null;
  }>;
  // Same data as above, just grouped together by record reference id
  recordWithResponseByRefId: MapOf<{
    referenceId: string;
    sobject: string;
    operation: InsertUpdateUpsert;
    externalId?: string;
    request: CompositeRequestBody;
    response: CompositeResponseItem | null;
  }>;
}
