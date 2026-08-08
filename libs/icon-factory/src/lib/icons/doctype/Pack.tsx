import * as React from 'react';
function SvgPack(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#0b5cab" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#032d60" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#aacbff" />
      <path
        d="M29 40.94v11.88c0 .66-.53 1.19-1.19 1.19H11.19c-.66 0-1.19-.53-1.19-1.19V40.94c0-.13.02-.26.07-.37l1.58-4.75c.15-.49.61-.82 1.12-.82h13.46c.51 0 .97.33 1.12.82l1.58 4.75c.05.11.07.24.07.37zm-2.44 0l-1.19-3.56H13.62l-1.19 3.56h14.12z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgPack;
