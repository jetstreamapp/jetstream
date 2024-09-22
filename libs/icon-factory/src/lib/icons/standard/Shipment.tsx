import * as React from 'react';
function SvgShipment(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M530 536v244c0 6 4 10 10 10l5-1 194-110c19-11 31-31 31-53V407c0-6-4-10-10-10l-5 1-215 121c-6 3-10 10-10 17zm-20-68l216-121c5-3 6-9 3-14l-3-3-195-111a62 62 0 00-62 0L274 330c-5 3-6 9-3 14l3 3 216 121c6 3 14 3 20 0zm-50 51L245 398c-5-3-11-1-14 4l-1 5v218c0 22 12 42 31 53l194 110c5 3 11 1 14-4l1-5V536c0-7-4-14-10-17z" />
    </svg>
  );
}
export default SvgShipment;
