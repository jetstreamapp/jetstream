import * as React from 'react';
function SvgPack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path
        d="M5.15.012A5.073 5.073 0 00.078 5.086v53.841A5.073 5.073 0 005.15 64h45.775A5.074 5.074 0 0056 58.927V20.321L37.096.012H5.15z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#0B5CAB"
      />
      <g fillRule="evenodd" clipRule="evenodd">
        <path d="M55.977 20.352v1H43.178s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707h12.924z" fill="#032D60" />
        <path d="M37.074 0v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.074 0z" fill="#AACBFF" />
      </g>
      <path
        d="M29.187 40.872v11.917c0 .662-.529 1.191-1.191 1.191H11.311a1.186 1.186 0 01-1.191-1.191V40.872c0-.133.021-.265.065-.375l1.59-4.768a1.184 1.184 0 011.125-.816h13.507c.508 0 .971.331 1.125.816l1.59 4.768c.043.11.065.242.065.375zm-2.45 0l-1.191-3.575H13.76l-1.191 3.575h14.168z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgPack;
