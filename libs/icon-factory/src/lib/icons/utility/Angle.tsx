import * as React from 'react';
function SvgAngle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52" aria-hidden="true" {...props}>
      <path
        d="M47.42 35.24L6.92 49.79c-2.7.97-5.33-1.61-4.41-4.33L16.46 4.32c.72-2.13 3.27-3 5.12-1.72 11.99 8.3 19 15.21 27.5 27.55 1.26 1.83.42 4.34-1.67 5.09z"
        fill="unset"
      />
      <path
        d="M21.59 2.6c-1.85-1.28-4.4-.41-5.12 1.72L2.51 45.46c-.92 2.72 1.71 5.3 4.41 4.33l40.51-14.55c2.09-.75 2.93-3.26 1.67-5.09C40.6 17.81 33.59 10.91 21.6 2.6z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgAngle;
