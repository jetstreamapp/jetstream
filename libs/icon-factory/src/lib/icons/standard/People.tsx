import * as React from 'react';
function SvgPeople(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M800 712v28c0 33-27 60-60 60H260c-33 0-60-27-60-60v-28c0-73 85-117 165-152l8-4c6-3 13-3 19 1a196 196 0 00216 1c6-4 13-4 19-1l8 4c80 34 165 78 165 151z" />
      <ellipse cx={500} cy={365} rx={149} ry={165} />
    </svg>
  );
}
export default SvgPeople;
