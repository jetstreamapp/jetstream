import type { DescribeGlobalSObjectResult, Field } from 'jsforce';
import { atom } from 'recoil';

export const priorSelectedOrg = atom<string>({
  key: 'formula.priorSelectedOrg',
  default: null,
});

export const sourceTypeState = atom<'NEW' | 'EXISTING'>({
  key: 'formula.sourceTypeState',
  default: 'NEW',
});

export const selectedSObjectState = atom<DescribeGlobalSObjectResult>({
  key: 'formula.selectedSObjectState',
  default: null,
});

export const selectedFieldState = atom<Field>({
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
