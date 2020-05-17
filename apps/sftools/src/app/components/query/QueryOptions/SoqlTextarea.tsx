import React, { FunctionComponent } from 'react';
import Textarea from '../../core/Textarea';

export interface SoqlTextareaProps {
  soql: string;
}

export const SoqlTextarea: FunctionComponent<SoqlTextareaProps> = ({ soql }) => {
  return (
    <Textarea id="soql-textarea" label="SOQL">
      <textarea className="slds-textarea" value={soql} disabled id="soql-textarea" cols={30} rows={10}></textarea>
    </Textarea>
  );
};

export default SoqlTextarea;
