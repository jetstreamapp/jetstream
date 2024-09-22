import * as React from 'react';
function SvgCurrency(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M744 308H256c-31 0-56 25-56 56v272c0 31 25 56 56 56h488c31 0 56-25 56-56V364c0-31-25-56-56-56zM322 636c0-37-29-66-66-66V430c37 0 66-29 66-66h356c0 37 29 66 66 66v140c-37 0-66 29-66 66z" />
      <circle cx={500} cy={495} r={94} />
    </svg>
  );
}
export default SvgCurrency;
