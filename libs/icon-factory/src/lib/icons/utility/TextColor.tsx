import * as React from 'react';
function SvgTextColor(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M10.4 36h4.1c.6 0 1.2-.5 1.4-1.1l3.2-8.9h13.4l3.5 8.9c.2.6.8 1.1 1.4 1.1h4.1c.7 0 1.2-.7.9-1.3L30.4 5c-.2-.6-.7-1-1.3-1H22c-.6 0-1.2.4-1.4 1l-11 29.7c-.3.6.2 1.3.8 1.3zm14.7-26h.9l4.3 10h-9l3.8-10zM48.5 42h-45c-.8 0-1.5.7-1.5 1.5v3c0 .8.7 1.5 1.5 1.5h45c.8 0 1.5-.7 1.5-1.5v-3c0-.8-.7-1.5-1.5-1.5z"
      />
    </svg>
  );
}
export default SvgTextColor;
