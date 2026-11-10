import React, { useRef } from "react";

// CUSTOM: tab pane "transition" without react-bootstrap's Fade. Fade only
// reaches its shown state from componentDidUpdate, which React skips while a
// Suspense boundary above the tabs shows its fallback (a lazy panel loading
// on first open). The pane then stayed at opacity 0, clickable but invisible,
// until some later re-render. This decides everything during render: a pane
// mounts on first open (with mountOnEnter) and the active class shows it.
interface ITabPaneShowProps {
  in?: boolean;
  mountOnEnter?: boolean;
  unmountOnExit?: boolean;
  children: React.ReactElement;
}

export const TabPaneShow: React.FC<ITabPaneShowProps> = ({
  in: active,
  mountOnEnter,
  unmountOnExit,
  children,
}) => {
  const opened = useRef(false);
  if (active) opened.current = true;
  if (!active && (unmountOnExit || (mountOnEnter && !opened.current))) {
    return null;
  }
  return children;
};
