import React, { FunctionComponent } from 'react';
import { Textarea } from '@silverthorn/ui';

export interface SoqlTextareaProps {
  soql: string;
}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = ({ soql }) => {
  return (
    <Textarea id="soql-textarea" label="Generated SOQL">
      <textarea className="slds-textarea" value={soql} disabled id="soql-textarea" cols={30} rows={10}></textarea>
    </Textarea>
  );
};

export default SoqlTextarea;
