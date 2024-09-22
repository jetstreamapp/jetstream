import * as React from 'react';
function SvgAlert(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M347 310l-4 1a30 30 0 01-37-17l-33-88a131 131 0 00-174-75 133 133 0 00-70 169l31 85c5 15-3 31-17 36l-4 1c-17 6-25 26-19 43l4 11c2 5 9 9 15 6l344-127c6-2 9-10 7-16l-4-11c-3-16-22-25-39-18zm-84 126l-75 28c-5 2-7 8-4 12a50 50 0 0059 20 50 50 0 0032-53c-2-5-8-8-12-7zm229-150c17-57 8-118-23-168a210 210 0 00-140-97c-5-1-9 2-9 6l-5 28c-1 4 2 7 6 8a170 170 0 01129 210c-1 4 1 8 5 9l27 9c5 0 9-1 10-5zM382 170a108 108 0 00-72-49c-4-1-8 2-9 6l-3 29c0 4 2 7 6 8 17 4 32 14 41 29a60 60 0 017 49c-1 3 1 7 4 8l27 11c4 2 8-1 10-5 9-29 5-60-11-86z" />
    </svg>
  );
}
export default SvgAlert;
