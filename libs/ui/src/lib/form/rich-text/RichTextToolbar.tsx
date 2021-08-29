/** @jsx jsx */
import { jsx } from '@emotion/react';
import { IconName } from '@jetstream/icon-factory';
import Select from 'libs/ui/src/lib/form/select/Select';
import Icon from 'libs/ui/src/lib/widgets/Icon';
import { uniqueId } from 'lodash';
import { FunctionComponent, useState } from 'react';

export interface RichTextToolbarProps {}

export const RichTextToolbar: FunctionComponent<RichTextToolbarProps> = ({}) => {
  const [selectId] = useState(uniqueId('select'));

  /**
   * TODO: keyboard navigation, arrows to move between buttons
   */

  return (
    <div id="toolbar" role="toolbar" className="slds-rich-text-editor__toolbar slds-shrink-none">
      <div className="slds-grid slds-rich-text-editor__spacing-wrapper" role="group" aria-label="Format font family &amp; size">
        <div className="slds-rich-text-editor__select">
          <Select id={selectId}>
            <select className="ql-header slds-select" id={selectId} defaultValue={''}>
              <option value="1">Heading 1</option>
              <option value="2">Heading 2</option>
              <option value="">Normal</option>
            </select>
          </Select>
        </div>
      </div>
      <ul aria-label="Format text" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-bold" icon="bold" label="Bold" tabIndex={0} />
        </li>
        <li>
          <RichTextToolbarButton className="ql-italic" icon="italic" label="Italic" />
        </li>
        <li>
          <RichTextToolbarButton className="ql-strike" icon="strikethrough" label="Strike Through" />
        </li>
      </ul>
      <ul aria-label="Format body" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-list" value="bullet" icon="richtextbulletedlist" label="Bulleted List" />
        </li>
        <li>
          <RichTextToolbarButton className="ql-list" value="ordered" icon="richtextnumberedlist" label="Numbered List" />
        </li>
        <li>
          <RichTextToolbarButton className="ql-indent" value="-1" icon="richtextindent" label="Indent" />
        </li>
        <li>
          <RichTextToolbarButton className="ql-indent" value="+1" icon="richtextoutdent" label="Outdent" />
        </li>
      </ul>
      <ul aria-label="Other formatting options" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-blockquote" icon="quotation_marks" label="Block Quote" />
        </li>
        <li>
          <RichTextToolbarButton className="ql-code" icon="apex" label="Inline code" />
        </li>
        <li>
          <RichTextToolbarButton className="ql-code-block" icon="insert_tag_field" label="Code Block" />
        </li>
      </ul>
      {/* TODO: need custom handler for these! */}
      {/* <li aria-label="Insert content" className="slds-button-group-list">
          <RichTextToolbarButton className="ql-image" icon="image" label="Add Image" />
          <RichTextToolbarButton className="ql-link" icon="link" label="Add Link" />
        </li> */}
      <ul aria-label="Remove Formatting" className="slds-button-group-list">
        <li>
          <RichTextToolbarButton className="ql-clean" icon="remove_formatting" label="Remove Formatting" />
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
}> = ({ className, label, icon, tabIndex = -1, value }) => {
  return (
    <button className={`${className} slds-button slds-button_icon slds-button_icon-border-filled`} tabIndex={tabIndex} value={value}>
      <Icon type="utility" icon={icon} description={label} title={label} className="slds-button__icon" omitContainer />
    </button>
  );
};
