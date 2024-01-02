import * as React from 'react';
function SvgSmileyAndPeople(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M50 26.1c0 13.3-10.755 24.1-24 24.1S2 39.4 2 26.1 12.755 2 26 2s24 10.8 24 24.1zM17 15c-1.674 0-3 1.767-3 4s1.326 4 3 4 3-1.767 3-4-1.326-4-3-4zm18 0c-1.674 0-3 1.767-3 4s1.326 4 3 4 3-1.767 3-4-1.326-4-3-4zM11 29c.632 7.644 6.158 14 14.921 14C34.685 43 40.368 36.644 41 29H11z"
      />
    </svg>
  );
}
export default SvgSmileyAndPeople;
