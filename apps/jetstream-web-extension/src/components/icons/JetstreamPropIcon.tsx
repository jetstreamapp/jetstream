import { css } from '@emotion/react';
import React, { FunctionComponent } from 'react';

export const JetstreamPropIcon: FunctionComponent<React.SVGProps<SVGSVGElement>> = (props) => (
  <svg
    width="100%"
    height="100%"
    viewBox="0 0 755 750"
    version="1.1"
    xmlns="http://www.w3.org/2000/svg"
    xmlSpace="preserve"
    css={css`
      fill-rule: evenodd;
      clip-rule: evenodd;
      stroke-linejoin: round;
      stroke-miterlimit: 2;
    `}
    {...props}
  >
    <g>
      <g>
        <g>
          <path
            d="M753.006,37.493c0,-20.701 -16.803,-37.503 -37.504,-37.503l-675.003,-0c-20.694,-0 -37.497,16.802 -37.497,37.503l0,675.004c0,20.694 16.803,37.496 37.497,37.496l675.003,0c20.701,0 37.504,-16.802 37.504,-37.496l0,-675.004Z"
            css={css`"fill:url(#_Linear1);"`}
          />
        </g>
        <g>
          <g>
            <rect x="114.294" y="481.834" width="336.614" height="72.881" css={css`"fill:#e4e4e4;"`} />
          </g>
          <g>
            <rect x="217.688" y="336.072" width="233.22" height="72.881" css={css`"fill:#e4e4e4;"`} />
          </g>
          <g>
            <rect x="285.71" y="175.733" width="165.198" height="72.881" css={css`"fill:#e4e4e4;"`} />
          </g>
          <g>
            <path
              d="M366.949,656.166c30.999,-2.332 58.305,-10.884 74.436,-29.152c18.657,-21.671 25.654,-51.212 25.654,-141.196l-0,-313.972l68.022,-0l0,340.695c0,72.979 -11.661,120.303 -45.089,154.509c-30.221,30.221 -79.878,42.659 -116.61,42.659l-6.413,-53.543Zm175.984,-589.852c0.029,0.641 0.048,1.292 0.048,1.934c0,22.019 -18.123,40.133 -40.133,40.133c-0.894,-0 -1.788,-0.029 -2.672,-0.088c-0.36,0.01 -0.719,0.01 -1.089,0.01c-22.389,0 -40.813,-18.415 -40.813,-40.813c-0,-0.389 0.01,-0.788 0.019,-1.176c-0.009,-0.301 -0.009,-0.603 -0.009,-0.904c-0,-22.924 18.861,-41.785 41.785,-41.785c0.554,-0 1.108,0.009 1.661,0.029c0.282,-0.01 0.564,-0.01 0.836,-0.01c22.185,0 40.425,18.25 40.425,40.425c-0,0.748 -0.019,1.497 -0.058,2.245Z"
              css={css`"fill:#fff;fill-rule:nonzero;"`}
            />
          </g>
        </g>
      </g>
    </g>
    <defs>
      <linearGradient
        id="_Linear1"
        x1="0"
        y1="0"
        x2="1"
        y2="0"
        gradientUnits="userSpaceOnUse"
        gradientTransform="matrix(750.004,0,0,750.004,3.00245,374.991)"
      >
        <stop offset="0" css={css`"stop-color:#0d9488;stop-opacity:1" `} />
        <stop offset="1" css={css`"stop-color:#0e7490;stop-opacity:1" `} />
      </linearGradient>
    </defs>
  </svg>
);

export default JetstreamPropIcon;
