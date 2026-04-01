import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { DescribeGlobalSObjectResult, Field, NullNumberBehavior } from '@jetstream/types';
import type { FormulaReturnType } from '@jetstreamapp/sf-formula-parser';
import { atom } from 'jotai';
import { atomWithReset } from 'jotai/utils';

export type FormulaReturnTypeWithEmptyState = FormulaReturnType | null | typeof SFDC_BLANK_PICKLIST_VALUE;

export const sourceTypeState = atomWithReset<'NEW' | 'EXISTING'>('NEW');

export const selectedSObjectState = atomWithReset<DescribeGlobalSObjectResult | null>(null);

export const selectedUserState = atom<string | null>(null);

export const selectedFieldState = atomWithReset<Field | null>(null);

export const recordIdState = atomWithReset<string>('');

export const formulaValueState = atomWithReset<string>('');

export const numberNullBehaviorState = atomWithReset<NullNumberBehavior>('BLANK');

export const returnTypeState = atomWithReset<FormulaReturnTypeWithEmptyState>('string');

export const bannerDismissedState = atomWithReset<boolean>(false);
