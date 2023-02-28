import { getOrgs, updateOrg, deleteOrg, getUserInfo } from '../storage';
import { ControllerFn, ControllerFnDataParams, ControllerFnParams } from '../types';

export const placeholder: ControllerFn = async (_, __, params, { reject, resolve, connection, request }) => {
  reject(new Error('Not yet implemented'));
  return;
};

export const heartbeat: ControllerFn = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    // TODO: add custom webpack config to get version info
    resolve({ version: 'TODO:' });
  } catch (ex) {
    reject(ex);
  }
};

export const getUserProfile: ControllerFn = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    resolve(getUserInfo());
  } catch (ex) {
    reject(ex);
  }
};

export const handleGetOrgs: ControllerFn = async (_, __, params, { reject, resolve, connection, request }) => {
  try {
    const orgs = await getOrgs();
    resolve(orgs);
  } catch (ex) {
    reject(ex);
  }
};

export const handleUpdateOrg: ControllerFnDataParams<{ label: string; color: string }, { uniqueId: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const data = { label: request.data?.label, color: request.data?.color };
    const orgs = await updateOrg(params.uniqueId, data);
    resolve(orgs);
  } catch (ex) {
    reject(ex);
  }
};

export const handleDeleteOrg: ControllerFnParams<{ uniqueId: string }> = async (
  _,
  __,
  params,
  { reject, resolve, connection, request }
) => {
  try {
    const orgs = await deleteOrg(params.uniqueId);
    resolve(orgs);
  } catch (ex) {
    reject(ex);
  }
};
