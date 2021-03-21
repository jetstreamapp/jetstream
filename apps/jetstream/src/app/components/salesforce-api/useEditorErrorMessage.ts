import { Editor, LineWidget } from 'codemirror';
import { useEffect, useRef } from 'react';

export function useEditorErrorMessage(editorInstance: Editor, errorMessage: string) {
  const widget = useRef<LineWidget>();

  useEffect(() => {
    if (editorInstance) {
      if (widget.current) {
        editorInstance.removeLineWidget(widget.current);
      }
      if (errorMessage) {
        // remove widget if exists
        const errorNode = document.createElement('div');
        errorNode.appendChild(document.createTextNode(errorMessage));
        widget.current = editorInstance.addLineWidget(0, errorNode, {
          above: true,
          className: 'slds-text-color_inverse-weak',
          noHScroll: true,
          showIfHidden: true,
        });
      }
    }
  }, [editorInstance, errorMessage]);
}
