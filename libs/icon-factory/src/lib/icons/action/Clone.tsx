import * as React from 'react';
function SvgClone(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M460 20H180c-22 0-40 18-40 40v25c0 8 7 15 15 15h185c44 0 80 36 80 80v185c0 8 7 15 15 15h25c22 0 40-18 40-40V60c0-22-18-40-40-40zM340 140H60c-22 0-40 18-40 40v280c0 22 18 40 40 40h280c22 0 40-18 40-40V180c0-22-18-40-40-40zm-40 270c0 6-4 10-10 10H110c-6 0-10-4-10-10v-20c0-6 4-10 10-10h180c6 0 10 4 10 10zm0-80c0 6-4 10-10 10H110c-6 0-10-4-10-10v-20c0-6 4-10 10-10h180c6 0 10 4 10 10zm0-80c0 6-4 10-10 10H110c-6 0-10-4-10-10v-20c0-6 4-10 10-10h180c6 0 10 4 10 10z" />
    </svg>
  );
}
export default SvgClone;
