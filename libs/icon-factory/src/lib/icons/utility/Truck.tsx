import * as React from 'react';
function SvgTruck(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M496 237l-59-59a15 15 0 00-10-4h-62a15 15 0 00-15 15v120a7 7 0 0010 6 88 88 0 0135-6 91 91 0 0178 46 8 8 0 0012 2 46 46 0 0015-33v-77a15 15 0 00-4-10zM290 106H35a15 15 0 00-15 15v203a46 46 0 0015 34 7 7 0 0011-3 90 90 0 01162 9 7 7 0 007 5h45a45 45 0 0045-45V121a15 15 0 00-15-15z" />
      <circle cx={395} cy={399} r={45} />
      <circle cx={125} cy={399} r={45} />
    </svg>
  );
}
export default SvgTruck;
