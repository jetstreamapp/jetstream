import * as React from 'react';
function SvgProcess(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <g fill="unset">
        <path d="M37.6 46.3l10.8-13.4c.8-1 2.3-1 3.1 0l10.8 13.4c.4.5 1 .7 1.6.7H76c1.1 0 2-.9 2-2V28c0-3.3-2.7-6-6-6H28c-3.3 0-6 2.7-6 6v17c0 1.1.9 2 2 2h12c.6 0 1.2-.3 1.6-.7zM62.3 53.7L51.5 67.1c-.8 1-2.3 1-3.1 0L37.6 53.7c-.4-.5-1-.7-1.6-.7H24c-1.1 0-2 .9-2 2v17c0 3.3 2.7 6 6 6h44c3.3 0 6-2.7 6-6V55c0-1.1-.9-2-2-2H63.9c-.6 0-1.2.3-1.6.7z" />
      </g>
    </svg>
  );
}
export default SvgProcess;
