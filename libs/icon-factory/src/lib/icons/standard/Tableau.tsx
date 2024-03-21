import * as React from 'react';
function SvgTableau(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M60 51.6h-8.3V61h-3.3v-9.4H40v-3.3h8.3V39h3.3v9.4H60zM43 63.3h-7.1V55h-2.7v8.3H26v2.5h7.2V74h2.7v-8.2H43zM74 34.2h-7.2V26h-2.7v8.2H57v2.6h7.2V45h2.7v-8.2H74zM56 71.8h-4.8V66h-2.3v5.8H44v2.3h4.9V80h2.3v-5.9H56zM43 34.2h-7.2V26h-2.6v8.2H26v2.5h7.2V45h2.6v-8.3H43zM80 48.8h-4.8V43h-2.3v5.8H68v2.3h4.9V57h2.3v-5.8H80zM74 63.3h-7.2V55h-2.7v8.3H57v2.5h7.2V74h2.7v-8.2H74zM56 25.7h-5.1V20H49v5.7h-5v1.7h5.1V33H51v-5.6h5zM32 49.2h-5.1V44H25v5.2h-5v1.6h5.1V56H27v-5.2h5z"
        fill="unset"
      />
    </svg>
  );
}
export default SvgTableau;
