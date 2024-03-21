import * as React from 'react';
function SvgAdvancedFunction(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M43 6.9V4c0-.8-.7-1.5-1.5-1.5H11.8c-.8 0-1.5.7-1.5 1.5v3.1c0 .3 0 .7.3 1L25.2 26 10.6 43.9c-.2.3-.3.6-.3 1V48c0 .8.7 1.5 1.5 1.5h29.7c.8 0 1.5-.7 1.5-1.5v-2.9c0-.8-.7-1.5-1.5-1.5H18.4l13.3-16.3c.3-.4.4-.8.4-1.4 0-.5-.2-1-.5-1.4L18.4 8.4h23.1c.8 0 1.5-.7 1.5-1.5z"
      />
    </svg>
  );
}
export default SvgAdvancedFunction;
