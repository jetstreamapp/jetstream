import * as React from 'react';
function SvgMetrics(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M720 220H280c-33 0-60 27-60 60v440c0 33 27 60 60 60h440c33 0 60-27 60-60V280c0-33-27-60-60-60zM380 660c0 11-9 20-20 20h-20c-11 0-20-9-20-20V550c0-11 9-20 20-20h20c11 0 20 9 20 20zm100 0c0 11-9 20-20 20h-20c-11 0-20-9-20-20V400c0-11 9-20 20-20h20c11 0 20 9 20 20zm100 0c0 11-9 20-20 20h-20c-11 0-20-9-20-20V340c0-11 9-20 20-20h20c11 0 20 9 20 20zm100 0c0 11-9 20-20 20h-20c-11 0-20-9-20-20V470c0-11 9-20 20-20h20c11 0 20 9 20 20z" />
    </svg>
  );
}
export default SvgMetrics;
