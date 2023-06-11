import * as React from 'react';
function SvgLike(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M10.5 21h-5c-.8 0-1.5.7-1.5 1.5v23c0 .8.7 1.5 1.5 1.5H8c2.2 0 4-1.8 4-4V22.5c0-.8-.7-1.5-1.5-1.5zM44 22h-6c-2.2 0-4-1.8-4-4V8c0-2.2-1.8-4-4-4h-2.5c-.8 0-1.5.7-1.5 1.5v6c0 5.3-3.7 10.5-8.5 10.5-.8 0-1.5.7-1.5 1.5v20c0 .8.6 1.5 1.4 1.5 6.8.3 9.1 3 16.2 3 7.5 0 14.4-.8 14.4-9.5V26c0-2.2-1.8-4-4-4z" />
      </g>
    </svg>
  );
}
export default SvgLike;
