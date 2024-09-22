import * as React from 'react';
function SvgCall(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M485 379l-61-49a40 40 0 00-48-1l-52 38c-6 5-15 4-21-2l-78-70-70-78c-6-6-6-14-2-21l38-52a40 40 0 00-1-48l-49-61a40 40 0 00-59-3L30 84c-8 8-12 19-12 30 5 102 51 199 119 267s165 114 267 119c11 1 22-4 30-12l52-52a36 36 0 00-1-57z" />
    </svg>
  );
}
export default SvgCall;
