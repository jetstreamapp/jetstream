import * as React from 'react';
function SvgLayoutCard(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M5.1 3.29A3.1 3.1 0 002 6.39v39.22a3.1 3.1 0 003.1 3.1h18.58a3.09 3.09 0 003.09-3.1V6.39a3.09 3.09 0 00-3.09-3.1zm26.84 10.84a2.58 2.58 0 100 5.16h15.48a2.58 2.58 0 000-5.16zM29.35 26a2.58 2.58 0 012.59-2.58h15.48a2.58 2.58 0 010 5.16H31.94A2.58 2.58 0 0129.35 26zm2.59 6.71a2.58 2.58 0 100 5.16h15.48a2.58 2.58 0 000-5.16z"
        fill="unset"
        fillRule="evenodd"
      />
    </svg>
  );
}
export default SvgLayoutCard;
