import * as React from 'react';
function SvgVideo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path
        d="M5.15.011A5.073 5.073 0 00.078 5.085v53.841A5.073 5.073 0 005.15 64h45.775A5.075 5.075 0 0056 58.926V20.32L37.096.011H5.15z"
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#730394"
      />
      <g fillRule="evenodd" clipRule="evenodd">
        <path d="M55.977 20.352v1H43.178s-6.312-1.26-6.129-6.707c0 0 .208 5.707 6.004 5.707h12.924z" fill="#3D0157" />
        <path d="M37.074 0v14.561c0 1.656 1.104 5.791 6.104 5.791h12.799L37.074 0z" fill="#E5B9FE" />
      </g>
      <path
        d="M24.531 45.529c0 .368-.163.736-.449.981-.205.163-5.255 4.417-11.839 7.095a1.411 1.411 0 01-.511.103 1.35 1.35 0 01-.675-.184 1.229 1.229 0 01-.613-.981c-.021-.144-.307-3.456-.307-7.014s.286-6.87.307-6.993c.021-.408.266-.776.613-1.002.205-.122.43-.184.675-.184.164 0 .348.041.511.103 6.584 2.678 11.634 6.932 11.839 7.115.286.225.449.593.449.961z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgVideo;
