import { Icon, Popover, ScopedNotification } from '@jetstream/ui';
import { FIELD_AUDIT_COLUMNS, FieldAuditColumnKey } from './utils/permission-manager-field-audit-columns';

export interface FieldAuditColumnsPopoverProps {
  visibleColumns: ReadonlySet<FieldAuditColumnKey>;
  /** True when the Tooling CustomField query failed, which is why the columns would be empty */
  dataUnavailable?: boolean;
  onToggle: (columnKey: FieldAuditColumnKey, visible: boolean) => void;
  onReset: () => void;
}

/**
 * Opt-in toggles for the created/modified columns on the field permissions table. The table is dense enough that
 * these are hidden by default, so this lives in the toolbar rather than adding four permanent columns.
 */
export function FieldAuditColumnsPopover({ visibleColumns, dataUnavailable, onToggle, onReset }: FieldAuditColumnsPopoverProps) {
  return (
    <Popover
      placement="bottom-end"
      header={
        <header className="slds-popover__header">
          <h2 className="slds-text-heading_small">Field Table Columns</h2>
        </header>
      }
      buttonProps={{
        className: 'slds-button slds-button_icon slds-button_icon-border-filled slds-m-left_xx-small',
        title: 'Field table columns',
      }}
      content={
        <div className="slds-p-around_small">
          {dataUnavailable && (
            <ScopedNotification theme="warning" className="slds-m-bottom_small">
              Jetstream could not read field audit data from Salesforce, so these columns will be empty.
            </ScopedNotification>
          )}
          <fieldset className="slds-form-element">
            <legend className="slds-form-element__legend slds-text-title_caps">Optional columns</legend>
            <p className="slds-text-body_small slds-text-color_weak slds-m-bottom_x-small">
              Salesforce only tracks this information for custom fields, so it is always blank for standard fields.
            </p>
            <div className="slds-form-element__control">
              {FIELD_AUDIT_COLUMNS.map(({ key, label }) => (
                <div key={key} className="slds-checkbox">
                  <input
                    type="checkbox"
                    id={`field-audit-column-${key}`}
                    checked={visibleColumns.has(key)}
                    onChange={(event) => onToggle(key, event.target.checked)}
                  />
                  <label className="slds-checkbox__label" htmlFor={`field-audit-column-${key}`}>
                    <span className="slds-checkbox_faux" />
                    <span className="slds-form-element__label">{label}</span>
                  </label>
                </div>
              ))}
            </div>
          </fieldset>
          <div className="slds-m-top_small">
            <button type="button" className="slds-button slds-button_neutral" disabled={!visibleColumns.size} onClick={onReset}>
              Hide All
            </button>
          </div>
        </div>
      }
    >
      <Icon type="utility" icon="settings" className="slds-button__icon" omitContainer />
      <span className="slds-assistive-text">Field table columns</span>
    </Popover>
  );
}

export default FieldAuditColumnsPopover;
