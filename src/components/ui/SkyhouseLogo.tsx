/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface SkyhouseLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  color?: string;
}

export function SkyhouseLogo({
  className = 'w-9 h-9',
  color = '#DFB13D',
  ...props
}: SkyhouseLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Roof outline */}
      <path
        d="M 12 40 L 50 12 L 88 40"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Walls/U-shape */}
      <path
        d="M 26 44 L 26 68 A 24 24 0 0 0 74 68 L 74 44"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Doorway / filled archway */}
      <path
        d="M 38 92 L 38 76 A 12 12 0 0 1 62 76 L 62 92 Z"
        fill={color}
      />
    </svg>
  );
}
