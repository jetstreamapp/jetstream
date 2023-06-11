import * as React from 'react';
function SvgProduct(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M22 66h5c1.1 0 2-.9 2-2V33c0-1.1-.9-2-2-2h-5c-1.1 0-2 .9-2 2v31c0 1.1.9 2 2 2zM78 31h-5c-1.1 0-2 .9-2 2v31c0 1.1.9 2 2 2h5c1.1 0 2-.9 2-2V33c0-1.1-.9-2-2-2zM53 66c1.1 0 2-.9 2-2V33c0-1.1-.9-2-2-2h-6c-1.1 0-2 .9-2 2v31c0 1.1.9 2 2 2h6zM65 66c1.1 0 2-.9 2-2V33c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v31c0 1.1.9 2 2 2h2zM39 66c1.1 0 2-.9 2-2V33c0-1.1-.9-2-2-2h-2c-1.1 0-2 .9-2 2v31c0 1.1.9 2 2 2h2zM78 72H22c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h56c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2zM78 20H22c-1.1 0-2 .9-2 2v2c0 1.1.9 2 2 2h56c1.1 0 2-.9 2-2v-2c0-1.1-.9-2-2-2z"
      />
    </svg>
  );
}
export default SvgProduct;
