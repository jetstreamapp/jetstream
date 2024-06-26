import { DescribeGlobalSObjectResult, Field, NullNumberBehavior } from '@jetstream/types';
import { atom } from 'recoil';

export const sourceTypeState = atom<'NEW' | 'EXISTING'>({
  key: 'formula.sourceTypeState',
  default: 'NEW',
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult | null>({
  key: 'formula.selectedSObjectState',
  default: null,
});

export const selectedUserState = atom<string | null>({
  key: 'formula.selectedUserState',
  default: null,
});

export const selectedFieldState = atom<Field | null>({
  key: 'formula.selectedFieldState',
  default: null,
});

export const recordIdState = atom<string>({
  key: 'formula.recordIdState',
  default: '',
});

export const formulaValueState = atom<string>({
  key: 'formula.formulaValueState',
  default: '',
});

export const numberNullBehaviorState = atom<NullNumberBehavior>({
  key: 'formula.numberNullBehaviorState',
  default: 'BLANK',
});

export const bannerDismissedState = atom<boolean>({
  key: 'formula.bannerDismissedState',
  default: false,
});
