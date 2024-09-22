import * as React from 'react';
function SvgCall(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M485 378l-61-49a39 39 0 00-48-1l-52 38c-6 5-15 4-21-2l-78-70-70-78c-6-6-6-14-2-21l38-52c11-14 10-34-1-48l-49-61a40 40 0 00-59-3L32 83c-8 8-12 20-12 31 5 102 51 199 119 267s165 114 267 119c11 1 22-4 30-12l52-52c17-16 16-44-3-58z" />
    </svg>
  );
}
export default SvgCall;
