import * as React from 'react';
function SvgApp(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M620 280H315c-17 0-31 14-31 31v305h-46c-21 0-38-17-38-38V233c0-21 17-38 38-38h345c21 0 38 17 38 38v47zm-202 96h345c21 0 38 17 38 38v345c0 21-17 38-38 38H418c-21 0-38-17-38-38V413c0-20 17-37 38-37z" />
    </svg>
  );
}
export default SvgApp;
