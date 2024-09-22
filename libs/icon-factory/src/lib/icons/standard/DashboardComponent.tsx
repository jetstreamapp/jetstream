import * as React from 'react';
function SvgDashboardComponent(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M437 200H239a40 40 0 00-39 39v198a40 40 0 0039 39h198a40 40 0 0039-39V239a40 40 0 00-39-39zm324 0H563a40 40 0 00-39 39v198a40 40 0 0039 39h198a40 40 0 0039-39V239a40 40 0 00-39-39zM437 524H239a40 40 0 00-39 39v198a40 40 0 0039 39h198a40 40 0 0039-39V563a40 40 0 00-39-39zm324 0H563a40 40 0 00-39 39v198a40 40 0 0039 39h198a40 40 0 0039-39V563a40 40 0 00-39-39z" />
    </svg>
  );
}
export default SvgDashboardComponent;
