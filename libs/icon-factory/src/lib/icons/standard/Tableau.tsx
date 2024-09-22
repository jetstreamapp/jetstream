import * as React from 'react';
function SvgTableau(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M600 516h-83v94h-33v-94h-84v-33h83v-93h33v94h84zM430 633h-71v-83h-27v83h-72v25h72v82h27v-82h71zm310-291h-72v-82h-27v82h-71v26h72v82h27v-82h71zM560 718h-48v-58h-23v58h-49v23h49v59h23v-59h48zM430 342h-72v-82h-26v82h-72v25h72v83h26v-83h72zm370 146h-48v-58h-23v58h-49v23h49v59h23v-58h48zm-60 145h-72v-83h-27v83h-71v25h72v82h27v-82h71zM560 257h-51v-57h-19v57h-50v17h51v56h19v-56h50zM320 492h-51v-52h-19v52h-50v16h51v52h19v-52h50z" />
    </svg>
  );
}
export default SvgTableau;
