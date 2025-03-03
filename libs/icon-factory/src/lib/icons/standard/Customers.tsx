import * as React from 'react';
function SvgCustomers(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="unset" aria-hidden="true" {...props}>
      <ellipse cx={41.3} cy={42.3} rx={12.2} ry={13.5} />
      <path d="M52.6 57.4a16.2 16.2 0 01-22.6-.1C24.5 59.8 19 63 19 68v2.1c0 2.5 2 4.5 4.5 4.5h35.7c2.5 0 4.5-2 4.5-4.5V68c-.1-5-5.5-8.1-11.1-10.6zm15.4-10l-.5-.3c-.4-.2-.9-.2-1.3.1a13.8 13.8 0 01-7.2 2.1h-1c-.5 1.3-1 2.6-1.7 3.7l1.4.6c5.7 2.5 9.7 5.6 12.5 9.8H75a4 4 0 004-4v-1.9c0-4.9-5.7-7.9-11-10.1zm-1.1-13.2c0-4.9-3.6-8.9-7.9-8.9-2.2 0-4.1 1-5.6 2.5 3.5 3.6 5.7 8.7 5.7 14.4v.8c4.3 0 7.8-3.9 7.8-8.8z" />
    </svg>
  );
}
export default SvgCustomers;
