import * as React from 'react';
function SvgEmployeeAsset(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M748 203H252a50 50 0 00-50 50v343a50 50 0 0050 50h495a50 50 0 0050-50V252a49 49 0 00-49-49zm-25 349a20 20 0 01-19 19H296a19 19 0 01-19-19V296a20 20 0 0119-19h407a20 20 0 0120 19zM413 723a50 50 0 00-50 50v6a20 20 0 0019 19h235a20 20 0 0019-19v-6a50 50 0 00-50-50zm89-279h-4a88 88 0 00-87 75c0 4 1 12 15 12h149c14 0 15-9 15-12a90 90 0 00-88-75z" />
      <circle cx={501} cy={376} r={58} />
    </svg>
  );
}
export default SvgEmployeeAsset;
