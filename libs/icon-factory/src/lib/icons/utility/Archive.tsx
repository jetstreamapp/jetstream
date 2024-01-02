import * as React from 'react';
function SvgArchive(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M45.2 2.3H6.8C4.2 2.3 2 4.5 2 7.1v4.8c0 .9.7 1.6 1.6 1.6h44.8c.9 0 1.6-.7 1.6-1.6V7.1c0-2.6-2.2-4.8-4.8-4.8zM46.6 17.5H5.5c-.9 0-1.6.7-1.6 1.6v26.4c0 2.6 2.2 4.8 4.8 4.8h34.8c2.6 0 4.8-2.2 4.8-4.8V19.1c-.1-.9-.8-1.6-1.7-1.6zm-13.8 8H19.2c-1.1 0-2-.9-2-2s.9-2 2-2h13.6c1.1 0 2 .9 2 2s-.9 2-2 2z"
      />
    </svg>
  );
}
export default SvgArchive;
