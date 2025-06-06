import * as React from 'react';
function SvgBrand(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M794 391c-29-119-154-191-292-191-167 0-302 134-302 300s135 300 303 300c232 0 214-118 140-164-44-28-68-91-24-136 81-84 212 50 175-109zM337 600c-35 0-63-28-63-62s28-62 63-62 62 28 62 62-27 62-62 62zm13-238c0-35 28-62 62-62 35 0 62 28 62 62s-28 62-62 62c-35 1-62-26-62-62zm137 363c-35 0-62-28-62-62s28-62 62-62c35 0 62 28 62 62s-27 62-62 62zm113-325c-35 0-62-28-62-62s28-62 62-62c35 0 62 28 62 62s-27 62-62 62z" />
    </svg>
  );
}
export default SvgBrand;
