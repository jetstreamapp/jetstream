import * as React from 'react';
function SvgBuilder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M11.5 17h-8c-.8 0-1.5.7-1.5 1.5V44c0 2.2 1.8 4 4 4h5.5c.8 0 1.5-.7 1.5-1.5v-28c0-.8-.7-1.5-1.5-1.5zM48.5 17h-30c-.8 0-1.5.7-1.5 1.5v28c0 .8.7 1.5 1.5 1.5H46c2.2 0 4-1.8 4-4V18.5c0-.8-.7-1.5-1.5-1.5zM46 4H6C3.8 4 2 5.8 2 8v3.5c0 .8.7 1.5 1.5 1.5h45c.8 0 1.5-.7 1.5-1.5V8c0-2.2-1.8-4-4-4z" />
      </g>
    </svg>
  );
}
export default SvgBuilder;
