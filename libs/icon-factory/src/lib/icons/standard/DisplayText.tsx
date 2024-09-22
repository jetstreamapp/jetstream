import * as React from 'react';
function SvgDisplayText(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M723 201H278c-43 0-78 35-78 78v443c0 43 35 78 78 78h444c43 0 78-35 78-78V279c1-43-34-78-77-78zM304 331c0-14 12-26 26-26h292c14 0 26 12 26 26v27c0 14-11 26-25 26H330c-14 0-26-12-26-26zm308 340c0 14-11 26-25 26H330c-14 0-26-12-26-26v-26c0-14 12-26 26-26h256c14 0 26 12 26 26zm84-157c0 14-11 26-25 26H330c-14 0-26-12-26-26v-26c0-14 12-26 26-26h340c14 0 26 12 26 26z" />
    </svg>
  );
}
export default SvgDisplayText;
