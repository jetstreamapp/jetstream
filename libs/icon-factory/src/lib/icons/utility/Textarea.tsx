import * as React from 'react';
function SvgTextarea(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44.8 49.5H7.2c-2.6 0-4.7-2.1-4.7-4.7V7.2c0-2.6 2.1-4.7 4.7-4.7h37.6c2.6 0 4.7 2.1 4.7 4.7v37.6c0 2.6-2.1 4.7-4.7 4.7zm-36-39.2v31.3c0 .9.7 1.6 1.6 1.6h31.3c.9 0 1.6-.7 1.6-1.6V10.3c0-.9-.7-1.6-1.6-1.6H10.4c-.9.1-1.6.8-1.6 1.6z"
      />
      <path
        fill="unset"
        d="M35.3 27c.8 0 1.6.7 1.6 1.6v6.8c0 .9-.7 1.6-1.6 1.6h-7.2c-.9 0-1.5-.7-1.6-1.6 0-.6.3-1 .6-1.4l1.5-1.5c1-1 2.1-1.9 3.1-2.8.7-.7 1.4-1.3 2.2-2 .2-.2.4-.4.6-.5.4-.2.6-.2.8-.2z"
      />
    </svg>
  );
}
export default SvgTextarea;
