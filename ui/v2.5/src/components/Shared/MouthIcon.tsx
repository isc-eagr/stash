import React from "react";

export interface MouthIconProps {
  className?: string;
  title?: string;
}

// Inline SVG icon for a mouth: outer path uses currentColor; inner path is white
export const MouthIcon: React.FC<MouthIconProps> = ({ className, title }) => (
  <svg
    width="1em"
    height="1em"
    viewBox="0 0 256 256"
    xmlns="http://www.w3.org/2000/svg"
    aria-label={title || "Oral / Mouth"}
    role="img"
    className={className}
    focusable="false"
  >
    {title ? <title>{title}</title> : null}
    <path
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M32 120 C 64 80, 96 64, 128 64 160 64, 192 80, 224 120 192 160, 160 196, 128 196 96 196, 64 160, 32 120 Z M84 132 C 104 120, 152 120, 172 132 156 142, 140 150, 128 150 116 150, 100 142, 84 132 Z"
    />
  </svg>
);
