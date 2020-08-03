import { getMapOf } from '@jetstream/shared/utils';
import { MapOf } from '@jetstream/types';
import { Accordion } from '@jetstream/ui';
import { ChildRelationship } from 'jsforce';
import React, { FunctionComponent, useState } from 'react';
import QueryChildFieldsComponent from './QueryChildFields';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QuerySubquerySObjectsProps {
  childRelationships: ChildRelationship[];
  onSelectionChanged: (relationshipName: string, fields: string[]) => void;
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
            onSelectionChanged={(fields: string[]) => onSelectionChanged(childRelationship.relationshipName, fields)}
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
        title: `${childRelationship.relationshipName} (${childRelationship.childSObject}.${childRelationship.field})`,
        content: getContent(childRelationship),
      }))}
    />
  );
};

export default QuerySubquerySObjects;
