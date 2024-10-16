import * as React from 'react';
function SvgIndicatorAssignment(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M390 320h220c11 0 20-9 20-20v-40c0-33-27-60-60-60H430c-33 0-60 27-60 60v40c0 11 9 20 20 20zm108 164v114h107c2-29-10-58-31-78-37-38-76-36-76-36z" />
      <path d="M720 250h-20c-5 0-10 4-10 9v41c0 44-36 80-80 80H390c-44 0-80-36-80-80v-40c0-5-4-10-9-10h-21c-33 0-60 27-60 60v430c0 33 27 60 60 60h440c33 0 60-27 60-60V310c0-33-27-60-60-60zm-71 343a149 149 0 11-298-2 149 149 0 01298 2z" />
    </svg>
  );
}
export default SvgIndicatorAssignment;
