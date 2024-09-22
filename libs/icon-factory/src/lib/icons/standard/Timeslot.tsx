import * as React from 'react';
function SvgTimeslot(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M710 200H292a79 79 0 00-80 78v444a79 79 0 0079 78h419a79 79 0 0078-78V278a77 77 0 00-78-78zM318 330a27 27 0 0126-26h133a27 27 0 0126 26v26a27 27 0 01-26 26H344a27 27 0 01-26-26zm362 340a27 27 0 01-26 26H522a27 27 0 01-26-26v-26a27 27 0 0126-26h133a26 26 0 0125 26zm5-124a28 28 0 01-27 26H344a27 27 0 01-26-26v-91a27 27 0 0126-26h315a27 27 0 0126 26z" />
    </svg>
  );
}
export default SvgTimeslot;
