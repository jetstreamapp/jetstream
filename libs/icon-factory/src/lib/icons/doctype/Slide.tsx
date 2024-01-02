import * as React from 'react';
function SvgSlide(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path
        d="M5.15.008A5.074 5.074 0 00.078 5.082v53.842a5.072 5.072 0 005.072 5.073h45.775a5.074 5.074 0 005.074-5.073V20.318L37.096.008H5.15z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#0D9DDA"
      />
      <path d="M10.121 34.772v19.09h19.918v-19.09H10.121zM28.226 50.24H11.931V38.396h16.295V50.24z" fill="unset" />
      <path
        d="M55.977 20.352v1H43.178s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707h12.924z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#05628A"
      />
      <path d="M37.074 0v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.074 0z" fillRule="evenodd" clipRule="evenodd" fill="#90D0FE" />
    </svg>
  );
}
export default SvgSlide;
