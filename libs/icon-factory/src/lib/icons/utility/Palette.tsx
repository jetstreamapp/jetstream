import * as React from 'react';
function SvgPalette(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="unset" aria-hidden="true" {...props}>
      <path d="M49.5 17.3C47.2 7.8 37.2 2 26.2 2a1 1 0 000 48.1c18.6 0 17.1-9.4 11.2-13.1-3.5-2.2-5.4-7.3-1.9-10.9 6.5-6.7 17 4 14-8.7zM13 34c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm1-19c0-2.8 2.2-5 5-5s5 2.2 5 5-2.2 5-5 5-5-2.2-5-5zm11 29c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5zm9-26c-2.8 0-5-2.2-5-5s2.2-5 5-5 5 2.2 5 5-2.2 5-5 5z" />
    </svg>
  );
}
export default SvgPalette;
