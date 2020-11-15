/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { Fragment, FunctionComponent } from 'react';
import PicklistImage from './images/jetstream-query-help-picklist.png';
import RelationshipsImage from './images/jetstream-query-help-relationships.png';
import SubqueryImage from './images/jetstream-query-help-subquery.png';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryWalkthroughStep2Props {}

const Item1: FunctionComponent = () => {
  return (
    <div>
      <p className="slds-m-vertical_x-small">Hover over any of the 'Picklist' or 'Formula' labels to see their values</p>
      <img src={PicklistImage} alt="Picklist tooltip" />
    </div>
  );
};
const Item2: FunctionComponent = () => {
  return (
    <div>
      <p className="slds-m-vertical_x-small">
        You can travel up to five levels of look-up fields to build really rich queries. To select a field from a Lookup, click the '+ View
        Object Fields' link and select the fields you want included in your query.
      </p>
      <img src={RelationshipsImage} alt="Field relationships" />
    </div>
  );
};
const Item3: FunctionComponent = () => {
  return (
    <div>
      <p className="slds-m-vertical_x-small">
        To fetch related records (example: fetch Opportunity records associated to the Account records you're querying), use the 'Related
        Objects' tab to select the related objects and fields that you want.
      </p>
      <img src={SubqueryImage} alt="Subquery" />
    </div>
  );
};

export const QueryWalkthroughStep2: FunctionComponent<QueryWalkthroughStep2Props> = () => {
  return (
    <div>
      <p className="slds-text-heading_small">Tips and Tricks</p>
      <Item1 />
      <hr className="slds-m-vertical_small" />
      <Item2 />
      <hr className="slds-m-vertical_small" />
      <Item3 />
    </div>
  );
};

export default QueryWalkthroughStep2;
