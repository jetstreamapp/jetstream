import * as React from 'react';
function SvgQuipSheet(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M319 388H219c-10 0-19 9-19 19v319c0 28 22 50 50 50h69c10 0 19-9 19-19V407c0-11-9-19-19-19zm462 0H406c-10 0-19 9-19 19v350c0 10 9 19 19 19h344c28 0 50-22 50-50V406c0-10-9-18-19-18zm-31-163H250c-28 0-50 22-50 50v44c0 10 9 19 19 19h562c10 0 19-9 19-19v-44c0-27-22-50-50-50z" />
    </svg>
  );
}
export default SvgQuipSheet;
