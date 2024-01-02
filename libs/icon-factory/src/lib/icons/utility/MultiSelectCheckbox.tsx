import * as React from 'react';
function SvgMultiSelectCheckbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44 2.5H19c-2.6 0-4.7 2.1-4.7 4.7V8c0 .5.3.8.8.8h22.7c2.6 0 4.7 2.1 4.7 4.7v24.3c0 .5.3.8.8.8h.7c2.6 0 4.7-2.1 4.7-4.7V7.2c0-2.6-2.1-4.7-4.7-4.7z"
      />
      <path
        fill="unset"
        d="M33 13.5H8c-2.6 0-4.7 2.1-4.7 4.7v26.6c0 2.6 2.1 4.7 4.7 4.7h25c2.6 0 4.7-2.1 4.7-4.7V18.2c.1-2.6-2.1-4.7-4.7-4.7zm-2 13.3l-12 12c-.5.5-1 .7-1.6.7-.5 0-1.2-.2-1.6-.7L10 33c-.5-.5-.5-1.2 0-1.6l1.6-1.6c.5-.5 1.2-.5 1.6 0l4.2 4.2 10.3-10.3c.5-.5 1.2-.5 1.6 0l1.6 1.6c.5.3.5 1.1.1 1.5z"
      />
    </svg>
  );
}
export default SvgMultiSelectCheckbox;
