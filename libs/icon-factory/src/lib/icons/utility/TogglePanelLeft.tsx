import * as React from 'react';
function SvgTogglePanelLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" fill="unset" aria-hidden="true" {...props}>
      <path d="M46 8H6a2 2 0 00-2 2v32c0 1.1.9 2 2 2h40a2 2 0 002-2V10a2 2 0 00-2-2zm-2 32H8V12h36v28z" />
      <path d="M21 38h-9.9c-.6 0-1-.4-1-1V15c0-.6.4-1 1-1H21c.6 0 1 .4 1 1v22c0 .6-.4 1-1 1z" />
    </svg>
  );
}
export default SvgTogglePanelLeft;
