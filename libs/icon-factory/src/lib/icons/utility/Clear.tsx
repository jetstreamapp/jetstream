import * as React from 'react';
function SvgClear(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M26 2C12.7 2 2 12.7 2 26s10.7 24 24 24 24-10.7 24-24S39.3 2 26 2zm4.9 24.8l7.8 7.8c.4.4.4 1 0 1.4l-2.8 2.8c-.4.4-1 .4-1.4 0L26.7 31c-.4-.4-1-.4-1.4 0l-7.8 7.8c-.4.4-1 .4-1.4 0L13.3 36c-.4-.4-.4-1 0-1.4l7.8-7.8c.4-.4.4-1 0-1.4l-7.9-7.9c-.4-.4-.4-1 0-1.4l2.8-2.8c.4-.4 1-.4 1.4 0l7.9 7.9c.4.4 1 .4 1.4 0l7.8-7.8c.4-.4 1-.4 1.4 0l2.8 2.8c.4.4.4 1 0 1.4l-7.8 7.8c-.3.4-.3 1 0 1.4z"
      />
    </svg>
  );
}
export default SvgClear;
