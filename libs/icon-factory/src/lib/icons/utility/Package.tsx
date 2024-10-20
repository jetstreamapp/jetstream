import * as React from 'react';
function SvgPackage(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M444 240h-79l-33 40h108v60H80v-60h107l-33-40H76c-20 0-36 16-36 36v194a30 30 0 0030 30h380a30 30 0 0030-30V276c0-20-16-36-36-36zM230 35v125h-69c-10 0-15 9-9 14l100 123c4 3 10 3 14 0l100-123c6-6 1-14-9-14h-67V35c0-8-7-15-15-15h-30c-8 0-15 7-15 15z" />
    </svg>
  );
}
export default SvgPackage;
