import * as React from 'react';
function SvgProfileAlt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M26 2C12.75 2 2 12.75 2 26s10.75 24 24 24 24-10.75 24-24S39.25 2 26 2zm0 9c4.12 0 7.44 3.69 7.44 8.25S30.13 27.5 26 27.5s-7.44-3.69-7.44-8.25S21.87 11 26 11zm15 27c0 1.62-1.38 3-3 3H14c-1.62 0-3-1.38-3-3v-1.38c0-3.62 4.25-5.88 8.25-7.62l.38-.19c.31-.12.62-.12.94.06 1.62 1.06 3.44 1.62 5.38 1.62s3.81-.62 5.38-1.62c.31-.19.62-.19.94-.06l.38.19c4.12 1.75 8.38 3.94 8.38 7.62V38z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgProfileAlt;
