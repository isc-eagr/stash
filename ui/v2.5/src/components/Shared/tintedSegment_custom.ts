import type React from "react";

// CUSTOM: hands a stacked-bar segment its color for the shared tile tint
// (styles/tintedSegments_custom.scss: .tinted-segment-custom).
export const tintedSegmentStyleCustom = (
  color: string,
  style?: React.CSSProperties
): React.CSSProperties =>
  ({ ...style, "--segment-color": color }) as React.CSSProperties;
