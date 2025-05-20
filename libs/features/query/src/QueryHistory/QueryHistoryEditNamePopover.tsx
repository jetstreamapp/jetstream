import { css } from '@emotion/react';
import { QueryHistoryItem } from '@jetstream/types';
import { Grid, Icon, Input, Popover, PopoverRef } from '@jetstream/ui';
import { useRef, useState } from 'react';

export interface QueryHistoryEditNamePopoverProps {
  item: QueryHistoryItem;
  onOpenStateChange: (isOpen: boolean) => void;
  onSave: (name: string | null) => Promise<void>;
}

export const QueryHistoryEditNamePopover = ({ item, onOpenStateChange, onSave }: QueryHistoryEditNamePopoverProps) => {
  const itemName = item.customLabel || item.label;
  const [name, setName] = useState(item.customLabel || item.label);
  const [saving, setSaving] = useState(false);

  const isDirty = itemName !== name;
  const canReset = !!item.customLabel;

  const popoverRef = useRef<PopoverRef>(null);

  async function handleOpenStateChange(isOpen: boolean) {
    if (isOpen) {
      setName(item.customLabel || item.label);
    }
    onOpenStateChange(isOpen);
  }

  async function handleSave() {
    setSaving(true);
    onSave(name.trim())
      .then(() => popoverRef.current?.close())
      .finally(() => setSaving(false));
  }

  async function handleReset() {
    setSaving(true);
    onSave(null)
      .then(() => popoverRef.current?.close())
      .finally(() => setSaving(false));
  }

  return (
    <Popover
      ref={popoverRef}
      omitPortal
      onChange={handleOpenStateChange}
      content={
        <div
          css={css`
            max-height: 80vh;
            font-size: 13px;
            font-weight: 400;
          `}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <Input label="Query Name">
              <input
                className="slds-input"
                autoComplete="off"
                value={name}
                minLength={1}
                maxLength={254}
                onChange={(event) => setName(event.target.value)}
              />
            </Input>
            <Grid className="slds-m-top_small" align="end">
              <button
                className="slds-button slds-button_neutral"
                onClick={() => handleReset()}
                disabled={saving || !canReset}
                type="button"
              >
                Reset
              </button>
              <button type="submit" className="slds-button slds-button_brand" disabled={!isDirty || saving} onClick={() => handleSave()}>
                Save
              </button>
            </Grid>
          </form>
        </div>
      }
      buttonProps={{ className: 'slds-button slds-button_icon slds-m-left_xx-small', 'aria-label': 'Edit query name' }}
    >
      <Icon type="utility" icon="edit" className="slds-button__icon" omitContainer />
    </Popover>
  );
};
