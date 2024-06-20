import { polyfillFieldDefinition } from '@jetstream/shared/ui-utils';
import { ListItem, QueryFieldWithPolymorphic } from '@jetstream/types';
import { Grid, GridCol, Icon } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { QueryFieldFunctionRow } from './QueryFieldFunctionRow';

export interface QueryFieldFunctionProps {
  hasGroupByClause: boolean;
  selectedFields: QueryFieldWithPolymorphic[];
}

export const QueryFieldFunction = ({ hasGroupByClause, selectedFields }: QueryFieldFunctionProps) => {
  const [functionFields, setFunctionFields] = useState<ListItem<string, QueryFieldWithPolymorphic>[]>([]);
  const [fieldFilterFunctions, setFieldFilterFunctions] = useRecoilState(fromQueryState.fieldFilterFunctions);

  useEffect(() => {
    setFunctionFields(
      selectedFields.map(
        (field): ListItem<string, QueryFieldWithPolymorphic> => ({
          id: field.field,
          label: field.metadata?.label || field.field,
          value: field.field,
          secondaryLabel: field.field,
          secondaryLabelOnNewLine: true,
          tertiaryLabel: polyfillFieldDefinition(field.metadata),
          meta: field,
        })
      )
    );
  }, [selectedFields]);

  function handleChange(
    index: number,
    selectedField: QueryFieldWithPolymorphic | null,
    selectedFunction: string | null,
    alias: string | null
  ) {
    setFieldFilterFunctions((prevItems) =>
      prevItems.map((item, i) =>
        i === index
          ? {
              selectedField,
              selectedFunction,
              alias,
            }
          : item
      )
    );
  }

  function handleAddRow() {
    setFieldFilterFunctions((prevItems) => [
      ...prevItems,
      {
        selectedField: null,
        selectedFunction: null,
        alias: null,
      },
    ]);
  }

  function handleDeleteRow(index: number) {
    setFieldFilterFunctions((prevItems) => {
      const output = prevItems.filter((_, i) => i !== index);
      if (!output.length) {
        output.push({
          selectedField: null,
          selectedFunction: null,
          alias: null,
        });
      }
      return output;
    });
  }

  return (
    <Grid vertical>
      <Grid wrap>
        {fieldFilterFunctions.map(({ selectedField, selectedFunction, alias }, i) => (
          <GridCol key={i} size={12} className="slds-m-bottom_x-small">
            <Grid guttersDirect guttersSize="xx-small" verticalAlign="end">
              <QueryFieldFunctionRow
                showLabel={i === 0}
                selectedField={selectedField}
                selectedFunction={selectedFunction}
                functionFields={functionFields}
                hasGroupByClause={hasGroupByClause}
                alias={alias}
                onChange={(selectedField, selectedFunction, alias) => handleChange(i, selectedField, selectedFunction, alias)}
              />
              <GridCol growNone>
                <button className="slds-button slds-button_icon slds-button_icon-border" onClick={() => handleDeleteRow(i)}>
                  <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                </button>
              </GridCol>
            </Grid>
          </GridCol>
        ))}
        <GridCol size={12}>
          <button className="slds-button slds-button_neutral" onClick={handleAddRow}>
            + Add Row
          </button>
        </GridCol>
      </Grid>
    </Grid>
  );
};

export default QueryFieldFunction;
