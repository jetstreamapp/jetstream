import * as React from 'react';
function SvgAnswerPrivate(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="unset" viewBox="0 0 1000 1000" aria-hidden="true" {...props}>
      <path
        fillOpacity={0.65}
        d="M890 840a20 20 0 00-20 20v10h40v-10a20 20 0 00-20-20zm110 160V620l-380 380zm-50-65a15 15 0 01-15 15h-90a15 15 0 01-15-15v-50a15 15 0 0115-15h5v-10c0-22 18-40 40-40s40 18 40 40v10h5a15 15 0 0115 15z"
      />
      <path d="M499 220c-166 0-300 125-300 280 0 50 14 96 38 137 3 5 4 11 2 16l-28 89c-5 16 10 30 26 25l88-31a20 20 0 0117 2 310 310 0 00158 42c166 0 300-125 300-280-1-155-134-280-301-280zm145 218L491 591a29 29 0 01-42 0l-74-74c-6-6-6-15 0-21l21-21c6-6 15-6 21 0l53 53 132-132c6-6 15-6 21 0l21 21c5 6 5 16 0 21z" />
    </svg>
  );
}
export default SvgAnswerPrivate;
