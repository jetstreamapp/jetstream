import * as React from 'react';
function SvgPost(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M492 217c-166 0-300 125-300 280 0 50 14 96 38 137 3 5 4 11 2 16l-28 89c-5 16 10 30 26 25l88-31c6-2 12-1 17 2 46 27 100 42 158 42 166 0 300-125 300-280-2-155-136-280-301-280z" />
    </svg>
  );
}
export default SvgPost;
