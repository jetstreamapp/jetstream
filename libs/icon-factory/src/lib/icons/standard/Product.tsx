import * as React from 'react';
function SvgProduct(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M220 660h50c11 0 20-9 20-20V330c0-11-9-20-20-20h-50c-11 0-20 9-20 20v310c0 11 9 20 20 20zm560-350h-50c-11 0-20 9-20 20v310c0 11 9 20 20 20h50c11 0 20-9 20-20V330c0-11-9-20-20-20zM530 660c11 0 20-9 20-20V330c0-11-9-20-20-20h-60c-11 0-20 9-20 20v310c0 11 9 20 20 20zm120 0c11 0 20-9 20-20V330c0-11-9-20-20-20h-20c-11 0-20 9-20 20v310c0 11 9 20 20 20zm-260 0c11 0 20-9 20-20V330c0-11-9-20-20-20h-20c-11 0-20 9-20 20v310c0 11 9 20 20 20zm390 60H220c-11 0-20 9-20 20v20c0 11 9 20 20 20h560c11 0 20-9 20-20v-20c0-11-9-20-20-20zm0-520H220c-11 0-20 9-20 20v20c0 11 9 20 20 20h560c11 0 20-9 20-20v-20c0-11-9-20-20-20z" />
    </svg>
  );
}
export default SvgProduct;
