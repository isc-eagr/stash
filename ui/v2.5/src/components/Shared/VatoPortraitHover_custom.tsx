import React, { useState } from "react";
import cx from "classnames";
import { HoverPopover } from "./HoverPopover";

import "./vatoPortraitHover_custom.scss";

// CUSTOM: small inline vato portraits show the full picture on hover (a tap on
// touch screens), sized to stay inside the viewport.
export const VatoPortraitHover: React.FC<{
  imagePath?: string | null;
  name?: string | null;
  className?: string;
  children: React.ReactNode;
}> = ({ imagePath, name, className, children }) => {
  // Open toward the side with more room, e.g. left inside the right-hand drawer.
  const [placement, setPlacement] = useState<"left" | "right">("right");

  return (
    <HoverPopover
      className={cx("vato-portrait-hover", className)}
      content={
        <img
          alt={name ?? ""}
          className="vato-portrait-hover-image"
          src={imagePath ?? ""}
        />
      }
      disabled={!imagePath}
      placement={placement}
      popoverClassName="vato-portrait-hover-popover"
    >
      <span
        className="vato-portrait-hover-trigger"
        onMouseEnter={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPlacement(
            rect.left + rect.width / 2 > window.innerWidth / 2
              ? "left"
              : "right"
          );
        }}
      >
        {children}
      </span>
    </HoverPopover>
  );
};
