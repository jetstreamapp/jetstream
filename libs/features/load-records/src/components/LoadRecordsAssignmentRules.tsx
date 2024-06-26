import { css } from '@emotion/react';
import { queryWithCache } from '@jetstream/shared/data';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ApiMode, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Grid, Picklist, Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';

interface AssignmentRuleRecord {
  Id: string;
  Name: string;
  Active: boolean;
}

const allowedObjects = new Set(['lead', 'case']);
let currKey = 0;
export interface LoadRecordsAssignmentRulesProps {
  selectedOrg: SalesforceOrgUi;
  apiMode: ApiMode;
  selectedSObject: string;
  onAssignmentRule: (assignmentRuleId: Maybe<string>) => void;
}

export const LoadRecordsAssignmentRules: FunctionComponent<LoadRecordsAssignmentRulesProps> = ({
  selectedOrg,
  apiMode,
  selectedSObject,
  onAssignmentRule,
}) => {
  const isMounted = useRef(true);
  const [picklistKey, setPickListKey] = useState(currKey);
  const [loading, setLoading] = useState(false);
  const [useAssignmentRules, setUseAssignmentRules] = useState(false);
  const [assignmentRules, setAssignmentRules] = useState<ListItem<string, AssignmentRuleRecord>[]>([]);
  const [selectedAssignmentRule, setSelectedAssignmentRule] = useState<Maybe<string>>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useNonInitialEffect(() => {
    if (useAssignmentRules) {
      onAssignmentRule(selectedAssignmentRule);
    } else {
      onAssignmentRule(null);
    }
  }, [useAssignmentRules, selectedAssignmentRule, onAssignmentRule]);

  const fetchAssignmentRules = useCallback(async () => {
    try {
      setLoading(true);
      const results = await queryWithCache<AssignmentRuleRecord>(
        selectedOrg,
        `SELECT Id, Name, Active FROM AssignmentRule WHERE SobjectType = '${selectedSObject}' ORDER BY Name`
      );

      if (isMounted.current) {
        setSelectedAssignmentRule(results.data.queryResults.records.find((rule) => rule.Active)?.Id);
        setAssignmentRules(
          results.data.queryResults.records.map((item) => ({
            id: item.Id,
            value: item.Id,
            label: `${item.Name} (${item.Active ? 'Active' : 'Inactive'})`,
            meta: item,
          }))
        );
        setLoading(false);
        currKey++;
        setPickListKey(currKey);
      }
    } catch (ex) {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [selectedOrg, selectedSObject]);

  useEffect(() => {
    if (allowedObjects.has(selectedSObject.toLowerCase())) {
      fetchAssignmentRules();
    }
  }, [selectedOrg, selectedSObject, fetchAssignmentRules]);

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {allowedObjects.has(selectedSObject.toLowerCase()) && (
        <div
          className="slds-is-relative"
          css={css`
            min-height: 56px;
          `}
          title={!loading && !assignmentRules.length ? 'There are no assignment rules defined in your org' : undefined}
        >
          <Grid vertical>
            <Checkbox
              id={`assignment-rule-toggle`}
              labelHelp="If you want to apply assignment rules to this data load, choose the assignment rules you would like to use. This option is only available for Leads, Cases, and Contacts."
              label="Use Assignment Rules"
              checked={useAssignmentRules}
              disabled={!assignmentRules.length}
              onChange={setUseAssignmentRules}
            />
            {loading && <Spinner size="small" />}
            <Picklist
              key={picklistKey}
              label="Assignment Rule"
              items={assignmentRules}
              selectedItemIds={selectedAssignmentRule ? [selectedAssignmentRule] : undefined}
              allowDeselection={false}
              disabled={!useAssignmentRules}
              onChange={(items: ListItem<string, AssignmentRuleRecord>[]) => items?.length && setSelectedAssignmentRule(items[0].id)}
            />
          </Grid>
        </div>
      )}
    </Fragment>
  );
};

export default LoadRecordsAssignmentRules;
