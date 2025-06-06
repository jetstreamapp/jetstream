import * as React from 'react';
function SvgApex(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M780 675H444c-10 0-19 9-19 19v37c0 10 9 19 19 19h336c10 0 19-9 19-19v-37c0-11-9-19-19-19zM492 448L251 254c-7-6-19-5-25 4l-21 30c-6 9-4 20 4 26l171 137c6 5 6 15 0 20L208 609c-7 6-10 19-4 26l21 32c6 9 17 10 25 4l242-193c10-8 10-23 0-30z" />
    </svg>
  );
}
export default SvgApex;
