import * as React from 'react';
function SvgOpen(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path fill="unset" d="M8 35v-.6.6z" />
      <g fill="unset">
        <path d="M46 2H6C3.8 2 2 3.8 2 6v36c0 2.2 1.8 4 4 4h12c.6 0 1-.4 1-1v-4c0-.6-.4-1-1-1H9.5c-.8 0-1.5-.7-1.5-1.5v-25c0-.8.7-1.5 1.5-1.5h33c.8 0 1.5.7 1.5 1.5v25c0 .8-.7 1.5-1.5 1.5H34c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1h12c2.2 0 4-1.8 4-4V6c0-2.2-1.8-4-4-4z" />
        <path d="M37.5 34.6l2.1-2.1c.6-.6.6-1.5 0-2.1L27 17.8c-.6-.6-1.5-.6-2.1 0L12.4 30.3c-.6.6-.6 1.5 0 2.1l2.1 2.1c.6.6 1.5.6 2.1 0l4.6-4.6c.6-.6 1.8-.2 1.8.7v17.9c0 .8.6 1.5 1.4 1.5h3c.8 0 1.6-.7 1.6-1.5V30.6c0-.9 1-1.3 1.7-.7l4.6 4.7c.6.5 1.6.5 2.2 0z" />
      </g>
    </svg>
  );
}
export default SvgOpen;
