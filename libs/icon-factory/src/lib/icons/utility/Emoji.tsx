import * as React from 'react';
function SvgEmoji(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M501 260a241 241 0 11-482 0 241 241 0 01482 0zM183 158c-24 0-43 19-43 43s19 43 43 43 43-19 43-43-19-43-43-43zm155 0c-24 0-43 19-43 43s19 43 43 43 43-19 43-43-19-43-43-43zm-2 167c-20 18-47 28-76 28-28 0-54-10-75-27l-9-8c-3-2-5-3-11-3-11 0-19 9-19 19 0 5 2 10 6 14l7 6a152 152 0 00203-1l5-5c4-4 6-9 6-14 0-11-9-19-19-19-5 0-9 2-12 4z" />
    </svg>
  );
}
export default SvgEmoji;
