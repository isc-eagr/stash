import type { CSSProperties } from "react";

// Converts visual (screen-space) crop percentages to local (pre-rotation) CSS inset values.
// clip-path is applied before transform, so we must remap based on rotation.
export function visualToLocalClipPath(
  vTop: number,
  vRight: number,
  vBottom: number,
  vLeft: number,
  rotation: number
): string {
  switch (rotation) {
    case 90:
      return `inset(${vRight}% ${vBottom}% ${vLeft}% ${vTop}%)`;
    case 180:
      return `inset(${vBottom}% ${vLeft}% ${vTop}% ${vRight}%)`;
    case 270:
      return `inset(${vLeft}% ${vTop}% ${vRight}% ${vBottom}%)`;
    default:
      return `inset(${vTop}% ${vRight}% ${vBottom}% ${vLeft}%)`;
  }
}

// Returns a style for an inner wrapper that is rotated so its visual result
// fills the container (containerW × containerH) exactly.
// For 90°/270° the wrapper dims swap; we position it centered.
export function getRotatorStyle(
  rotation: number,
  containerW: number,
  containerH: number
): CSSProperties {
  if (rotation === 0 || rotation === 180) {
    return {
      width: "100%",
      height: "100%",
      transform: `rotate(${rotation}deg)`,
    };
  }
  // 90 or 270: pre-rotation width = containerH, height = containerW
  return {
    position: "absolute",
    width: containerH,
    height: containerW,
    left: (containerW - containerH) / 2,
    top: (containerH - containerW) / 2,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: "center",
  };
}
