import * as React from 'react';
function SvgOpenFolder(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M46 14H23.3c-1.4 0-2.7-.8-3.5-2l-3.5-6c-.7-1.2-2-2-3.5-2H6C3.8 4 2 5.8 2 8v36c0 2.2 1.8 4 4 4h40c2.2 0 4-1.8 4-4V18c0-2.2-1.8-4-4-4z" />
        <path d="M46 6H21.9c-.4 0-.6.4-.4.7l1.6 2.7c.2.4.5.6.9.6h22c1.1 0 2.2.2 3.1.6.4.2.9-.1.9-.6 0-2.2-1.8-4-4-4z" />
      </g>
    </svg>
  );
}
export default SvgOpenFolder;
