import * as React from 'react';
function SvgAudio(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#0d9dda" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#05628a" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#90d0fe" />
      <path
        d="M30.01 34l-14.39 1.84v13.65c-.75-.21-1.66-.24-2.57-.07-2.04.41-3.37 1.74-2.99 2.96.4 1.24 2.37 1.91 4.41 1.5 1.79-.36 3.04-1.41 3.05-2.51V40.46l10.59-1.31v8.44c-.76-.21-1.69-.25-2.62-.07-2.06.41-3.4 1.75-3.01 3 .39 1.25 2.39 1.92 4.44 1.52 1.88-.38 3.17-1.52 3.09-2.67V34z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgAudio;
