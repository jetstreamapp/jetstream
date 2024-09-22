import * as React from 'react';
function SvgForm(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <path d="M63 36h11a1 1 0 001-1 1 1 0 000-1L61 20a1 1 0 00-1 0 1 1 0 00-1 1v11a4 4 0 004 4zm10 6H59a6 6 0 01-6-6V22a2 2 0 00-2-2H31a6 6 0 00-6 6v48a6 6 0 006 6h38a6 6 0 006-6V44a2 2 0 00-2-2zm-40-2a2 2 0 012-2h8a2 2 0 012 2v2a2 2 0 01-2 2h-8a2 2 0 01-2-2zm30 26a2 2 0 01-2 2H35a2 2 0 01-2-2v-2a2 2 0 012-2h26a2 2 0 012 2zm4-12a2 2 0 01-2 2H35a2 2 0 01-2-2v-2a2 2 0 012-2h30a2 2 0 012 2z" />
    </svg>
  );
}
export default SvgForm;
