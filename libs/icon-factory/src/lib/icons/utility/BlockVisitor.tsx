import * as React from 'react';
function SvgBlockVisitor(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M220 370a172 172 0 0123-82c17-30 36-42 51-64a146 146 0 0014-130 100 100 0 00-98-64 100 100 0 00-94 69c-16 45-9 99 27 133 15 14 29 36 21 57s-31 29-48 37c-39 17-86 41-94 87a62 62 0 0059 77h170a10 10 0 008-16 160 160 0 01-39-104zm245-85a120 120 0 100 170 120 120 0 000-170zm-142 28a80 80 0 0198-12L311 411a80 80 0 0112-98zm114 114a84 84 0 01-98 13l110-110a80 80 0 01-12 97z" />
    </svg>
  );
}
export default SvgBlockVisitor;
