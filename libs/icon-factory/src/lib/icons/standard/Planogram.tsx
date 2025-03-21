import * as React from 'react';
function SvgPlanogram(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M774 715h-33V536c0-9-8-17-17-17H537c-9 0-17 8-17 17v178h-50V536c0-9-8-17-17-17H266c-9 0-17 8-17 17v178h-33c-11 0-20 9-20 20v40c0 11 9 20 20 20h557c11 0 20-9 20-20v-40c1-11-8-19-19-19zM565 565h130v45H565zm-271 0h130v45H294zm480-175h-33V211c0-9-8-17-17-17H537c-9 0-17 8-17 17v179h-50V211c0-9-8-17-17-17H266c-9 0-17 8-17 17v179h-33c-11 0-20 10-20 20v40c0 11 9 20 20 20h557c11 0 20-9 20-20v-40c1-12-8-20-19-20zM565 240h130v45H565zm-271 0h130v45H294z" />
    </svg>
  );
}
export default SvgPlanogram;
