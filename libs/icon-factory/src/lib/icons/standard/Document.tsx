import * as React from 'react';
function SvgDocument(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M730 420H590c-33 0-60-27-60-60V220c0-11-9-20-20-20H310c-33 0-60 27-60 60v480c0 33 27 60 60 60h380c33 0 60-27 60-60V440c0-11-9-20-20-20zm16-84L614 204c-3-3-6-4-10-4-8 0-14 6-14 14v106c0 22 18 40 40 40h106c8 0 14-6 14-14 0-4-1-7-4-10z" />
    </svg>
  );
}
export default SvgDocument;
