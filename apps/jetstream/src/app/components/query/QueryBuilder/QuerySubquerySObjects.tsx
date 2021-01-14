import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, pluralizeFromNumber } from '@jetstream/shared/utils';
import { MapOf, QueryFieldWithPolymorphic } from '@jetstream/types';
import { Accordion, Badge, EmptyState, Grid, GridCol, SearchInput } from '@jetstream/ui';
import { ChildRelationship } from 'jsforce';
import React, { Fragment, FunctionComponent, useState } from 'react';
import { useRecoilValue } from 'recoil';
import * as fromQueryState from '../query.state';
import QueryChildFieldsComponent from './QueryChildFields';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QuerySubquerySObjectsProps {
  childRelationships: ChildRelationship[];
  onSelectionChanged: (relationshipName: string, fields: QueryFieldWithPolymorphic[]) => void;
}

export const QuerySubquerySObjects: FunctionComponent<QuerySubquerySObjectsProps> = ({ childRelationships, onSelectionChanged }) => {
  const [visibleChildRelationships, setVisibleChildRelationships] = useState<ChildRelationship[]>(childRelationships);
  const [childRelationshipContent, setChildRelationshipContent] = useState<MapOf<ChildRelationship>>({});
  const [textFilter, setTextFilter] = useState<string>('');
  const selectedFieldState = useRecoilValue(fromQueryState.selectedSubqueryFieldsState);

  useNonInitialEffect(() => {
    setVisibleChildRelationships(childRelationships);
    setTextFilter('');
  }, [childRelationships]);

  useNonInitialEffect(() => {
    if (textFilter) {
      setVisibleChildRelationships(
        childRelationships.filter(multiWordObjectFilter(['relationshipName', 'childSObject', 'field'], textFilter))
      );
    } else {
      setVisibleChildRelationships(childRelationships);
    }
  }, [textFilter]);

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

  function getCollapsedSummary(childRelationship: ChildRelationship) {
    const queryFields = selectedFieldState[childRelationship.relationshipName];
    if (Array.isArray(queryFields)) {
      return (
        <Badge className="slds-truncate text-uppercase slds-m-top_xx-small">
          {queryFields.length} {pluralizeFromNumber('field', queryFields.length)} selected
        </Badge>
      );
    }
    return undefined;
  }

  return (
    <Fragment>
      {childRelationships.length === 0 && (
        <EmptyState imageWidth={200}>
          <p>This object does not have any related objects</p>
        </EmptyState>
      )}
      {childRelationships.length > 0 && (
        <Fragment>
          <SearchInput id="subquery-filter" placeholder="Filter child objects" onChange={setTextFilter} />
          <Accordion
            initOpenIds={[]}
            allowMultiple={false}
            sections={visibleChildRelationships.map((childRelationship) => ({
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

              titleSummaryIfCollapsed: getCollapsedSummary(childRelationship),
              content: getContent(childRelationship),
            }))}
          />
        </Fragment>
      )}
    </Fragment>
  );
};

export default QuerySubquerySObjects;
