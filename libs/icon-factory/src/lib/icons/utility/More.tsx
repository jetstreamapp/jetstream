import * as React from 'react';
function SvgMore(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M26 2C12.75 2 2 12.75 2 26s10.75 24 24 24 24-10.75 24-24S39.25 2 26 2zM11 31c-2.75 0-5-2.25-5-5s2.25-5 5-5 5 2.25 5 5-2.25 5-5 5zm15 0c-2.75 0-5-2.25-5-5s2.25-5 5-5 5 2.25 5 5-2.25 5-5 5zm15 0c-2.75 0-5-2.25-5-5s2.25-5 5-5 5 2.25 5 5-2.25 5-5 5z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgMore;
