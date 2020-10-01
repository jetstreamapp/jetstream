import { QueryResult } from 'jsforce';
import { MapOf, EntityParticleRecord, RecordAttributes } from '@jetstream/types';

type RecordAttributesWithRelatedRecords = RecordAttributes & { relatedRecords: EntityParticleRecord[] };

export type EntityParticleRecordWithRelatedExtIds = EntityParticleRecord & { attributes: RecordAttributesWithRelatedRecords };

export interface FieldMapping {
  [field: string]: FieldMappingItem;
}

export interface FieldMappingItem {
  targetField: string | null;
  mappedToLookup: boolean;
  targetLookupField?: string;
}
