import * as React from 'react';
function SvgCustom42(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M74 22H26a6 6 0 00-6 6v6c0 1.1.9 2 2 2h56a2 2 0 002-2v-6a6 6 0 00-6-6zm0 20H26a2 2 0 00-2 2v28a6 6 0 006 6h40a6 6 0 006-6V44a2 2 0 00-2-2zm-13 9a3 3 0 01-3 3H42a3 3 0 110-6h16a3 3 0 013 3z" />
    </svg>
  );
}
export default SvgCustom42;
