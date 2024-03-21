import * as React from 'react';
function SvgPricebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M71.7 20H34.1c-3.3 0-6.1 2.8-6.1 5.8V28h-2c-2.2 0-4 1.8-4 4s1.8 4 4 4h2v10h-2c-2.2 0-4 1.8-4 4s1.8 4 4 4h2v10h-2c-2.2 0-4 1.8-4 4s1.8 4 4 4h2v1.8c0 3 2.8 6.2 6.1 6.2h37.6c3.3 0 6.3-3.3 6.3-6.6v-48c0-3.3-3-5.4-6.3-5.4zM43 61c0 .6-.4 1-1 1h-4c-.6 0-1-.4-1-1V39c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v22zm8 0c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V39c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v22zm10 0c0 .6-.4 1-1 1h-4c-.6 0-1-.4-1-1V39c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v22zm8 0c0 .6-.4 1-1 1h-2c-.6 0-1-.4-1-1V39c0-.6.4-1 1-1h2c.6 0 1 .4 1 1v22z"
      />
    </svg>
  );
}
export default SvgPricebook;
