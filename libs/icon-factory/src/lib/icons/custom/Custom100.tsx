import * as React from 'react';
function SvgCustom100(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M61.9 72H38.1c-.7 0-1.1.6-1 1.3 1 3.8 6.4 6.7 12.8 6.7 6.5 0 11.9-2.9 12.8-6.7.3-.7-.2-1.3-.8-1.3zM74 26H26c-3.3 0-6 2.7-6 6v28c0 3.3 2.7 6 6 6h48c3.3 0 6-2.7 6-6V32c0-3.3-2.7-6-6-6zm0 32a2 2 0 01-2 2H28a2 2 0 01-2-2V34c0-1.1.9-2 2-2h44a2 2 0 012 2v24z" />
    </svg>
  );
}
export default SvgCustom100;
