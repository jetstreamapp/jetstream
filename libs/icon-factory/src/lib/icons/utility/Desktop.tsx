import * as React from 'react';
function SvgDesktop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M50 6c0-2.2-1.8-4-4-4H6C3.8 2 2 3.8 2 6v26c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V6zm-6 22.5c0 .8-.7 1.5-1.5 1.5h-33c-.8 0-1.5-.7-1.5-1.5v-19C8 8.7 8.7 8 9.5 8h33c.8 0 1.5.7 1.5 1.5v19zM33 44h-3c-.6 0-1-.4-1-1v-2c0-.6-.4-1-1-1h-4c-.6 0-1 .4-1 1v2c0 .6-.4 1-1 1h-3c-2.2 0-4 1.8-4 4v.5c0 .8.7 1.5 1.5 1.5h19c.8 0 1.5-.7 1.5-1.5V48c0-2.2-1.8-4-4-4z" />
      </g>
    </svg>
  );
}
export default SvgDesktop;
