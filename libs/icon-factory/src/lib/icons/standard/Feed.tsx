import * as React from 'react';
function SvgFeed(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M401 290c14 2 27 10 30 26l68 270 89-194c6-13 18-20 31-20l2 1h2c11 2 21 9 26 19l1 2v1l46 105h79c14 0 25 12 25 25v17c0 13-11 25-25 25h-99c-13 0-25-8-31-20l-25-58-97 213v1c-7 10-18 17-32 17-5 0-11-2-17-4-4-3-8-6-11-11-3-4-6-8-6-13l-66-266-52 119c-5 13-17 20-30 20h-83c-13 0-25-9-25-23v-18c0-14 11-25 25-25h59l83-189c6-12 19-21 34-20z" />
    </svg>
  );
}
export default SvgFeed;
