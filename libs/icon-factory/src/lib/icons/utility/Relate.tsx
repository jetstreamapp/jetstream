import * as React from 'react';
function SvgRelate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M36 20c0-2.2-1.8-4-4-4H6c-2.2 0-4 1.8-4 4v26c0 2.2 1.8 4 4 4h26c2.2 0 4-1.8 4-4V20zm-8 14c0 .5-.5 1-1 1h-6v6c0 .5-.5 1-1 1h-2c-.5 0-1-.5-1-1v-6h-6c-.5 0-1-.5-1-1v-2c0-.5.5-1 1-1h6v-6c0-.5.5-1 1-1h2c.5 0 1 .5 1 1v6h6c.5 0 1 .5 1 1v2z"
      />
      <path
        fill="unset"
        d="M43 42h-3v-6h3c.6 0 1-.4 1-1V9c0-.6-.4-1-1-1H17c-.6 0-1 .4-1 1v3h-6V9c0-3.9 3.1-7 7-7h26c3.9 0 7 3.1 7 7v26c0 3.9-3.1 7-7 7z"
      />
    </svg>
  );
}
export default SvgRelate;
