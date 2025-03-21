import * as React from 'react';
function SvgRotate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M485 20h-30c-8 0-15 7-15 15v70c0 9-10 15-16 8a220 220 0 00-295-29c-7 5-8 16-2 23l21 21c5 5 13 6 19 2 12-8 25-15 39-21l20-6a165 165 0 01157 54c12 14 3 23-7 23h-70c-8 0-16 7-16 15v30c0 8 8 15 16 15h182c7 0 12-6 12-13V35c0-8-7-15-15-15zm-91 354c-6-6-15-6-21 0a160 160 0 01-58 37l-20 6a165 165 0 01-157-54c-12-14-3-23 7-23h70c8 0 15-7 15-15v-30c0-8-7-15-15-15H33c-7 0-13 6-13 13v192c0 8 7 15 15 15h30c8 0 15-7 15-15v-70c0-9 10-15 16-8a219 219 0 00318 9c6-6 6-16 0-21l-20-21z" />
    </svg>
  );
}
export default SvgRotate;
