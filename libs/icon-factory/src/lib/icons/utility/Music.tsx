import * as React from 'react';
function SvgMusic(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M49.99 2L15.48 6.41v32.75c-1.8-.51-3.97-.58-6.16-.17-4.9.97-8.09 4.17-7.16 7.12.95 2.97 5.67 4.58 10.57 3.61 4.29-.85 7.28-3.39 7.31-6.02V17.53l25.4-3.14v20.25c-1.83-.51-4.04-.61-6.28-.17-4.94.97-8.16 4.19-7.21 7.19.93 3 5.72 4.61 10.64 3.66 4.51-.9 7.6-3.66 7.4-6.41V2z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgMusic;
