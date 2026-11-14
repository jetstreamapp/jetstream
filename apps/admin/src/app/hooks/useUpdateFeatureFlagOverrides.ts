import { UpdateFeatureFlagOverridesRequest, UpdateFeatureFlagOverridesResult } from '@jetstream/admin/types';
import { apiPost } from '../api/admin-api-client';
import { useAsyncAction } from './useAsyncAction';

/** Enables or removes a flag's override for users or teams; the single call site of the overrides endpoint */
export function useUpdateFeatureFlagOverrides() {
  return useAsyncAction((flagKey: string, request: UpdateFeatureFlagOverridesRequest) =>
    apiPost<UpdateFeatureFlagOverridesResult>(`/api/feature-flags/${encodeURIComponent(flagKey)}/overrides`, request),
  );
}
