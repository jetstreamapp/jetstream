import * as React from 'react';
function SvgPassword(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M740 800H260c-33 0-60-27-60-60V260c0-33 27-60 60-60h480c33 0 60 27 60 60v480c0 33-27 60-60 60zM281 300v400c0 11 9 20 20 20h399c11 0 20-9 20-20V300c0-11-9-20-20-20H301c-11 0-20 9-20 20zm382 173l-12-38c-3-10-15-16-25-13l-87 28v-86c0-11-9-20-20-20h-40c-11 0-20 9-20 20v86l-85-28c-10-3-22 3-25 13l-12 38c-3 10 3 22 13 25l79 26-57 78c-6 9-4 22 5 28l33 23c9 6 22 4 28-5l63-87 63 87c6 9 19 11 28 5l33-23c9-6 11-19 5-28l-57-79 78-25c9-4 15-15 12-25z" />
    </svg>
  );
}
export default SvgPassword;
