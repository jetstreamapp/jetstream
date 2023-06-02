import * as React from 'react';
function SvgDayview(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44 7h-5V5c0-1.6-1.3-3-3-3-1.6 0-3 1.3-3 3v2H19V5c0-1.6-1.3-3-3-3-1.6 0-3 1.3-3 3v2H8c-2.2 0-4 1.8-4 4v2.5c0 .8.7 1.5 1.5 1.5h41c.8 0 1.5-.7 1.5-1.5V11c0-2.2-1.8-4-4-4zM46.5 20h-41c-.8 0-1.5.7-1.5 1.5V46c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V21.5c0-.8-.7-1.5-1.5-1.5zM29 42v.2c0 .8-1 1.8-2 1.8s-2-1-2-2V32l-1.5 1.6c-.3.3-.6.4-1 .4-.8 0-1.5-.7-1.5-1.5 0-.4.2-.8.5-1.1l3.9-3.9c.4-.4.9-.6 1.5-.6 1.1 0 2.1.9 2.1 2V42z"
      />
    </svg>
  );
}
export default SvgDayview;
