import * as React from 'react';
function SvgWebcart(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M424 500h295c9 0 17-6 19-15l54-190c4-13-6-25-19-25H317l-8-28c-4-13-16-22-29-22h-48c-16 0-31 12-32 28-1 17 13 32 30 32h28l94 318c4 13 15 22 29 22h348c16 0 31-12 32-28 1-17-13-32-30-32H425c-13 0-25-9-28-21v-1c-7-19 8-38 27-38z" />
      <circle cx={430} cy={730} r={50} />
      <circle cx={670} cy={730} r={50} />
    </svg>
  );
}
export default SvgWebcart;
