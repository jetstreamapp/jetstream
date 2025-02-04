import * as React from 'react';
function SvgSendLog(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <rect x={20} y={22.5} width={42.5} height={7.5} rx={0.9} ry={0.9} fill="unset" />
      <rect x={20} y={37.5} width={42.5} height={7.5} rx={0.9} ry={0.9} fill="unset" />
      <path
        d="M20.9 52.4c-.5 0-.9.4-.9.9v5.6c0 .5.4.9.9.9h22l-2-7.5h-20v.1zM79.3 62.6L48.8 50h-.3c-.5 0-1 .4-1 .9v.5l2.9 10.9H63c.3 0 .7.3.7.7v1.4c0 .3-.3.7-.7.7H50.4l-3 11.1v.3c0 .5.4 1 1 1h.4l30.6-12.9c.3 0 .6-.5.6-.9s-.3-.8-.7-.9v-.2z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgSendLog;
