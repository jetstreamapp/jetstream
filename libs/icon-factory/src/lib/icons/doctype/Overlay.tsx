import * as React from 'react';
function SvgOverlay(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#730394" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#3d0157" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#e5b9fe" />
      <path d="M10 34v14.5h15.14V34H10zm5.51 5.5V54h15.13V39.5H15.51z" fill="unset" />
      <path d="M15.51 39.5h9.63v8.99h-9.63V39.5z" fill="#e5b9fe" />
    </svg>
  );
}
export default SvgOverlay;
