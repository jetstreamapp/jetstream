import * as React from 'react';
function SvgDescription(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M44 4H8C5.8 4 4 5.8 4 8v36c0 2.2 1.8 4 4 4h36c2.2 0 4-1.8 4-4V8c0-2.2-1.8-4-4-4zM12 14c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v10c0 .6-.4 1-1 1H13c-.6 0-1-.4-1-1V14zm24 26c0 .6-.4 1-1 1H13c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h22c.6 0 1 .4 1 1v2zm4-8c0 .6-.4 1-1 1H13c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h26c.6 0 1 .4 1 1v2zm0-8c0 .6-.4 1-1 1H29c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v2zm0-8c0 .6-.4 1-1 1H29c-.6 0-1-.4-1-1v-2c0-.6.4-1 1-1h10c.6 0 1 .4 1 1v2z"
      />
    </svg>
  );
}
export default SvgDescription;
