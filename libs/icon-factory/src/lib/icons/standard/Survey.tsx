import * as React from 'react';
function SvgSurvey(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M240 230h440c22 0 40 18 40 40v40c0 22-18 40-40 40H240c-22 0-40-18-40-40v-40c0-22 18-40 40-40zm0 180h250c22 0 40 18 40 40v40c0 22-18 40-40 40H240c-22 0-40-18-40-40v-40c0-22 18-40 40-40zm419 110c77 0 140 63 140 140s-63 140-140 140-140-63-140-140 63-140 140-140zm79 109c3-3 3-10 0-13l-14-13c-4-4-10-4-14 0l-75 84-34-34c-4-4-10-4-14 0l-14 13c-4 3-4 9 0 13l48 47c4 4 9 6 14 6 6 0 10-2 14-6zm-498-39h232a198 198 0 00-6 120H240c-22 0-40-18-40-40v-40c0-22 18-40 40-40z" />
    </svg>
  );
}
export default SvgSurvey;
