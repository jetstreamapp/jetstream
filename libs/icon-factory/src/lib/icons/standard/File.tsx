import * as React from 'react';
function SvgFile(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M290 630V310c-33 0-60 27-60 60v380c0 33 27 60 60 60h300c33 0 60-27 60-60H410c-66 0-120 0-120-120zm460-260H650c-33 0-60-27-60-60V210c0-11-9-20-20-20H410c-33 0-60 27-60 60v380c0 33 27 60 60 60h300c33 0 60-27 60-60V390c0-11-9-20-20-20zm16-84l-92-92c-3-3-6-4-10-4-8 0-14 6-14 14v66c0 22 18 40 40 40h66c8 0 14-6 14-14 0-4-1-7-4-10z" />
    </svg>
  );
}
export default SvgFile;
