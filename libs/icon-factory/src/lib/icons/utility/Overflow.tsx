import * as React from 'react';
function SvgOverflow(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M373 99H158a37 37 0 00-37 37v6c0 3 3 6 6 6h196c21 0 37 17 37 37v221c0 3 3 6 6 6h6c21 0 37-17 37-37V136c1-20-16-37-36-37zm80-79H238a37 37 0 00-37 37v6c0 3 3 6 6 6h196c21 0 37 17 37 37v221c0 3 3 6 6 6h6c21 0 37-17 37-37V57c1-20-16-37-36-37zM326 218c0-20-17-37-37-37H67a37 37 0 00-37 37v245c0 20 17 37 37 37h222c21 0 37-17 37-37V218z" />
    </svg>
  );
}
export default SvgOverflow;
