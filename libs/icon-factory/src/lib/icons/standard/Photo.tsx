import * as React from 'react';
function SvgPhoto(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        fill="unset"
        d="M36 31h28c.8 0 1.3-.9.8-1.5l-3.3-5.1c-1-2-3.1-3.3-5.4-3.3H43.9c-2.3 0-4.4 1.3-5.4 3.3l-3.3 5.1c-.5.6 0 1.5.8 1.5zM50 49c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8-3.6-8-8-8z"
      />
      <path
        fill="unset"
        d="M74 37H26c-3.3 0-6 2.7-6 6v28c0 3.3 2.7 6 6 6h48c3.3 0 6-2.7 6-6V43c0-3.3-2.7-6-6-6zM50 71c-7.7 0-14-6.3-14-14s6.3-14 14-14 14 6.3 14 14-6.3 14-14 14z"
      />
    </svg>
  );
}
export default SvgPhoto;
