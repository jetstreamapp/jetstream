import * as React from 'react';
function SvgInbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M50 8c0-2.2-1.8-4-4-4H6C3.8 4 2 5.8 2 8v36c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V8zM19 35c0 .6-.4 1-1 1H9c-.6 0-1-.4-1-1v-4c0-.6.4-1 1-1h9c.6 0 1 .4 1 1v4zm0-10c0 .6-.4 1-1 1H9c-.6 0-1-.4-1-1v-4c0-.6.4-1 1-1h9c.6 0 1 .4 1 1v4zm0-10c0 .6-.4 1-1 1H9c-.6 0-1-.4-1-1v-4c0-.6.4-1 1-1h9c.6 0 1 .4 1 1v4zm25 26c0 .6-.4 1-1 1H24c-.6 0-1-.4-1-1V11c0-.6.4-1 1-1h19c.6 0 1 .4 1 1v30z"
      />
    </svg>
  );
}
export default SvgInbox;
