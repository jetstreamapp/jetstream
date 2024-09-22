import * as React from 'react';
function SvgTextbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M447 494H73a47 47 0 01-47-47V73c0-26 21-47 47-47h375c26 0 47 21 47 47v375a48 48 0 01-48 46zM89 104v312c0 9 7 16 16 16h312c9 0 16-7 16-16V104c0-9-7-16-16-16H105c-9 0-16 7-16 16zm63 249V167c0-9 7-16 16-16h31c9 0 16 7 16 16v186c0 9-7 16-16 16h-31c-9 0-16-7-16-16z" />
    </svg>
  );
}
export default SvgTextbox;
