import * as React from 'react';
function SvgTimesheet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M709 200H291c-43 0-78 35-78 78v443c0 43 35 78 78 78h417c43 0 78-35 78-78V278c1-43-34-78-77-78zm-26 470c0 14-12 26-26 26H343c-14 0-26-12-26-26v-26c0-14 12-26 26-26h313c14 0 26 12 26 26v26zm0-157c0 14-12 26-26 26H343c-14 0-26-12-26-26v-26c0-14 12-26 26-26h313c14 0 26 12 26 26v26zm0-156c0 14-12 26-26 26H343c-14 0-26-12-26-26v-27c0-14 12-26 26-26h313c14 0 26 12 26 26v27z" />
    </svg>
  );
}
export default SvgTimesheet;
