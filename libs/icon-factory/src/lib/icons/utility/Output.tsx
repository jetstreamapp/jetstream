import * as React from 'react';
function SvgOutput(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M460 240H344s-13 0-13 13v14c0 3 0 5 2 8s6 5 11 5h96v60H80v-60h96c4 0 9-1 11-5 2-3 2-5 2-8v-14c0-13-13-13-13-13H61c-12 0-21 9-21 21v-1 223c0 9 8 17 17 17h406c9 0 17-8 17-17V260c0-11-9-20-21-20zm-296-81h67v125a15 15 0 0015 15h30a15 15 0 0015-15V159h69c10 0 15-9 9-14L269 22c-4-3-10-3-14 0L155 145c-6 6-1 14 9 14" />
    </svg>
  );
}
export default SvgOutput;
