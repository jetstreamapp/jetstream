import * as React from 'react';
function SvgLock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 520" fill="unset" aria-hidden="true" {...props}>
      <path d="M110 190h40c6 0 10-3 10-9v-1A100 100 0 01267 80c53 4 93 50 93 104v-3c0 6 4 9 10 9h40c6 0 10-3 10-9v-1A160 160 0 00252 20c-85 4-150 76-152 161 1 5 5 9 10 9zm-10-9v4zm360 89a40 40 0 00-40-40H100a40 40 0 00-40 40v190a40 40 0 0040 40h320a40 40 0 0040-40zM306 427c2 6-3 13-10 13h-73c-7 0-11-6-10-13l18-60a48 48 0 01-21-48 50 50 0 0139-38c32-6 60 17 60 47 0 16-8 31-21 39z" />
    </svg>
  );
}
export default SvgLock;
