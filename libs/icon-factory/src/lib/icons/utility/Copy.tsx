import * as React from 'react';
function SvgCopy(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path fill="unset" d="M44 2H18c-2.2 0-4 1.8-4 4v2h24c2.2 0 4 1.8 4 4v28h2c2.2 0 4-1.8 4-4V6c0-2.2-1.8-4-4-4z" />
      <path
        fill="unset"
        d="M38 16c0-2.2-1.8-4-4-4H8c-2.2 0-4 1.8-4 4v30c0 2.2 1.8 4 4 4h26c2.2 0 4-1.8 4-4V16zm-18 7c0 .6-.4 1-1 1h-8c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h8c.6 0 1 .4 1 1v2zm8 16c0 .6-.4 1-1 1H11c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h16c.6 0 1 .4 1 1v2zm4-8c0 .6-.4 1-1 1H11c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h20c.6 0 1 .4 1 1v2z"
      />
    </svg>
  );
}
export default SvgCopy;
