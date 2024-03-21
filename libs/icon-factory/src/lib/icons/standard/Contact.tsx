import * as React from 'react';
function SvgContact(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M74 29H26c-3.3 0-6 2.7-6 6v29c0 3.3 2.7 6 6 6h48c3.3 0 6-2.7 6-6V35c0-3.3-2.7-6-6-6zM48.6 63H31.4c-1.9 0-3.4-2.1-3.4-4.1.1-3 3.2-4.8 6.5-6.3 2.3-1 2.6-1.9 2.6-2.9s-.6-1.9-1.4-2.6c-1.3-1.2-2.1-3-2.1-5 0-3.8 2.3-7 6.3-7s6.3 3.2 6.3 7c0 2-.7 3.8-2.1 5-.8.7-1.4 1.6-1.4 2.6s.3 1.9 2.6 2.8c3.3 1.4 6.4 3.4 6.5 6.4.2 2-1.3 4.1-3.2 4.1zM72 56c0 1.1-.9 2-2 2h-9c-1.1 0-2-.9-2-2v-3c0-1.1.9-2 2-2h9c1.1 0 2 .9 2 2v3zm0-11c0 1.1-.9 2-2 2H55c-1.1 0-2-.9-2-2v-3c0-1.1.9-2 2-2h15c1.1 0 2 .9 2 2v3z"
      />
    </svg>
  );
}
export default SvgContact;
