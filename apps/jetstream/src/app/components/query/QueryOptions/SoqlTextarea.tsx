import React, { FunctionComponent } from 'react';
import { Textarea } from '@jetstream/ui';
import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../query.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SoqlTextareaProps {}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = React.memo(() => {
  const soql = useRecoilValue(fromQueryState.querySoqlState);

  return (
    <Textarea id="soql-textarea" label="Generated SOQL">
      <textarea className="slds-textarea" value={soql} disabled id="soql-textarea" cols={30} rows={10}></textarea>
    </Textarea>
  );
});

export default SoqlTextarea;
