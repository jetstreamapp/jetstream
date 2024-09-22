import * as React from 'react';
function SvgQuote(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M452 21H277c-11-1-21 5-29 13L34 249a50 50 0 000 68l170 170a50 50 0 0068 0l217-218c8-8 13-21 12-32V69a50 50 0 00-49-48zM279 373l-11 11c-6 6-16 6-22 0L137 276c-6-6-6-16 0-22l11-11c6-6 16-6 22 0l109 109c7 5 7 15 0 21zm64-64l-11 11c-6 6-16 6-22 0L201 212c-6-6-6-16 0-22l11-11c6-6 16-6 22 0l109 109c7 5 7 15 0 21zm45-136c-22 0-40-18-40-40s18-40 40-40 40 18 40 40-18 40-40 40z" />
    </svg>
  );
}
export default SvgQuote;
