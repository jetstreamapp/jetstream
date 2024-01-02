import * as React from 'react';
function SvgDashboardComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M43.66 20H23.94A4 4 0 0020 23.94v19.72a4 4 0 003.94 3.94h19.72a4 4 0 003.94-3.94V23.94A4 4 0 0043.66 20zM76.06 20H56.34a4 4 0 00-3.94 3.94v19.72a4 4 0 003.94 3.94h19.72A4 4 0 0080 43.66V23.94A4 4 0 0076.06 20zM43.66 52.4H23.94A4 4 0 0020 56.34v19.72A4 4 0 0023.94 80h19.72a4 4 0 003.94-3.94V56.34a4 4 0 00-3.94-3.94zM76.06 52.4H56.34a4 4 0 00-3.94 3.94v19.72A4 4 0 0056.34 80h19.72A4 4 0 0080 76.06V56.34a4 4 0 00-3.94-3.94z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgDashboardComponent;
