import * as React from 'react';
function SvgMerge(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M705 725c-70-34-120-94-145-163-10-26-16-53-19-79v-44h136c11 0 17-12 10-22L510 205c-6-8-20-8-25 0L312 417c-6 8 0 22 10 22h137v44c-3 27-10 55-19 79-26 68-75 129-145 163-10 4-14 16-10 26l16 38c5 11 16 14 27 8 76-36 135-94 172-162 37 69 96 126 173 162 11 5 22 4 27-8l16-38c4-10-1-22-11-26z" />
    </svg>
  );
}
export default SvgMerge;
