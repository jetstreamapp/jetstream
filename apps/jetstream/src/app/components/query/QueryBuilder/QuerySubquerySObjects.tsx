import { MapOf, QueryFieldWithPolymorphic } from '@jetstream/types';
import { Accordion, Grid, GridCol } from '@jetstream/ui';
import { ChildRelationship } from 'jsforce';
import React, { FunctionComponent, useState } from 'react';
import QueryChildFieldsComponent from './QueryChildFields';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QuerySubquerySObjectsProps {
  childRelationships: ChildRelationship[];
  onSelectionChanged: (relationshipName: string, fields: QueryFieldWithPolymorphic[]) => void;
}

export const QuerySubquerySObjects: FunctionComponent<QuerySubquerySObjectsProps> = ({ childRelationships, onSelectionChanged }) => {
  const [childRelationshipContent, setChildRelationshipContent] = useState<MapOf<ChildRelationship>>({});

  function getContent(childRelationship: ChildRelationship) {
    return () => {
      let content;
      if (childRelationshipContent[childRelationship.relationshipName]) {
        content = childRelationshipContent[childRelationship.relationshipName];
      } else {
        content = (
          <QueryChildFieldsComponent
            selectedSObject={childRelationship.childSObject}
            parentRelationshipName={childRelationship.relationshipName}
            onSelectionChanged={(fields: QueryFieldWithPolymorphic[]) => onSelectionChanged(childRelationship.relationshipName, fields)}
          />
        );
        setTimeout(() => setChildRelationshipContent({ ...childRelationshipContent, [childRelationship.relationshipName]: content }));
      }
      return content;
    };
  }

  return (
    <Accordion
      initOpenIds={[]}
      allowMultiple={false}
      sections={childRelationships.map((childRelationship) => ({
        id: childRelationship.relationshipName,
        titleText: `${childRelationship.relationshipName} (${childRelationship.childSObject}.${childRelationship.field})`,
        title: (
          <Grid align="spread" gutters>
            <GridCol>
              <Grid vertical gutters>
                <GridCol>{childRelationship.relationshipName}</GridCol>
                <GridCol className="slds-text-body_small slds-text-color_weak">
                  {childRelationship.childSObject}.{childRelationship.field}
                </GridCol>
              </Grid>
            </GridCol>
          </Grid>
        ),
        content: getContent(childRelationship),
      }))}
    />
  );
};

export default QuerySubquerySObjects;
