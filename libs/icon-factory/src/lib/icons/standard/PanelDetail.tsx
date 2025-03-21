import * as React from 'react';
function SvgPanelDetail(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M700 200H300c-55 0-100 45-100 100v400c0 55 45 100 100 100h400c55 0 100-45 100-100V300c0-55-45-100-100-100zm50 500c0 28-22 50-50 50H300c-28 0-50-22-50-50V300c0-28 22-50 50-50h400c28 0 50 22 50 50zM650 400H550c-28 0-50 22-50 50v150c0 28 22 50 50 50h100c28 0 50-22 50-50V450c0-28-22-50-50-50zm0 192c0 4-4 8-8 8h-84c-4 0-8-4-8-8v-34c0-4 4-8 8-8h84c4 0 8 4 8 8zm0-100c0 4-4 8-8 8h-84c-4 0-8-4-8-8v-34c0-4 4-8 8-8h84c4 0 8 4 8 8zm25-192H325a25 25 0 000 50h350a25 25 0 000-50z" />
    </svg>
  );
}
export default SvgPanelDetail;
