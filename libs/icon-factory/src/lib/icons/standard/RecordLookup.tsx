import * as React from 'react';
function SvgRecordLookup(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M39 32h22c1.1 0 2-.9 2-2v-4c0-3.3-2.7-6-6-6H43c-3.3 0-6 2.7-6 6v4c0 1.1.9 2 2 2z" />
        <path d="M72 25h-2c-.6 0-1 .4-1 1v4c0 4.4-3.6 8-8 8H39c-4.4 0-8-3.6-8-8v-4c0-.6-.4-1-1-1h-2c-3.3 0-6 2.7-6 6v43c0 3.3 2.7 6 6 6h44c3.3 0 6-2.7 6-6V31c0-3.3-2.7-6-6-6zm-7.7 47.6L63 73.9c-.3.3-.9.3-1.3 0l-8.1-8.1c-2.3 1.6-5.2 2.5-8.4 2.1-5.2-.7-9.4-5.1-9.9-10.3-.7-7.2 5.4-13.4 12.6-12.6 5.3.5 9.6 4.6 10.3 9.9.4 3.1-.4 6.1-2.1 8.4l8.1 8.1c.5.2.5.8.1 1.2z" />
        <path d="M46.9 48.5c-4.4 0-7.9 3.6-7.9 7.9 0 4.4 3.5 7.9 7.9 7.9s7.9-3.5 7.9-7.9-3.5-7.9-7.9-7.9z" />
      </g>
    </svg>
  );
}
export default SvgRecordLookup;
