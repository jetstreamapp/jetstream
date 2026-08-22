import { Checkbox, Icon, Popover, ScopedNotification } from '@jetstream/ui';
import { FIELD_AUDIT_COLUMNS, FieldAuditColumnKey } from './utils/permission-manager-field-audit-columns';

export interface FieldAuditColumnsPopoverProps {
  visibleColumns: ReadonlySet<FieldAuditColumnKey>;
  /** True when the Tooling CustomField query failed, which is why the columns would be empty */
  dataUnavailable?: boolean;
  onToggle: (columnKey: FieldAuditColumnKey, visible: boolean) => void;
  onToggleAll: (visible: boolean) => void;
}

/**
 * Opt-in toggles for the created/modified columns on the field permissions table. The table is dense enough that
 * these are hidden by default, so this lives in the toolbar rather than adding four permanent columns.
 */
export function FieldAuditColumnsPopover({ visibleColumns, dataUnavailable, onToggle, onToggleAll }: FieldAuditColumnsPopoverProps) {
  const allColumnsVisible = visibleColumns.size === FIELD_AUDIT_COLUMNS.length;

  return (
    <Popover
      placement="bottom-end"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">Field Table Columns</h2>
        </header>
      }
      buttonProps={{
        className: 'slds-button slds-button_icon slds-button_icon-border-filled slds-m-right_xx-small',
        title: 'Field table columns',
      }}
      content={
        <div>
          {dataUnavailable && (
            <ScopedNotification theme="warning" className="slds-m-bottom_small">
              Jetstream could not read field audit data from Salesforce, so these columns will be empty.
            </ScopedNotification>
          )}
          <fieldset className="slds-form-element">
            <legend className="slds-assistive-text">Optional columns</legend>
            <Checkbox
              id="field-audit-column-select-all"
              className="slds-border_bottom slds-p-bottom_xx-small slds-m-bottom_xx-small"
              label="Select All"
              checked={allColumnsVisible}
              indeterminate={!allColumnsVisible && visibleColumns.size > 0}
              onChange={onToggleAll}
            />
            {FIELD_AUDIT_COLUMNS.map(({ key, label }) => (
              <Checkbox
                key={key}
                id={`field-audit-column-${key}`}
                label={label}
                checked={visibleColumns.has(key)}
                onChange={(value) => onToggle(key, value)}
              />
            ))}
          </fieldset>
          <p className="slds-text-body_small slds-text-color_weak slds-m-top_x-small">
            Salesforce only tracks this information for custom fields, so it is always blank for standard fields.
          </p>
        </div>
      }
    >
      <Icon type="utility" icon="settings" className="slds-button__icon" omitContainer />
      <span className="slds-assistive-text">Field table columns</span>
    </Popover>
  );
}

export default FieldAuditColumnsPopover;
