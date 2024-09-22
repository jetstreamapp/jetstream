import * as React from 'react';
function SvgEntity(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M744 287c0-48-109-87-244-87s-244 39-244 87v30c0 48 109 87 244 87s244-39 244-87zM256 387c0 38 109 68 244 68s244-30 244-68v62c0 48-109 87-244 87s-244-39-244-87zm0 0c0 38 109 68 244 68s244-30 244-68v62c0 48-109 87-244 87s-244-39-244-87zm0 132c0 38 109 68 244 68s244-30 244-68v61c0 48-109 87-244 87s-244-38-244-85zm0 133c0 38 110 68 244 68s244-30 244-68v62c0 48-109 87-244 87s-244-39-244-87z" />
    </svg>
  );
}
export default SvgEntity;
