import * as React from 'react';
function SvgFilter(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M77 20H21c-1.9 0-2.8 2.1-1.6 3.5l24.2 28.6c.8.9 1.1 2.1 1.1 3.3v22.7c0 1 1 1.9 2 1.9h4.4c1 0 1.8-.9 1.8-1.9V55.5c0-1.3.5-2.4 1.4-3.3l24.3-28.6c1.2-1.4.3-3.6-1.6-3.6z"
      />
    </svg>
  );
}
export default SvgFilter;
