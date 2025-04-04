import * as React from 'react';
function SvgPage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M444 190H332c-26 0-42-16-42-42V36c0-9-7-16-16-16H108a49 49 0 00-48 48v384c0 26 22 48 48 48h304c26 0 48-22 48-48V206c0-9-7-16-16-16zm13-61L351 23c-2-2-6-3-9-3-6 0-12 5-12 11v85c0 18 16 34 34 34h85c6 0 11-6 11-12 0-3-1-7-3-9z" />
    </svg>
  );
}
export default SvgPage;
