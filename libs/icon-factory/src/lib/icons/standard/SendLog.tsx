import * as React from 'react';
function SvgSendLog(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <rect width={425} height={75} x={200} y={225} rx={9} />
      <rect width={425} height={75} x={200} y={375} rx={9} />
      <path d="M209 524c-5 0-9 4-9 9v56c0 5 4 9 9 9h220l-20-75H209zm584 102L488 500h-3c-5 0-10 4-10 9v5l29 109h126c3 0 7 3 7 7v14c0 3-3 7-7 7H504l-30 111v3c0 5 4 10 10 10h4l306-129c3 0 6-5 6-9s-3-8-7-9z" />
    </svg>
  );
}
export default SvgSendLog;
