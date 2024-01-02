import * as React from 'react';
function SvgInspectorPanel(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M3.8 45.3h45c.8 0 1.5-.7 1.5-1.5v-8.3c0-.8-.7-1.5-1.5-1.5h-45c-.8 0-1.5.7-1.5 1.5v8.3c0 .8.7 1.5 1.5 1.5zm0-38.6c-.8 0-1.6.7-1.6 1.5v20.4c0 .7.8 1.4 1.6 1.4h44.8c.8 0 1.5-.7 1.5-1.5V8.2c0-.8-.7-1.5-1.5-1.5H3.8z"
      />
    </svg>
  );
}
export default SvgInspectorPanel;
