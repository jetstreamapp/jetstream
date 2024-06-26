import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter, pluralizeFromNumber } from '@jetstream/shared/utils';
import { ChildRelationship, QueryFieldWithPolymorphic, SalesforceOrgUi } from '@jetstream/types';
import { Accordion, Badge, DesertIllustration, EmptyState, Grid, GridCol, SearchInput } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, ReactNode, useState } from 'react';
import { useRecoilValue } from 'recoil';
import QueryChildFields from './QueryChildFields';

export interface QuerySubquerySObjectsProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  childRelationships: ChildRelationship[];
  onSelectionChanged: (relationshipName: string, fields: QueryFieldWithPolymorphic[]) => void;
}

export const QuerySubquerySObjects: FunctionComponent<QuerySubquerySObjectsProps> = ({
  org,
  serverUrl,
  isTooling,
  childRelationships,
  onSelectionChanged,
}) => {
  const [visibleChildRelationships, setVisibleChildRelationships] = useState<ChildRelationship[]>(childRelationships);
  const [childRelationshipContent, setChildRelationshipContent] = useState<Record<string, ReactNode | ChildRelationship>>({});
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
      let content: ReactNode | ChildRelationship;
      if (!childRelationship.relationshipName) {
        return;
      }
      if (childRelationshipContent[childRelationship.relationshipName]) {
        content = childRelationshipContent[childRelationship.relationshipName];
      } else {
        content = (
          <QueryChildFields
            org={org}
            serverUrl={serverUrl}
            isTooling={isTooling}
            selectedSObject={childRelationship.childSObject}
            parentRelationshipName={childRelationship.relationshipName}
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            onSelectionChanged={(fields: QueryFieldWithPolymorphic[]) => onSelectionChanged(childRelationship.relationshipName!, fields)}
          />
        );
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        setTimeout(() => setChildRelationshipContent({ ...childRelationshipContent, [childRelationship.relationshipName!]: content }));
      }
      return content;
    };
  }

  function getCollapsedSummary(childRelationship: ChildRelationship) {
    if (!childRelationship.relationshipName) {
      return;
    }
    const queryFields = selectedFieldState[childRelationship.relationshipName];
    if (Array.isArray(queryFields)) {
      return (
        <Badge className="slds-truncate text-uppercase slds-m-top_xx-small">
          {queryFields.length} {pluralizeFromNumber('field', queryFields.length)} selected
        </Badge>
      );
    }
    return;
  }

  return (
    <Fragment>
      {childRelationships.length === 0 && (
        <EmptyState headline="There are no related objects" illustration={<DesertIllustration />}></EmptyState>
      )}
      {childRelationships.length > 0 && (
        <Fragment>
          <SearchInput
            id="subquery-filter"
            className="slds-p-around_xx-small"
            placeholder="Filter child objects"
            onChange={setTextFilter}
          />
          {visibleChildRelationships.length === 0 && (
            <EmptyState headline="There are no matching objects" subHeading="Adjust your selection."></EmptyState>
          )}
          <Accordion
            initOpenIds={[]}
            allowMultiple={false}
            sections={visibleChildRelationships.map((childRelationship) => ({
              id: `${childRelationship.relationshipName}-${childRelationship.childSObject}.${childRelationship.field}`,
              testId: childRelationship.relationshipName,
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
