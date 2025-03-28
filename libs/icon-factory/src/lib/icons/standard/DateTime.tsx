import * as React from 'react';
function SvgDateTime(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M720 260h-50v-20c0-22-18-40-40-40s-40 18-40 40v20H410v-20c0-22-18-40-40-40s-40 18-40 40v20h-50c-33 0-60 27-60 60v20c0 11 9 20 20 20h520c11 0 20-9 20-20v-20c0-33-27-60-60-60zm40 160H240c-11 0-20 9-20 20v300c0 33 27 60 60 60h440c33 0 60-27 60-60V440c0-11-9-20-20-20zM500 759a149 149 0 010-298 149 149 0 010 298zm15-155v-64c0-5-4-10-10-10h-10c-5 0-10 4-10 10v70c0 4 1 8 4 10l48 48c4 4 10 4 14 0l7-7c4-4 4-10 0-14z" />
    </svg>
  );
}
export default SvgDateTime;
