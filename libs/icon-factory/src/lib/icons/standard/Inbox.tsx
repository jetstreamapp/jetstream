import * as React from 'react';
function SvgInbox(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M80 27.5a5 5 0 00-5-5H25a5 5 0 00-5 5v45a5 5 0 005 5h50a5 5 0 005-5zM41.2 61.3c0 .7-.5 1.2-1.2 1.2H28.7c-.7 0-1.2-.5-1.2-1.3v-5c0-.7.5-1.2 1.3-1.2H40c.8 0 1.3.5 1.3 1.3zm0-12.5c0 .7-.5 1.2-1.2 1.2H28.7c-.7 0-1.2-.5-1.2-1.3v-5c0-.7.5-1.2 1.3-1.2H40c.8 0 1.3.5 1.3 1.3zm0-12.5c0 .7-.5 1.2-1.2 1.2H28.7c-.7 0-1.2-.5-1.2-1.3v-5c0-.7.5-1.2 1.3-1.2H40c.8 0 1.3.5 1.3 1.3zm31.3 32.5c0 .7-.5 1.2-1.3 1.2H47.5c-.8 0-1.3-.5-1.3-1.3V31.3c0-.7.5-1.2 1.3-1.2h23.8c.7 0 1.2.5 1.2 1.3z" />
    </svg>
  );
}
export default SvgInbox;
