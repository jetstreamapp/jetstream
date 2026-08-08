import * as React from 'react';
function SvgProductRequired(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path
        fillRule="evenodd"
        d="M338 763h-40a20 20 0 01-20-20v-40a20 20 0 0120-20h40a20 20 0 0120 20v40a19 19 0 01-20 20m0-179h-40a20 20 0 01-20-20v-40a20 20 0 0120-20h40a20 20 0 0120 20v40a19 19 0 01-20 20m138-321l-22-21a14 14 0 00-21 0L301 373l-54-52a14 14 0 00-21 0l-21 21a14 14 0 000 21l73 74a30 30 0 0043 0l155-152a17 17 0 000-22"
      />
      <rect width={361} height={80} x={439} y={683} rx={20} />
      <rect width={361} height={80} x={439} y={504} rx={20} />
      <rect width={301} height={80} x={499} y={326} rx={20} />
    </svg>
  );
}
export default SvgProductRequired;
