import * as React from 'react';
function SvgFallback(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M28 3.5l-3 14.6c0 .6.4.9.9.9h15.6c1.1 0 1.8 1.3 1.3 2.3l-17 27.9c-.7 1.4-2.8.9-2.8-.7l3-17.2c0-.6-.5-.4-1.1-.4H8.5c-1.1 0-1.9-1.6-1.3-2.6l18-25.5c.7-1.3 2.8-.9 2.8.7z"
      />
    </svg>
  );
}
export default SvgFallback;
