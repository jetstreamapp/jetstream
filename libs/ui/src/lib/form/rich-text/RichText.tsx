import { css } from '@emotion/react';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import classNames from 'classnames';
import RichTextToolbar from './RichTextToolbar';
import HelpText from '../../widgets/HelpText';
import isBoolean from 'lodash/isBoolean';
import uniqueId from 'lodash/uniqueId';
import Quill, { DeltaOperation, DeltaStatic, QuillOptionsStatic, Sources } from 'quill';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_OPTIONS: QuillOptionsStatic = {
  formats: [
    'header',
    'size',
    'bold',
    'italic',
    'underline',
    'strike',
    'blockquote',
    'list',
    'bullet',
    'link',
    'image',
    'indent',
    'code',
    'code-block',
  ],
  modules: {
    toolbar: {
      container: '#toolbar',
    },
  },
};

export interface RichTextProps {
  label?: string;
  isRequired?: boolean;
  options?: QuillOptionsStatic;
  labelHelp?: string | JSX.Element | null;
  debounceTimeMs?: number;
  disabled?: boolean;
  onChange: (contents: DeltaOperation[]) => void;
}

export const RichText: FunctionComponent<RichTextProps> = ({
  label,
  isRequired,
  labelHelp,
  options = {},
  debounceTimeMs = 300,
  disabled,
  onChange,
}) => {
  const [id] = useState(uniqueId('rich-text-'));
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Quill>();
  const [contents, setContents] = useState<DeltaOperation[]>();
  const debouncedContents = useDebounce(contents, debounceTimeMs);
  const [hasFocus, setHasFocus] = useState(false);

  const handleTextChange = useCallback(
    (delta: DeltaStatic, oldDelta: DeltaStatic, source: Sources) => {
      setContents(editorRef.current?.getContents().ops);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editorContainerRef.current, setContents]
  );

  useEffect(() => {
    if (editorContainerRef.current && !editorRef.current) {
      editorRef.current = new Quill(editorContainerRef.current, {
        ...DEFAULT_OPTIONS,
        scrollingContainer: `${id}-container`,
        readOnly: !!disabled,
        ...options,
      });
      editorRef.current.on('text-change', handleTextChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorContainerRef.current]);

  useNonInitialEffect(() => {
    if (isBoolean(disabled) && editorRef.current) {
      editorRef.current.enable(!disabled);
    }
  }, [disabled]);

  useNonInitialEffect(() => {
    debouncedContents && onChange(debouncedContents);
  }, [debouncedContents, onChange]);

  function handleFocus(focus: boolean) {
    setHasFocus(focus);
  }

  return (
    <div className="slds-form-element">
      {label && (
        <Fragment>
          <label className="slds-form-element__label" htmlFor={id}>
            {isRequired && (
              <abbr className="slds-required" title="required">
                *{' '}
              </abbr>
            )}
            {label}
          </label>
          {labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        </Fragment>
      )}
      <div className="slds-form-element__control">
        <div className={classNames('slds-rich-text-editor slds-grid slds-grid_vertical slds-nowrap', { 'slds-has-focus': hasFocus })}>
          <RichTextToolbar disabled={disabled} />
          <div
            id={`${id}-container`}
            className={classNames('slds-grid', {
              'slds-rich-text-editor__textarea': disabled,
              'slds-rich-text-editor__output': !disabled,
            })}
            css={css`
              min-height: 250px;
            `}
          >
            <div
              id={id}
              ref={editorContainerRef}
              className="slds-rich-text-area__content slds-text-color_weak slds-grow"
              onFocus={() => handleFocus(true)}
              onBlur={() => handleFocus(false)}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RichText;
