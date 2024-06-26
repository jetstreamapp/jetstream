import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { Maybe, QueryHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, Input, Popover, PopoverRef, Spinner, Textarea } from '@jetstream/ui';
import { fromQueryHistoryState, useAmplitude } from '@jetstream/ui-core';
import Editor from '@monaco-editor/react';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

export interface SaveFavoriteSoqlProps {
  className?: string;
  isTooling: boolean;
  selectedOrg: SalesforceOrgUi;
  sObject: Maybe<string>;
  sObjectLabel: Maybe<string>;
  soql: string;
  disabled?: boolean;
  onOpenHistory: (type: fromQueryHistoryState.QueryHistoryType) => void;
}

export const SaveFavoriteSoql: FunctionComponent<SaveFavoriteSoqlProps> = ({
  className,
  selectedOrg,
  isTooling,
  soql,
  sObject,
  sObjectLabel,
  disabled,
  onOpenHistory,
}) => {
  const isMounted = useRef(true);
  const popoverRef = useRef<PopoverRef>(null);
  const { trackEvent } = useAmplitude();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [queryHistory, setQueryHistory] = useRecoilState(fromQueryHistoryState.queryHistoryState);
  const [queryHistoryItem, setQueryHistoryItem] = useState<QueryHistoryItem | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (queryHistoryItem) {
      setIsDirty((!!name && name !== queryHistoryItem.label) || !queryHistoryItem.isFavorite);
    }
  }, [queryHistoryItem, name]);

  async function handlePopoverChange(isOpen: boolean) {
    try {
      setLoading(true);
      if (isOpen && sObject && sObjectLabel) {
        fromQueryHistoryState
          .getQueryHistoryItem(selectedOrg, soql, sObject, sObjectLabel, isTooling)
          .then(({ queryHistoryItem, refreshedQueryHistory }) => {
            refreshedQueryHistory = refreshedQueryHistory || queryHistory;
            if (refreshedQueryHistory && refreshedQueryHistory[queryHistoryItem.key]) {
              queryHistoryItem.runCount = refreshedQueryHistory[queryHistoryItem.key].runCount + 1;
              queryHistoryItem.created = refreshedQueryHistory[queryHistoryItem.key].created;
              queryHistoryItem.label = refreshedQueryHistory[queryHistoryItem.key].label;
              queryHistoryItem.isFavorite = refreshedQueryHistory[queryHistoryItem.key].isFavorite;
            }
            setQueryHistoryItem(queryHistoryItem);
            setName(queryHistoryItem.label);
          })
          .catch((ex) => logger.warn(ex));
      } else {
        setQueryHistoryItem(null);
        setIsDirty(false);
        setName('');
      }
    } catch (ex) {
      // TODO:
    } finally {
      setLoading(false);
    }
  }

  function handleSave() {
    if (!queryHistoryItem) {
      return;
    }
    const newQueryHistoryItem: QueryHistoryItem = { ...queryHistoryItem, label: name.trim(), isFavorite: true };
    setQueryHistory({ ...queryHistory, [queryHistoryItem.key]: newQueryHistoryItem });
    setQueryHistoryItem(newQueryHistoryItem);
    trackEvent(ANALYTICS_KEYS.query_HistorySaveQueryToggled, { location: 'popover', isFavorite: true });
  }

  function handleRemove() {
    if (!queryHistoryItem) {
      return;
    }
    setQueryHistory({ ...queryHistory, [queryHistoryItem.key]: { ...queryHistoryItem, isFavorite: false } });
    popoverRef.current?.close();
    trackEvent(ANALYTICS_KEYS.query_HistorySaveQueryToggled, { location: 'popover', isFavorite: false });
  }

  function handleOpenHistory() {
    onOpenHistory('SAVED');
    popoverRef.current?.close();
  }

  return (
    <div className={className}>
      <Popover
        ref={popoverRef}
        onChange={handlePopoverChange}
        header={
          <header className="slds-popover__header">
            <h2 className="slds-text-heading_small" title="Save query to favorites">
              Save query to favorites
            </h2>
          </header>
        }
        content={
          <Fragment>
            {loading && <Spinner />}
            <Textarea
              id="soql-manual"
              label={
                <Grid align="spread">
                  <div className="slds-m-right_x-small">
                    <span>Saved SOQL Query</span>
                  </div>
                </Grid>
              }
            >
              {/* Cannot be dark as it changes all other editors on screen */}
              <Editor
                className="slds-border_top slds-border_right slds-border_bottom slds-border_left"
                height="300px"
                language="soql"
                value={soql}
                options={{
                  minimap: { enabled: false },
                  readOnly: true,
                  lineNumbers: 'off',
                  glyphMargin: false,
                  folding: false,
                  scrollBeyondLastLine: false,
                }}
              />
            </Textarea>
            <form
              id="save-favorite-form"
              onSubmit={(ev) => {
                ev.preventDefault();
                handleSave();
              }}
            >
              <Grid vertical className="slds-m-top_xx-small">
                <div>
                  <p className="slds-text-body_small slds-text-color_weak">Saved queries are visible in Query History.</p>
                  <button className="slds-button" type="button" onClick={handleOpenHistory}>
                    View all saved queries
                  </button>
                </div>
                <hr className="slds-m-vertical_x-small" />
                <Input label="Saved Query Name" className="slds-grow" isRequired>
                  <input
                    className="slds-input"
                    value={name}
                    placeholder="Choose a name"
                    required
                    autoComplete="off"
                    autoFocus
                    onChange={(event) => setName(event.target.value)}
                  />
                </Input>
              </Grid>
            </form>
          </Fragment>
        }
        footer={
          <footer className="slds-popover__footer">
            <Grid verticalAlign="center" align="spread">
              <button className="slds-button slds-button_neutral" onClick={() => handleRemove()} disabled={isDirty}>
                Remove
              </button>
              <button
                form="save-favorite-form"
                className="slds-button slds-button_brand"
                disabled={!isDirty}
                onClick={() => handleSave()}
                type="submit"
              >
                {isDirty ? (
                  'Save'
                ) : (
                  <Fragment>
                    <Icon type="utility" icon="success" className="slds-button__icon slds-button__icon_left" />
                    Saved
                  </Fragment>
                )}
              </button>
            </Grid>
          </footer>
        }
        buttonProps={{
          className: 'slds-button slds-button_neutral',
          disabled,
        }}
      >
        <Icon type="utility" icon="favorite" description="Save query to favorites" className="slds-button__icon slds-button__icon_left" />
        Save
      </Popover>
    </div>
  );
};

export default SaveFavoriteSoql;
