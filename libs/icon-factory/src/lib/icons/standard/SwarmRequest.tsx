import * as React from 'react';
function SvgSwarmRequest(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M591 800a42 42 0 0032-14 46 46 0 0014-32V651a69 69 0 00-68-68H432a69 69 0 00-69 68v103a47 47 0 0046 46zm-298-46V652a134 134 0 0139-95 12 12 0 000-17 12 12 0 00-8-3H214a69 69 0 00-68 68v104a47 47 0 0045 45zm516 0a42 42 0 0032-13 46 46 0 0013-32V606a69 69 0 00-68-69H676a11 11 0 00-8 20 137 137 0 0139 95v102z" />
      <circle cx={414} cy={264} r={63} />
      <circle cx={586} cy={264} r={63} />
      <circle cx={284} cy={412} r={80} />
      <circle cx={718} cy={412} r={80} />
      <circle cx={501} cy={457} r={80} />
    </svg>
  );
}
export default SvgSwarmRequest;
