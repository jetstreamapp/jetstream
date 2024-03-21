import * as React from 'react';
function SvgVideo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" {...props}>
      <path
        d="M77.57 33.37l-14.11 10.2v-7.24A3.44 3.44 0 0060 32.86H23.46A3.44 3.44 0 0020 36.3v27.37a3.44 3.44 0 003.41 3.47h36.71a3.44 3.44 0 003.47-3.43v-7.1l14 10a1.42 1.42 0 002 0 1.39 1.39 0 00.41-1V34.4a1.42 1.42 0 00-2.43-1.07"
        fill="unset"
      />
    </svg>
  );
}
export default SvgVideo;
