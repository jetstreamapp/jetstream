import * as React from 'react';
function SvgContract(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M746 336L614 204c-3-3-6-4-10-4-8 0-14 6-14 14v106c0 22 18 40 40 40h106c8 0 14-6 14-14 0-4-1-7-4-10zm-16 84H590c-33 0-60-27-60-60V220c0-11-9-20-20-20H310c-33 0-60 27-60 60v480c0 33 27 60 60 60h380c33 0 60-27 60-60V440c0-11-9-20-20-20zm-410-94l49-7 3-2 22-45c2-3 6-3 8 0l22 45 3 2 49 7c3 1 5 5 2 7l-36 35-1 4 8 49c1 3-3 6-6 4l-44-23h-4l-44 23c-3 2-7-1-6-4l8-49-1-4-36-35c-1-2 1-6 4-7zm310 334c0 11-9 20-20 20H350c-11 0-20-9-20-20v-20c0-11 9-20 20-20h260c11 0 20 9 20 20zm40-120c0 11-9 20-20 20H350c-11 0-20-9-20-20v-20c0-11 9-20 20-20h300c11 0 20 9 20 20z" />
    </svg>
  );
}
export default SvgContract;
