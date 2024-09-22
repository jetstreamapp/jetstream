import * as React from 'react';
function SvgAttach(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M395 634a18.7 18.7 0 0026 0l125-125a26.1 26.1 0 0135 0 26.6 26.6 0 011 37l-1 1-154 151a88.1 88.1 0 01-124 0l-1-1a88.1 88.1 0 010-124l272-272a88.1 88.1 0 01124 0l1 1a88.1 88.1 0 010 124l-1 1a18.2 18.2 0 00-3 22 213.8 213.8 0 0118 44 12.2 12.2 0 0015 9l6-3c10-10 19-20 19-20a163 163 0 000-231h-3a163 163 0 00-231 0L248 518a163 163 0 000 231l3 3a161.5 161.5 0 00229 1l1-1 154-154a101.8 101.8 0 10-142-146l-4 4-123 124a21.3 21.3 0 000 28z" />
    </svg>
  );
}
export default SvgAttach;
