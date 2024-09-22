import * as React from 'react';
function SvgPrompt(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M763 231H238c-22 0-38 16-38 38v382c0 21 16 38 38 38h181l45 65c12 17 35 21 52 8l8-7 52-67 187 1c21 0 37-17 37-38V269c0-22-16-38-37-38z" />
    </svg>
  );
}
export default SvgPrompt;
