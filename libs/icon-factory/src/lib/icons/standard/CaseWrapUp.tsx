import * as React from 'react';
function SvgCaseWrapUp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M372 301h40a9 9 0 0010-10v-30h158v30a9 9 0 0010 10h40a9 9 0 0010-10v-30a60 60 0 00-60-60H422a60 60 0 00-60 60v30a9 9 0 0010 10zm368 60H262a60 60 0 00-60 60v318a60 60 0 0060 60h478a60 60 0 0060-60V421a62 62 0 00-60-60zm-87 161L479 696a34 34 0 01-48 0l-84-84a16 16 0 010-24l24-24a16 16 0 0124 0l60 60 150-150a16 16 0 0124 0l24 24a18 18 0 010 24z" />
    </svg>
  );
}
export default SvgCaseWrapUp;
