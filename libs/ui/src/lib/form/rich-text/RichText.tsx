/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import RichTextToolbar from 'libs/ui/src/lib/form/rich-text/RichTextToolbar';
import HelpText from 'libs/ui/src/lib/widgets/HelpText';
import { uniqueId } from 'lodash';
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
  labelHelp?: string | JSX.Element;
  debounceTimeMs?: number;
  onChange: (contents: DeltaOperation[]) => void;
}

export const RichText: FunctionComponent<RichTextProps> = ({
  label,
  isRequired,
  labelHelp,
  options = {},
  debounceTimeMs = 300,
  onChange,
}) => {
  const [id] = useState(uniqueId('rich-text-'));
  const editorContainerRef = useRef<HTMLDivElement>();
  const editorRef = useRef<Quill>();
  const [contents, setContents] = useState<DeltaOperation[]>();
  const debouncedContents = useDebounce(contents, debounceTimeMs);

  const handleTextChange = useCallback(
    (delta: DeltaStatic, oldDelta: DeltaStatic, source: Sources) => {
      setContents(editorRef.current.getContents().ops);
    },
    [editorContainerRef.current, setContents]
  );

  useEffect(() => {
    if (editorContainerRef.current && !editorRef.current) {
      editorRef.current = new Quill(editorContainerRef.current, { ...DEFAULT_OPTIONS, scrollingContainer: `${id}-container`, ...options });
      editorRef.current.on('text-change', handleTextChange);
    }
  }, [editorContainerRef.current]);

  useNonInitialEffect(() => {
    onChange(debouncedContents);
  }, [debouncedContents]);

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
        <div className="slds-rich-text-editor slds-grid slds-grid_vertical slds-nowrap">
          <RichTextToolbar />
          <div
            id={`${id}-container`}
            className="slds-rich-text-editor__textarea slds-grid"
            css={css`
              min-height: 250px;
            `}
          >
            <div id={id} ref={editorContainerRef} className="slds-rich-text-area__content slds-text-color_weak slds-grow"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RichText;
