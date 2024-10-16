import * as React from 'react';
function SvgDisplayRichText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M220 718h560c11 0 20 9 20 20v40c0 11-9 20-20 20H220c-11 0-20-9-20-20v-40c0-11 9-20 20-20zm0-180h560c11 0 20 9 20 20v40c0 11-9 20-20 20H220c-11 0-20-9-20-20v-40c0-11 9-20 20-20zm356-180h204c11 0 20 9 20 20v40c0 11-9 20-20 20H576c-11 0-20-9-20-20v-40c0-11 9-20 20-20zm-100 86l-95-234c-2-4-6-7-11-7h-72c-4 0-9 3-10 7l-88 234c-1 4 1 10 7 10h46c4 0 9-4 10-8l18-50h111l20 50c1 4 6 8 10 8h46c6 0 9-5 8-10zM302 336l29-74h6l32 74h-67z" />
    </svg>
  );
}
export default SvgDisplayRichText;
