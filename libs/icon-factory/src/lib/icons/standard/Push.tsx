import * as React from 'react';
function SvgPush(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000" fill="unset" aria-hidden="true" {...props}>
      <path d="M750 210H450c-27 0-50 22-50 49v2c0 8 5 17 13 22l51 49c3 4 10 0 10-5 0-10 8-20 18-20h213c10 0 20 10 20 20v333c0 10-10 17-20 17H492c-10 0-17-7-17-17v-1c0-5-6-8-10-4 0 0-48 47-53 49-7 5-12 12-12 22v25c0 27 21 49 49 49h300c27 0 51-22 51-49V259c0-27-23-49-50-49M600 777c-21 0-37-16-37-37s16-37 37-37 38 16 38 37-17 37-38 37m-55-297L389 326c-8-8-19-8-27 0l-26 26c-7 7-7 18 0 26l58 56c7 8 2 21-9 21H219c-10 1-19 10-19 20v37c0 10 9 18 19 18h165c11 0 16 14 9 21l-58 57c-7 7-7 18 0 26l26 26c8 7 19 7 26 0l158-154c6-6 6-19 0-26" />
    </svg>
  );
}
export default SvgPush;
