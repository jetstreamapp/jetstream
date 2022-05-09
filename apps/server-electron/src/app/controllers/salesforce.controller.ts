import * as services from '@jetstream/server-services';
import { ControllerFn, ControllerFnParams, ControllerFnQuery } from '../types';

export const handleGlobalDescribe: ControllerFn = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const response = await connection.describeGlobal();
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const handleDescribeSobject: ControllerFnParams<{ sobject: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const response = await connection.describe(params.sobject);
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const query: ControllerFn<{ query: string }, { isTooling?: string; includeDeletedRecords?: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const { query } = request.data;
    request.query = request.query || {};
    const isTooling = request.query.isTooling === 'true';
    const includeDeletedRecords = request.query.includeDeletedRecords === 'true';
    const response = await services.queryRecords(connection, query, isTooling, includeDeletedRecords);
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};

export const queryMore: ControllerFnQuery<{ nextRecordsUrl?: string; isTooling?: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    request.query = request.query || {};
    const isTooling = request.query.isTooling === 'true';
    const nextRecordsUrl = request.query.nextRecordsUrl;
    const response = await services.queryMoreRecords(connection, nextRecordsUrl, isTooling);
    resolve(response);
  } catch (ex) {
    reject(ex);
  }
};
