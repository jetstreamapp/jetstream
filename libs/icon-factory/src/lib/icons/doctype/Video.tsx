import * as React from 'react';
function SvgVideo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" aria-hidden="true" {...props}>
      <path d="M37 0l19 20v38c0 3.31-2.69 6-6 6H6c-3.31 0-6-2.69-6-6V6c0-3.31 2.69-6 6-6h31z" fill="#730394" />
      <path d="M37 0l19 20v1H44c-3.87 0-7-3.13-7-7V0z" fill="#3d0157" />
      <path d="M43 20h13L37 0v14c0 3.31 2.69 6 6 6z" fill="#e5b9fe" />
      <path
        d="M24.53 45.53c0 .37-.16.74-.45.98-.2.16-5.25 4.42-11.84 7.1-.19.08-.4.11-.6.1-.21-.01-.41-.08-.59-.18-.34-.21-.59-.58-.61-.99-.4-4.66-.4-9.35 0-14.01.02-.4.27-.77.62-1 .18-.11.38-.17.58-.18.21-.01.41.02.6.1 4.27 1.79 8.26 4.19 11.84 7.12.29.22.45.59.45.96z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgVideo;
