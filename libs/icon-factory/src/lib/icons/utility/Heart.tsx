import * as React from 'react';
function SvgHeart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M29.43 45.13c-1.92 2-5.03 2-6.95 0-5.75-6.15-16.77-17.89-16.77-17.97-4.95-5.19-4.95-13.73 0-18.92 2.4-2.56 5.59-3.91 9.02-3.91s6.63 1.36 9.02 3.91l.96 1.2c.64.8 1.92.8 2.56 0l.8-1.04.16-.16c2.48-2.64 5.67-3.99 9.02-3.99s6.63 1.36 9.03 3.91c4.95 5.19 4.95 13.74 0 18.93-.08.16-11.02 11.9-16.85 18.05z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgHeart;
