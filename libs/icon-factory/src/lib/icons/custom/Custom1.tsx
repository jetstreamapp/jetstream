import * as React from 'react';
function SvgCustom1(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M54.3 74.1a5.983 5.983 0 01-8.7 0c-7.2-7.699-21-22.399-21-22.5-6.2-6.5-6.2-17.2 0-23.7 3-3.2 7-4.9 11.3-4.9 4.3 0 8.3 1.7 11.3 4.9l1.2 1.5c.8 1 2.4 1 3.2 0l1-1.3.2-.2c3.101-3.3 7.101-5 11.3-5 4.301 0 8.301 1.7 11.301 4.9 6.199 6.5 6.199 17.2 0 23.7C75.3 51.7 61.6 66.4 54.3 74.1z"
      />
    </svg>
  );
}
export default SvgCustom1;
