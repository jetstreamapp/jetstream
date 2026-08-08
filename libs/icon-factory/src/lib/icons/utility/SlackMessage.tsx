import * as React from 'react';
function SvgSlackMessage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M26 2c13.25 0 24 10.75 24 24 0 3.92-.94 7.62-2.61 10.89l2.55 10.49c.17.72-.04 1.48-.56 2s-1.28.73-2 .56l-10.49-2.55A23.87 23.87 0 0126 50C12.75 50 2 39.25 2 26S12.75 2 26 2zm0 4.24C15.08 6.24 6.24 15.08 6.24 26S15.09 45.76 26 45.76c3.48 0 6.75-.9 9.58-2.47l.36-.16c.37-.12.78-.14 1.17-.05L45 45l-1.92-7.89c-.13-.52-.05-1.06.21-1.53A19.62 19.62 0 0045.76 26c0-10.92-8.85-19.76-19.76-19.76z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgSlackMessage;
