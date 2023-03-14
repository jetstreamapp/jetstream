import { IconName } from '@jetstream/icon-factory';
import uniqueId from 'lodash/uniqueId';
import { FunctionComponent, useState } from 'react';
import Icon from '../../widgets/Icon';
import Select from '../select/Select';

export interface RichTextToolbarProps {
  disabled?: boolean;
}

export const RichTextToolbar: FunctionComponent<RichTextToolbarProps> = ({ disabled }) => {
  const [selectId] = useState(uniqueId('select'));

  /**
   * TODO: keyboard navigation, arrows to move between buttons
   */

  return (
    <div
      id="toolbar"
      role="toolbar"
      aria-label={disabled ? 'disabled' : undefined}
      className="slds-rich-text-editor__toolbar slds-shrink-none"
    >
      <div className="slds-grid slds-rich-text-editor__spacing-wrapper" role="group" aria-label="Format font family &amp; size">
        <div className="slds-rich-text-editor__select">
          <Select id={selectId}>
            <select className="ql-header slds-select" id={selectId} defaultValue={''} disabled={disabled}>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="">Normal</option>
            </select>
          </Select>
        </div>
      </div>
      <ul aria-label="Format text" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-bold" icon="bold" label="Bold" tabIndex={0} disabled={disabled} />
        </li>
        <li>
          <RichTextToolbarButton className="ql-italic" icon="italic" label="Italic" disabled={disabled} />
        </li>
        <li>
          <RichTextToolbarButton className="ql-strike" icon="strikethrough" label="Strike Through" disabled={disabled} />
        </li>
      </ul>
      <ul aria-label="Format body" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-list" value="bullet" icon="richtextbulletedlist" label="Bulleted List" disabled={disabled} />
        </li>
        <li>
          <RichTextToolbarButton
            className="ql-list"
            value="ordered"
            icon="richtextnumberedlist"
            label="Numbered List"
            disabled={disabled}
          />
        </li>
        <li>
          <RichTextToolbarButton className="ql-indent" value="-1" icon="richtextindent" label="Indent" disabled={disabled} />
        </li>
        <li>
          <RichTextToolbarButton className="ql-indent" value="+1" icon="richtextoutdent" label="Outdent" disabled={disabled} />
        </li>
      </ul>
      <ul aria-label="Other formatting options" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-blockquote" icon="quotation_marks" label="Block Quote" disabled={disabled} />
        </li>
        <li>
          <RichTextToolbarButton className="ql-code" icon="apex" label="Inline code" disabled={disabled} />
        </li>
        <li>
          <RichTextToolbarButton className="ql-code-block" icon="insert_tag_field" label="Code Block" disabled={disabled} />
        </li>
      </ul>
      {/* TODO: need custom handler for these! */}
      {/* <li aria-label="Insert content" className="slds-button-group-list">
          <RichTextToolbarButton className="ql-image" icon="image" label="Add Image" disabled={disabled} />
          <RichTextToolbarButton className="ql-link" icon="link" label="Add Link" disabled={disabled} />
        </li> */}
      <ul aria-label="Remove Formatting" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-clean" icon="remove_formatting" label="Remove Formatting" disabled={disabled} />
        </li>
      </ul>
    </div>
  );
};

export default RichTextToolbar;

const RichTextToolbarButton: FunctionComponent<{
  className: string;
  icon: IconName;
  label: string;
  tabIndex?: number;
  value?: string;
  disabled?: boolean;
}> = ({ className, label, icon, tabIndex = -1, value, disabled }) => {
  return (
    <button
      className={`${className} slds-button slds-button_icon slds-button_icon-border-filled`}
      tabIndex={tabIndex}
      value={value}
      disabled={disabled}
    >
      <Icon type="utility" icon={icon} description={label} title={label} className="slds-button__icon" omitContainer />
    </button>
  );
};
