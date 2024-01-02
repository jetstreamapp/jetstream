import * as React from 'react';
function SvgTogglePanelLeft(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path fill="unset" d="M46 8H6c-1.1 0-2 .9-2 2v32c0 1.1.9 2 2 2h40c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-2 32H8V12h36v28z" />
      <path fill="unset" d="M21 38h-9.9c-.6 0-1-.4-1-1V15c0-.6.4-1 1-1H21c.6 0 1 .4 1 1v22c0 .6-.4 1-1 1z" />
    </svg>
  );
}
export default SvgTogglePanelLeft;
